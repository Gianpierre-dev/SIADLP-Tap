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

// =====================================================================
// create (hoja de carga)
// =====================================================================

type CreateTxMock = {
  pedido: { findMany: jest.Mock; updateMany: jest.Mock };
  ruta: { findUnique: jest.Mock };
  vehiculo: { findUnique: jest.Mock };
  chofer: { findUnique: jest.Mock };
  hojaCarga: { create: jest.Mock; findUnique: jest.Mock };
};

type DecimalLike = { toNumber: () => number };

const dec = (n: number): DecimalLike => ({ toNumber: () => n });

// Typed wrapper to keep TS strict-mode happy (jest's expect.* return `any`)
const objectMatching = <T extends object>(shape: T): T =>
  expect.objectContaining(shape) as T;

const buildPedidoForCreate = (
  id: number,
  estado: OrderStatus,
  detalles: Array<{ cantidad: number }>,
  hojaCargaId: number | null = null,
) => ({
  id,
  estado,
  hojaCargaId,
  detalles: detalles.map((d) => ({ cantidad: dec(d.cantidad) })),
});

describe('DispatchService — create (hoja de carga)', () => {
  let service: DispatchService;
  let tx: CreateTxMock;
  let prisma: { $transaction: jest.Mock };

  beforeEach(async () => {
    tx = {
      pedido: { findMany: jest.fn(), updateMany: jest.fn() },
      ruta: { findUnique: jest.fn() },
      vehiculo: { findUnique: jest.fn() },
      chofer: { findUnique: jest.fn() },
      hojaCarga: { create: jest.fn(), findUnique: jest.fn() },
    };
    prisma = {
      $transaction: jest.fn((cb: (txClient: CreateTxMock) => unknown) =>
        cb(tx),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatchService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DispatchService>(DispatchService);
  });

  const validDto = {
    fecha: '2026-05-10',
    rutaId: 1,
    vehiculoId: 2,
    choferId: 3,
    pedidoIds: [10, 20],
  };

  const setupValidContext = () => {
    tx.pedido.findMany.mockResolvedValue([
      buildPedidoForCreate(10, OrderStatus.CONFIRMED, [{ cantidad: 5 }]),
      buildPedidoForCreate(20, OrderStatus.CONFIRMED, [{ cantidad: 3 }]),
    ]);
    tx.ruta.findUnique.mockResolvedValue({ id: 1, activa: true });
    tx.vehiculo.findUnique.mockResolvedValue({
      id: 2,
      activo: true,
      capacidadKg: dec(100),
    });
    tx.chofer.findUnique.mockResolvedValue({ id: 3, activo: true });
    tx.hojaCarga.create.mockResolvedValue({ id: 500 });
    tx.pedido.updateMany.mockResolvedValue({ count: 2 });
    tx.hojaCarga.findUnique.mockResolvedValue({
      id: 500,
      estado: DispatchStatus.PREPARANDO,
      pedidos: [],
      ruta: {},
      vehiculo: {},
      chofer: {},
    });
  };

  it('crea la hoja con pedidos CONFIRMED y calcula totalKg sumando todas las líneas', async () => {
    // Arrange
    setupValidContext();

    // Act
    await service.create(validDto, 7);

    // Assert
    expect(tx.hojaCarga.create).toHaveBeenCalledWith(
      objectMatching({
        data: objectMatching({
          rutaId: 1,
          vehiculoId: 2,
          choferId: 3,
          estado: DispatchStatus.PREPARANDO,
          totalKg: 8, // 5 + 3
          creadoPorId: 7,
        }),
      }),
    );
    expect(tx.pedido.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [10, 20] } },
      data: { hojaCargaId: 500 },
    });
  });

  it('rechaza con NotFoundException si algún pedidoId no existe', async () => {
    // Arrange — solo encuentra 1 de los 2 pedidos
    tx.pedido.findMany.mockResolvedValue([
      buildPedidoForCreate(10, OrderStatus.CONFIRMED, [{ cantidad: 5 }]),
    ]);

    // Act & Assert
    await expect(service.create(validDto, 1)).rejects.toThrow(
      NotFoundException,
    );
    expect(tx.hojaCarga.create).not.toHaveBeenCalled();
  });

  it('rechaza con BadRequestException si algún pedido no está en CONFIRMED', async () => {
    // Arrange
    tx.pedido.findMany.mockResolvedValue([
      buildPedidoForCreate(10, OrderStatus.CONFIRMED, [{ cantidad: 5 }]),
      buildPedidoForCreate(20, OrderStatus.REGISTERED, [{ cantidad: 3 }]),
    ]);

    // Act & Assert
    await expect(service.create(validDto, 1)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.create(validDto, 1)).rejects.toThrow(/CONFIRMED/i);
    expect(tx.hojaCarga.create).not.toHaveBeenCalled();
  });

  it('rechaza con BadRequestException si algún pedido ya está asignado a otra hoja', async () => {
    // Arrange — pedido 20 ya tiene hojaCargaId
    tx.pedido.findMany.mockResolvedValue([
      buildPedidoForCreate(10, OrderStatus.CONFIRMED, [{ cantidad: 5 }]),
      buildPedidoForCreate(20, OrderStatus.CONFIRMED, [{ cantidad: 3 }], 999),
    ]);

    // Act & Assert
    await expect(service.create(validDto, 1)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.create(validDto, 1)).rejects.toThrow(/ya están/i);
    expect(tx.hojaCarga.create).not.toHaveBeenCalled();
  });

  it('rechaza si el peso total excede la capacidad del vehículo', async () => {
    // Arrange — totalKg=200 pero vehículo capacidad=100
    tx.pedido.findMany.mockResolvedValue([
      buildPedidoForCreate(10, OrderStatus.CONFIRMED, [{ cantidad: 200 }]),
      buildPedidoForCreate(20, OrderStatus.CONFIRMED, [{ cantidad: 0 }]),
    ]);
    tx.ruta.findUnique.mockResolvedValue({ id: 1, activa: true });
    tx.vehiculo.findUnique.mockResolvedValue({
      id: 2,
      activo: true,
      capacidadKg: dec(100),
    });
    tx.chofer.findUnique.mockResolvedValue({ id: 3, activo: true });

    // Act & Assert
    await expect(service.create(validDto, 1)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.create(validDto, 1)).rejects.toThrow(/capacidad/i);
    expect(tx.hojaCarga.create).not.toHaveBeenCalled();
  });

  it('rechaza si la ruta no existe o está inactiva', async () => {
    // Arrange
    tx.pedido.findMany.mockResolvedValue([
      buildPedidoForCreate(10, OrderStatus.CONFIRMED, [{ cantidad: 5 }]),
      buildPedidoForCreate(20, OrderStatus.CONFIRMED, [{ cantidad: 3 }]),
    ]);
    tx.ruta.findUnique.mockResolvedValue({ id: 1, activa: false });

    // Act & Assert
    await expect(service.create(validDto, 1)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.create(validDto, 1)).rejects.toThrow(/Ruta/i);
  });

  it('rechaza si el vehículo no existe o está inactivo', async () => {
    // Arrange
    tx.pedido.findMany.mockResolvedValue([
      buildPedidoForCreate(10, OrderStatus.CONFIRMED, [{ cantidad: 5 }]),
      buildPedidoForCreate(20, OrderStatus.CONFIRMED, [{ cantidad: 3 }]),
    ]);
    tx.ruta.findUnique.mockResolvedValue({ id: 1, activa: true });
    tx.vehiculo.findUnique.mockResolvedValue(null);

    // Act & Assert
    await expect(service.create(validDto, 1)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.create(validDto, 1)).rejects.toThrow(/Vehículo/i);
  });

  it('rechaza si el chofer no existe o está inactivo', async () => {
    // Arrange
    tx.pedido.findMany.mockResolvedValue([
      buildPedidoForCreate(10, OrderStatus.CONFIRMED, [{ cantidad: 5 }]),
      buildPedidoForCreate(20, OrderStatus.CONFIRMED, [{ cantidad: 3 }]),
    ]);
    tx.ruta.findUnique.mockResolvedValue({ id: 1, activa: true });
    tx.vehiculo.findUnique.mockResolvedValue({
      id: 2,
      activo: true,
      capacidadKg: dec(100),
    });
    tx.chofer.findUnique.mockResolvedValue({ id: 3, activo: false });

    // Act & Assert
    await expect(service.create(validDto, 1)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.create(validDto, 1)).rejects.toThrow(/Chofer/i);
  });
});

