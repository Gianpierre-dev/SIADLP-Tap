import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderStatus, DispatchStatus, DeliveryStatus } from '@siadlp/shared';

import { DispatchService } from './dispatch.service';
import { PrismaService } from '../prisma/prisma.service';

type TxMock = {
  hojaCarga: { findUnique: jest.Mock; update: jest.Mock };
  pedido: { updateMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  estadoPedidoLog: { createMany: jest.Mock; create: jest.Mock };
  entrega: { findUnique: jest.Mock; update: jest.Mock; count: jest.Mock };
};

const buildHoja = (
  estado: DispatchStatus,
  pedidos: Array<{ id: number; estado: OrderStatus }> = [],
) => ({
  id: 100,
  estado,
  pedidos,
});

describe('DispatchService — startRoute', () => {
  let service: DispatchService;
  let tx: TxMock;
  let prisma: { $transaction: jest.Mock };

  beforeEach(async () => {
    tx = {
      hojaCarga: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      pedido: {
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      estadoPedidoLog: {
        createMany: jest.fn(),
        create: jest.fn(),
      },
      entrega: {
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    prisma = {
      $transaction: jest.fn((cb: (txClient: TxMock) => unknown) => cb(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatchService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DispatchService>(DispatchService);
  });

  describe('happy path', () => {
    it('cambia pedidos DISPATCHED → ON_ROUTE y hoja DESPACHADO → EN_RUTA', async () => {
      // Arrange
      const hoja = buildHoja(DispatchStatus.DESPACHADO, [
        { id: 1, estado: OrderStatus.DISPATCHED },
        { id: 2, estado: OrderStatus.DISPATCHED },
      ]);
      tx.hojaCarga.findUnique.mockResolvedValue(hoja);
      tx.pedido.updateMany.mockResolvedValue({ count: 2 });
      tx.estadoPedidoLog.createMany.mockResolvedValue({ count: 2 });
      tx.hojaCarga.update.mockResolvedValue({
        id: 100,
        estado: DispatchStatus.EN_RUTA,
      });

      // Act
      await service.startRoute(100, 5);

      // Assert
      expect(tx.pedido.updateMany).toHaveBeenCalledWith({
        where: { hojaCargaId: 100 },
        data: { estado: OrderStatus.ON_ROUTE },
      });
      expect(tx.hojaCarga.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 100 },
          data: { estado: DispatchStatus.EN_RUTA },
        }),
      );
    });

    it('crea logs de transición con motivo y usuario correcto', async () => {
      // Arrange
      const hoja = buildHoja(DispatchStatus.DESPACHADO, [
        { id: 1, estado: OrderStatus.DISPATCHED },
      ]);
      tx.hojaCarga.findUnique.mockResolvedValue(hoja);
      tx.pedido.updateMany.mockResolvedValue({ count: 1 });
      tx.estadoPedidoLog.createMany.mockResolvedValue({ count: 1 });
      tx.hojaCarga.update.mockResolvedValue({});

      // Act
      await service.startRoute(100, 42);

      // Assert
      expect(tx.estadoPedidoLog.createMany).toHaveBeenCalledWith({
        data: [
          {
            pedidoId: 1,
            estadoAnterior: OrderStatus.DISPATCHED,
            estadoNuevo: OrderStatus.ON_ROUTE,
            motivo: 'Inicio de ruta. Hoja de carga #100',
            usuarioId: 42,
          },
        ],
      });
    });
  });

  describe('error paths', () => {
    it('lanza NotFoundException si la hoja no existe', async () => {
      tx.hojaCarga.findUnique.mockResolvedValue(null);

      await expect(service.startRoute(999, 1)).rejects.toThrow(
        NotFoundException,
      );
      expect(tx.pedido.updateMany).not.toHaveBeenCalled();
      expect(tx.hojaCarga.update).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si la hoja no está en DESPACHADO (estado PREPARANDO)', async () => {
      const hoja = buildHoja(DispatchStatus.PREPARANDO, [
        { id: 1, estado: OrderStatus.CONFIRMED },
      ]);
      tx.hojaCarga.findUnique.mockResolvedValue(hoja);

      await expect(service.startRoute(100, 1)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.startRoute(100, 1)).rejects.toThrow(
        /estado DESPACHADO/i,
      );
      expect(tx.pedido.updateMany).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si la hoja ya está en EN_RUTA (idempotencia)', async () => {
      const hoja = buildHoja(DispatchStatus.EN_RUTA, [
        { id: 1, estado: OrderStatus.ON_ROUTE },
      ]);
      tx.hojaCarga.findUnique.mockResolvedValue(hoja);

      await expect(service.startRoute(100, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza si algún pedido NO puede transicionar a ON_ROUTE', async () => {
      // Hoja en DESPACHADO pero un pedido en CANCELLED (no puede pasar a ON_ROUTE)
      const hoja = buildHoja(DispatchStatus.DESPACHADO, [
        { id: 1, estado: OrderStatus.DISPATCHED },
        { id: 2, estado: OrderStatus.CANCELLED },
      ]);
      tx.hojaCarga.findUnique.mockResolvedValue(hoja);

      await expect(service.startRoute(100, 1)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.startRoute(100, 1)).rejects.toThrow(
        /no puede transicionar/i,
      );
      expect(tx.pedido.updateMany).not.toHaveBeenCalled();
    });
  });
});

describe('DispatchService — registerDelivery', () => {
  let service: DispatchService;
  let tx: TxMock;
  let prisma: { $transaction: jest.Mock };

  beforeEach(async () => {
    tx = {
      hojaCarga: { findUnique: jest.fn(), update: jest.fn() },
      pedido: {
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      estadoPedidoLog: { createMany: jest.fn(), create: jest.fn() },
      entrega: {
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
    };

    prisma = {
      $transaction: jest.fn((cb: (txClient: TxMock) => unknown) => cb(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatchService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DispatchService>(DispatchService);

    tx.pedido.findUnique.mockImplementation(
      (args: { where?: { id?: number } }) => {
        // findUniqueOrThrow path used in registerDelivery
        if (args.where?.id) {
          return Promise.resolve({ estado: OrderStatus.ON_ROUTE });
        }
        return Promise.resolve(null);
      },
    );
    // Mock for findUniqueOrThrow (Prisma calls findUnique under the hood for our mock)
    (
      tx.pedido as TxMock['pedido'] & {
        findUniqueOrThrow: jest.Mock;
      }
    ).findUniqueOrThrow = jest
      .fn()
      .mockResolvedValue({ estado: OrderStatus.ON_ROUTE });
  });

  it('lanza NotFoundException si no existe entrega para el pedido', async () => {
    tx.entrega.findUnique.mockResolvedValue(null);

    await expect(
      service.registerDelivery(999, { estado: 'ENTREGADO' }, 1),
    ).rejects.toThrow(NotFoundException);
  });

  it('lanza BadRequestException si la entrega ya fue registrada', async () => {
    tx.entrega.findUnique.mockResolvedValue({
      id: 1,
      estado: DeliveryStatus.ENTREGADO,
    });

    await expect(
      service.registerDelivery(1, { estado: 'ENTREGADO' }, 1),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.registerDelivery(1, { estado: 'ENTREGADO' }, 1),
    ).rejects.toThrow(/ya fue registrada/i);
  });
});