// =====================================================================
// confirmDispatch
// =====================================================================

type ConfirmTxMock = {
  hojaCarga: { findUnique: jest.Mock; update: jest.Mock };
  pedido: { update: jest.Mock };
  estadoPedidoLog: { create: jest.Mock };
  entrega: { create: jest.Mock };
};

const buildHojaForConfirm = (
  estado: DispatchStatus,
  pedidoIds: number[] = [1, 2],
) => ({
  id: 100,
  estado,
  pedidos: pedidoIds.map((id) => ({
    id,
    estado: OrderStatus.CONFIRMED,
    detalles: [
      {
        productoId: 1,
        cantidad: dec(2),
        producto: { id: 1, nombre: 'Pan', unidadMedida: 'KG' },
      },
    ],
  })),
});

describe('DispatchService — confirmDispatch', () => {
  let service: DispatchService;
  let tx: ConfirmTxMock;
  let prisma: { $transaction: jest.Mock };

  beforeEach(async () => {
    tx = {
      hojaCarga: { findUnique: jest.fn(), update: jest.fn() },
      pedido: { update: jest.fn() },
      estadoPedidoLog: { create: jest.fn() },
      entrega: { create: jest.fn() },
    };
    prisma = {
      $transaction: jest.fn((cb: (txClient: ConfirmTxMock) => unknown) =>
        cb(tx),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatchService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DispatchService>(DispatchService);
  });

  it('cambia la hoja de PREPARANDO → DESPACHADO', async () => {
    // Arrange
    const hoja = buildHojaForConfirm(DispatchStatus.PREPARANDO, [1, 2]);
    tx.hojaCarga.findUnique
      .mockResolvedValueOnce(hoja) // primer findUnique con pedidos
      .mockResolvedValueOnce({ id: 100, estado: DispatchStatus.DESPACHADO }); // findUnique final
    tx.pedido.update.mockResolvedValue({});
    tx.estadoPedidoLog.create.mockResolvedValue({});
    tx.entrega.create.mockResolvedValue({});
    tx.hojaCarga.update.mockResolvedValue({});

    // Act
    await service.confirmDispatch(100, {}, 9);

    // Assert
    expect(tx.hojaCarga.update).toHaveBeenCalledWith({
      where: { id: 100 },
      data: { estado: DispatchStatus.DESPACHADO },
    });
  });

  it('cambia todos los pedidos CONFIRMED → DISPATCHED', async () => {
    // Arrange
    const hoja = buildHojaForConfirm(DispatchStatus.PREPARANDO, [1, 2]);
    tx.hojaCarga.findUnique
      .mockResolvedValueOnce(hoja)
      .mockResolvedValueOnce({});
    tx.pedido.update.mockResolvedValue({});
    tx.estadoPedidoLog.create.mockResolvedValue({});
    tx.entrega.create.mockResolvedValue({});
    tx.hojaCarga.update.mockResolvedValue({});

    // Act
    await service.confirmDispatch(100, {}, 9);

    // Assert
    expect(tx.pedido.update).toHaveBeenCalledTimes(2);
    expect(tx.pedido.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { estado: OrderStatus.DISPATCHED },
    });
    expect(tx.pedido.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { estado: OrderStatus.DISPATCHED },
    });
  });

  it('crea una Entrega en estado PENDIENTE por cada pedido de la hoja', async () => {
    // Arrange
    const hoja = buildHojaForConfirm(DispatchStatus.PREPARANDO, [1, 2]);
    tx.hojaCarga.findUnique
      .mockResolvedValueOnce(hoja)
      .mockResolvedValueOnce({});
    tx.pedido.update.mockResolvedValue({});
    tx.estadoPedidoLog.create.mockResolvedValue({});
    tx.entrega.create.mockResolvedValue({});
    tx.hojaCarga.update.mockResolvedValue({});

    // Act
    await service.confirmDispatch(100, {}, 9);

    // Assert
    expect(tx.entrega.create).toHaveBeenCalledTimes(2);
    expect(tx.entrega.create).toHaveBeenCalledWith({
      data: {
        pedidoId: 1,
        estado: DeliveryStatus.PENDIENTE,
        registradoPorId: 9,
      },
    });
    expect(tx.entrega.create).toHaveBeenCalledWith({
      data: {
        pedidoId: 2,
        estado: DeliveryStatus.PENDIENTE,
        registradoPorId: 9,
      },
    });
  });

  it('crea log de transición CONFIRMED → DISPATCHED por cada pedido', async () => {
    // Arrange
    const hoja = buildHojaForConfirm(DispatchStatus.PREPARANDO, [1]);
    tx.hojaCarga.findUnique
      .mockResolvedValueOnce(hoja)
      .mockResolvedValueOnce({});
    tx.pedido.update.mockResolvedValue({});
    tx.estadoPedidoLog.create.mockResolvedValue({});
    tx.entrega.create.mockResolvedValue({});
    tx.hojaCarga.update.mockResolvedValue({});

    // Act
    await service.confirmDispatch(100, {}, 9);

    // Assert
    expect(tx.estadoPedidoLog.create).toHaveBeenCalledWith({
      data: {
        pedidoId: 1,
        estadoAnterior: OrderStatus.CONFIRMED,
        estadoNuevo: OrderStatus.DISPATCHED,
        motivo: 'Despacho confirmado. Hoja de carga #100',
        usuarioId: 9,
      },
    });
  });

  it('lanza NotFoundException cuando la hoja no existe', async () => {
    // Arrange
    tx.hojaCarga.findUnique.mockResolvedValue(null);

    // Act & Assert
    await expect(service.confirmDispatch(999, {}, 1)).rejects.toThrow(
      NotFoundException,
    );
    expect(tx.pedido.update).not.toHaveBeenCalled();
    expect(tx.entrega.create).not.toHaveBeenCalled();
  });

  it('lanza BadRequestException si la hoja no está en PREPARANDO', async () => {
    // Arrange
    const hoja = buildHojaForConfirm(DispatchStatus.DESPACHADO, [1]);
    tx.hojaCarga.findUnique.mockResolvedValue(hoja);

    // Act & Assert
    await expect(service.confirmDispatch(100, {}, 1)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.confirmDispatch(100, {}, 1)).rejects.toThrow(
      /PREPARANDO/i,
    );
    expect(tx.pedido.update).not.toHaveBeenCalled();
    expect(tx.entrega.create).not.toHaveBeenCalled();
  });
});
