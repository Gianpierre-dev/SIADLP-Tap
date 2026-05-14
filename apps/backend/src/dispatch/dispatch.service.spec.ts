import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderStatus, DispatchStatus, DeliveryStatus } from '@siadlp/shared';

import { DispatchService } from './dispatch.service';
import { PrismaService } from '../prisma/prisma.service';

// Typed wrapper to keep TS strict-mode happy (jest's expect.* return `any`)
const objectMatching = <T extends object>(shape: T): T =>
  expect.objectContaining(shape) as T;
const anyObject = (): object => expect.any(Object) as object;

// Extracts the first argument of the first call to a jest.Mock with a typed cast,
// avoiding the `any` chain that `mock.calls[0][0]` produces.
const firstCallArg = <T>(mock: jest.Mock): T => {
  const calls = mock.mock.calls as unknown as T[][];
  return calls[0][0];
};

type DecimalLike = { toNumber: () => number };
const dec = (n: number): DecimalLike => ({ toNumber: () => n });

// =====================================================================
// startRoute
// =====================================================================

type StartRouteTxMock = {
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
  let tx: StartRouteTxMock;
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
        count: jest.fn(),
      },
    };

    prisma = {
      $transaction: jest.fn((cb: (txClient: StartRouteTxMock) => unknown) =>
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
      expect(tx.hojaCarga.findUnique).toHaveBeenCalledWith(
        objectMatching({
          where: { id: 100 },
          include: objectMatching({
            pedidos: objectMatching({
              select: { id: true, estado: true },
            }),
          }),
        }),
      );
      expect(tx.pedido.updateMany).toHaveBeenCalledWith({
        where: { hojaCargaId: 100 },
        data: { estado: OrderStatus.ON_ROUTE },
      });
      expect(tx.hojaCarga.update).toHaveBeenCalledWith(
        objectMatching({
          where: { id: 100 },
          data: { estado: DispatchStatus.EN_RUTA },
          include: objectMatching({
            ruta: anyObject(),
            vehiculo: anyObject(),
            chofer: anyObject(),
            _count: { select: { pedidos: true } },
          }),
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

    it('crea un log por cada pedido (preserva estado anterior individual)', async () => {
      // Arrange
      const hoja = buildHoja(DispatchStatus.DESPACHADO, [
        { id: 1, estado: OrderStatus.DISPATCHED },
        { id: 2, estado: OrderStatus.DISPATCHED },
        { id: 3, estado: OrderStatus.DISPATCHED },
      ]);
      tx.hojaCarga.findUnique.mockResolvedValue(hoja);
      tx.pedido.updateMany.mockResolvedValue({ count: 3 });
      tx.estadoPedidoLog.createMany.mockResolvedValue({ count: 3 });
      tx.hojaCarga.update.mockResolvedValue({});

      // Act
      await service.startRoute(100, 7);

      // Assert
      const args = firstCallArg<{
        data: Array<{
          pedidoId: number;
          estadoAnterior: string;
          estadoNuevo: string;
          motivo: string;
          usuarioId: number;
        }>;
      }>(tx.estadoPedidoLog.createMany);
      expect(args.data).toHaveLength(3);
      expect(args.data.map((d) => d.pedidoId)).toEqual([1, 2, 3]);
      // Todos los registros tienen el mismo motivo y usuario
      args.data.forEach((d) => {
        expect(d.estadoNuevo).toBe(OrderStatus.ON_ROUTE);
        expect(d.usuarioId).toBe(7);
        expect(d.motivo).toBe('Inicio de ruta. Hoja de carga #100');
      });
    });
  });

  describe('error paths', () => {
    it('lanza NotFoundException con mensaje exacto si la hoja no existe', async () => {
      tx.hojaCarga.findUnique.mockResolvedValue(null);

      await expect(service.startRoute(999, 1)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.startRoute(999, 1)).rejects.toThrow(
        'Hoja de carga no encontrada',
      );
      expect(tx.pedido.updateMany).not.toHaveBeenCalled();
      expect(tx.hojaCarga.update).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException con mensaje exacto si la hoja está en PREPARANDO', async () => {
      const hoja = buildHoja(DispatchStatus.PREPARANDO, [
        { id: 1, estado: OrderStatus.CONFIRMED },
      ]);
      tx.hojaCarga.findUnique.mockResolvedValue(hoja);

      await expect(service.startRoute(100, 1)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.startRoute(100, 1)).rejects.toThrow(
        'Solo se puede iniciar ruta en estado DESPACHADO. Estado actual: PREPARANDO',
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
      await expect(service.startRoute(100, 1)).rejects.toThrow(
        'Solo se puede iniciar ruta en estado DESPACHADO. Estado actual: EN_RUTA',
      );
    });

    it('rechaza con mensaje exacto si algún pedido NO puede transicionar a ON_ROUTE', async () => {
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
        'Pedido 2 no puede transicionar de CANCELLED a ON_ROUTE',
      );
      expect(tx.pedido.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('include shapes', () => {
    it('findUnique: include pedidos.select exacto {id, estado}', async () => {
      // Arrange
      const hoja = buildHoja(DispatchStatus.DESPACHADO, [
        { id: 1, estado: OrderStatus.DISPATCHED },
      ]);
      tx.hojaCarga.findUnique.mockResolvedValue(hoja);
      tx.pedido.updateMany.mockResolvedValue({ count: 1 });
      tx.estadoPedidoLog.createMany.mockResolvedValue({ count: 1 });
      tx.hojaCarga.update.mockResolvedValue({});

      // Act
      await service.startRoute(100, 1);

      // Assert — kills ObjectLiteral + BooleanLiteral en select
      const args = firstCallArg<{
        include: {
          pedidos: { select: { id: boolean; estado: boolean } };
        };
      }>(tx.hojaCarga.findUnique);
      expect(args.include.pedidos.select).toEqual({
        id: true,
        estado: true,
      });
    });

    it('update final: include exacto {ruta, vehiculo, chofer, _count.pedidos}', async () => {
      // Arrange
      const hoja = buildHoja(DispatchStatus.DESPACHADO, [
        { id: 1, estado: OrderStatus.DISPATCHED },
      ]);
      tx.hojaCarga.findUnique.mockResolvedValue(hoja);
      tx.pedido.updateMany.mockResolvedValue({ count: 1 });
      tx.estadoPedidoLog.createMany.mockResolvedValue({ count: 1 });
      tx.hojaCarga.update.mockResolvedValue({});

      // Act
      await service.startRoute(100, 1);

      // Assert — kills ObjectLiteral + BooleanLiteral en TODOS los selects del update
      const args = firstCallArg<{
        include: {
          ruta: { select: { id: boolean; nombre: boolean; zona: boolean } };
          vehiculo: { select: { id: boolean; placa: boolean } };
          chofer: {
            select: { id: boolean; nombre: boolean; apellido: boolean };
          };
          _count: { select: { pedidos: boolean } };
        };
      }>(tx.hojaCarga.update);
      expect(args.include.ruta.select).toEqual({
        id: true,
        nombre: true,
        zona: true,
      });
      expect(args.include.vehiculo.select).toEqual({
        id: true,
        placa: true,
      });
      expect(args.include.chofer.select).toEqual({
        id: true,
        nombre: true,
        apellido: true,
      });
      expect(args.include._count.select).toEqual({ pedidos: true });
    });
  });
});

// =====================================================================
// registerDelivery
// =====================================================================

type RegisterDeliveryTxMock = {
  hojaCarga: { findUnique: jest.Mock; update: jest.Mock };
  pedido: {
    updateMany: jest.Mock;
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    update: jest.Mock;
  };
  estadoPedidoLog: { createMany: jest.Mock; create: jest.Mock };
  entrega: {
    findUnique: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
};

describe('DispatchService — registerDelivery', () => {
  let service: DispatchService;
  let tx: RegisterDeliveryTxMock;
  let prisma: { $transaction: jest.Mock };

  beforeEach(async () => {
    tx = {
      hojaCarga: { findUnique: jest.fn(), update: jest.fn() },
      pedido: {
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      estadoPedidoLog: { createMany: jest.fn(), create: jest.fn() },
      entrega: {
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(1), // default: still pending deliveries
      },
    };

    prisma = {
      $transaction: jest.fn(
        (cb: (txClient: RegisterDeliveryTxMock) => unknown) => cb(tx),
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

  it('lanza NotFoundException con mensaje exacto si no existe entrega', async () => {
    tx.entrega.findUnique.mockResolvedValue(null);

    await expect(
      service.registerDelivery(999, { estado: 'ENTREGADO' }, 1),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.registerDelivery(999, { estado: 'ENTREGADO' }, 1),
    ).rejects.toThrow('Entrega no encontrada');
  });

  it('lanza BadRequestException con mensaje exacto si la entrega ya fue ENTREGADO', async () => {
    tx.entrega.findUnique.mockResolvedValue({
      id: 1,
      estado: DeliveryStatus.ENTREGADO,
    });

    await expect(
      service.registerDelivery(1, { estado: 'ENTREGADO' }, 1),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.registerDelivery(1, { estado: 'ENTREGADO' }, 1),
    ).rejects.toThrow('La entrega ya fue registrada. Estado actual: ENTREGADO');
  });

  it('lanza BadRequestException con mensaje exacto si la entrega ya fue NOVEDAD', async () => {
    tx.entrega.findUnique.mockResolvedValue({
      id: 1,
      estado: DeliveryStatus.NOVEDAD,
    });

    await expect(
      service.registerDelivery(1, { estado: 'ENTREGADO' }, 1),
    ).rejects.toThrow('La entrega ya fue registrada. Estado actual: NOVEDAD');
  });

  it('mapea ENTREGADO → DELIVERED y DeliveryStatus.ENTREGADO', async () => {
    // Arrange
    tx.entrega.findUnique.mockResolvedValue({
      id: 1,
      estado: DeliveryStatus.PENDIENTE,
    });
    tx.entrega.update.mockResolvedValue({
      id: 1,
      pedido: { id: 5, cliente: {} },
    });
    tx.pedido.findUniqueOrThrow.mockResolvedValue({
      estado: OrderStatus.ON_ROUTE,
    });
    tx.pedido.update.mockResolvedValue({});
    tx.estadoPedidoLog.create.mockResolvedValue({});
    tx.pedido.findUnique.mockResolvedValue({ hojaCargaId: 100 });

    // Act
    await service.registerDelivery(5, { estado: 'ENTREGADO' }, 9);

    // Assert
    expect(tx.entrega.update).toHaveBeenCalledWith(
      objectMatching({
        where: { pedidoId: 5 },
        data: objectMatching({
          estado: DeliveryStatus.ENTREGADO,
          observacion: undefined,
          registradoPorId: 9,
        }),
      }),
    );
    expect(tx.pedido.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { estado: OrderStatus.DELIVERED },
    });
  });

  it('mapea NOVEDAD → ISSUE y DeliveryStatus.NOVEDAD', async () => {
    // Arrange
    tx.entrega.findUnique.mockResolvedValue({
      id: 1,
      estado: DeliveryStatus.PENDIENTE,
    });
    tx.entrega.update.mockResolvedValue({
      id: 1,
      pedido: { id: 5, cliente: {} },
    });
    tx.pedido.findUniqueOrThrow.mockResolvedValue({
      estado: OrderStatus.ON_ROUTE,
    });
    tx.pedido.update.mockResolvedValue({});
    tx.estadoPedidoLog.create.mockResolvedValue({});
    tx.pedido.findUnique.mockResolvedValue({ hojaCargaId: 100 });

    // Act
    await service.registerDelivery(
      5,
      { estado: 'NOVEDAD', observacion: 'Cliente ausente' },
      9,
    );

    // Assert
    expect(tx.entrega.update).toHaveBeenCalledWith(
      objectMatching({
        where: { pedidoId: 5 },
        data: objectMatching({
          estado: DeliveryStatus.NOVEDAD,
          observacion: 'Cliente ausente',
        }),
      }),
    );
    expect(tx.pedido.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { estado: OrderStatus.ISSUE },
    });
  });

  it('rechaza con mensaje exacto si la transición de pedido es inválida', async () => {
    // Arrange — pedido en CONFIRMED no puede ir a DELIVERED
    tx.entrega.findUnique.mockResolvedValue({
      id: 1,
      estado: DeliveryStatus.PENDIENTE,
    });
    tx.entrega.update.mockResolvedValue({
      id: 1,
      pedido: { id: 5, cliente: {} },
    });
    tx.pedido.findUniqueOrThrow.mockResolvedValue({
      estado: OrderStatus.CONFIRMED,
    });

    // Act & Assert
    await expect(
      service.registerDelivery(5, { estado: 'ENTREGADO' }, 9),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.registerDelivery(5, { estado: 'ENTREGADO' }, 9),
    ).rejects.toThrow('No se puede transicionar de CONFIRMED a DELIVERED');
  });

  it('crea log con motivo "Entrega registrada por chofer" y estado correcto', async () => {
    // Arrange
    tx.entrega.findUnique.mockResolvedValue({
      id: 1,
      estado: DeliveryStatus.PENDIENTE,
    });
    tx.entrega.update.mockResolvedValue({
      id: 1,
      pedido: { id: 5, cliente: {} },
    });
    tx.pedido.findUniqueOrThrow.mockResolvedValue({
      estado: OrderStatus.ON_ROUTE,
    });
    tx.pedido.findUnique.mockResolvedValue({ hojaCargaId: 100 });

    // Act
    await service.registerDelivery(5, { estado: 'ENTREGADO' }, 42);

    // Assert
    expect(tx.estadoPedidoLog.create).toHaveBeenCalledWith({
      data: {
        pedidoId: 5,
        estadoAnterior: OrderStatus.ON_ROUTE,
        estadoNuevo: OrderStatus.DELIVERED,
        motivo: 'Entrega registrada por chofer. Estado: ENTREGADO',
        usuarioId: 42,
      },
    });
  });

  it('completa la hoja a COMPLETADO cuando no quedan entregas pendientes', async () => {
    // Arrange — entrega.count devuelve 0 (no quedan pendientes)
    tx.entrega.findUnique.mockResolvedValue({
      id: 1,
      estado: DeliveryStatus.PENDIENTE,
    });
    tx.entrega.update.mockResolvedValue({
      id: 1,
      pedido: { id: 5, cliente: {} },
    });
    tx.pedido.findUniqueOrThrow.mockResolvedValue({
      estado: OrderStatus.ON_ROUTE,
    });
    tx.pedido.findUnique.mockResolvedValue({ hojaCargaId: 100 });
    tx.entrega.count.mockResolvedValue(0);

    // Act
    await service.registerDelivery(5, { estado: 'ENTREGADO' }, 9);

    // Assert
    expect(tx.entrega.count).toHaveBeenCalledWith({
      where: {
        pedido: { hojaCargaId: 100 },
        estado: 'PENDIENTE',
      },
    });
    expect(tx.hojaCarga.update).toHaveBeenCalledWith({
      where: { id: 100 },
      data: { estado: 'COMPLETADO' },
    });
  });

  it('NO completa la hoja si todavía quedan entregas pendientes', async () => {
    // Arrange — entrega.count devuelve > 0
    tx.entrega.findUnique.mockResolvedValue({
      id: 1,
      estado: DeliveryStatus.PENDIENTE,
    });
    tx.entrega.update.mockResolvedValue({
      id: 1,
      pedido: { id: 5, cliente: {} },
    });
    tx.pedido.findUniqueOrThrow.mockResolvedValue({
      estado: OrderStatus.ON_ROUTE,
    });
    tx.pedido.findUnique.mockResolvedValue({ hojaCargaId: 100 });
    tx.entrega.count.mockResolvedValue(2);

    // Act
    await service.registerDelivery(5, { estado: 'ENTREGADO' }, 9);

    // Assert — hoja.update NO se llama (sigue en EN_RUTA)
    expect(tx.hojaCarga.update).not.toHaveBeenCalled();
  });

  it('NO completa la hoja si el pedido no tiene hojaCargaId asignada', async () => {
    // Arrange
    tx.entrega.findUnique.mockResolvedValue({
      id: 1,
      estado: DeliveryStatus.PENDIENTE,
    });
    tx.entrega.update.mockResolvedValue({
      id: 1,
      pedido: { id: 5, cliente: {} },
    });
    tx.pedido.findUniqueOrThrow.mockResolvedValue({
      estado: OrderStatus.ON_ROUTE,
    });
    tx.pedido.findUnique.mockResolvedValue({ hojaCargaId: null });

    // Act
    await service.registerDelivery(5, { estado: 'ENTREGADO' }, 9);

    // Assert — early return: count NUNCA se llama, ni se update la hoja
    expect(tx.entrega.count).not.toHaveBeenCalled();
    expect(tx.hojaCarga.update).not.toHaveBeenCalled();
  });

  it('NO completa la hoja si el pedido es null (kills optional chaining mutant)', async () => {
    // Arrange — pedido.findUnique devuelve null (defense in depth)
    tx.entrega.findUnique.mockResolvedValue({
      id: 1,
      estado: DeliveryStatus.PENDIENTE,
    });
    tx.entrega.update.mockResolvedValue({
      id: 1,
      pedido: { id: 5, cliente: {} },
    });
    tx.pedido.findUniqueOrThrow.mockResolvedValue({
      estado: OrderStatus.ON_ROUTE,
    });
    // KEY: pedido findUnique en checkAndCompleteHoja devuelve null
    tx.pedido.findUnique.mockResolvedValue(null);

    // Act
    await service.registerDelivery(5, { estado: 'ENTREGADO' }, 9);

    // Assert — sin pedido, no se cuenta ni completa hoja (optional chaining kicks in)
    expect(tx.entrega.count).not.toHaveBeenCalled();
    expect(tx.hojaCarga.update).not.toHaveBeenCalled();
  });

  it('count en checkAndCompleteHoja: where exacto con hojaCargaId y estado=PENDIENTE', async () => {
    // Arrange
    tx.entrega.findUnique.mockResolvedValue({
      id: 1,
      estado: DeliveryStatus.PENDIENTE,
    });
    tx.entrega.update.mockResolvedValue({
      id: 1,
      pedido: { id: 5, cliente: {} },
    });
    tx.pedido.findUniqueOrThrow.mockResolvedValue({
      estado: OrderStatus.ON_ROUTE,
    });
    tx.pedido.findUnique.mockResolvedValue({ hojaCargaId: 100 });
    tx.entrega.count.mockResolvedValue(2); // hay pendientes

    // Act
    await service.registerDelivery(5, { estado: 'ENTREGADO' }, 9);

    // Assert — kills "where: {}" + StringLiteral PENDIENTE → ""
    expect(tx.entrega.count).toHaveBeenCalledWith({
      where: {
        pedido: { hojaCargaId: 100 },
        estado: 'PENDIENTE',
      },
    });
  });

  it('include exacto en entrega.update: pedido.cliente {id, razonSocial}', async () => {
    // Arrange
    tx.entrega.findUnique.mockResolvedValue({
      id: 1,
      estado: DeliveryStatus.PENDIENTE,
    });
    tx.entrega.update.mockResolvedValue({
      id: 1,
      pedido: { id: 5, cliente: {} },
    });
    tx.pedido.findUniqueOrThrow.mockResolvedValue({
      estado: OrderStatus.ON_ROUTE,
    });
    tx.pedido.findUnique.mockResolvedValue({ hojaCargaId: 100 });

    // Act
    await service.registerDelivery(5, { estado: 'ENTREGADO' }, 9);

    // Assert — kills ObjectLiteral + BooleanLiteral en select de cliente
    const args = firstCallArg<{
      include: {
        pedido: {
          include: {
            cliente: { select: { id: boolean; razonSocial: boolean } };
          };
        };
      };
    }>(tx.entrega.update);
    expect(args.include.pedido.include.cliente.select).toEqual({
      id: true,
      razonSocial: true,
    });
  });

  it('findUniqueOrThrow del pedido: where exacto y select.estado=true', async () => {
    // Arrange
    tx.entrega.findUnique.mockResolvedValue({
      id: 1,
      estado: DeliveryStatus.PENDIENTE,
    });
    tx.entrega.update.mockResolvedValue({
      id: 1,
      pedido: { id: 5, cliente: {} },
    });
    tx.pedido.findUniqueOrThrow.mockResolvedValue({
      estado: OrderStatus.ON_ROUTE,
    });
    tx.pedido.findUnique.mockResolvedValue({ hojaCargaId: 100 });

    // Act
    await service.registerDelivery(5, { estado: 'ENTREGADO' }, 9);

    // Assert — kills "where: {}" + select boolean mutants
    expect(tx.pedido.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 5 },
      select: { estado: true },
    });
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
    expect(tx.ruta.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(tx.vehiculo.findUnique).toHaveBeenCalledWith({ where: { id: 2 } });
    expect(tx.chofer.findUnique).toHaveBeenCalledWith({ where: { id: 3 } });
    expect(tx.pedido.findMany).toHaveBeenCalledWith(
      objectMatching({
        where: { id: { in: [10, 20] } },
        include: { detalles: true },
      }),
    );
    expect(tx.hojaCarga.create).toHaveBeenCalledWith(
      objectMatching({
        data: objectMatching({
          rutaId: 1,
          vehiculoId: 2,
          choferId: 3,
          estado: DispatchStatus.PREPARANDO,
          totalKg: 8, // 5 + 3
          creadoPorId: 7,
          fecha: new Date('2026-05-10'),
        }),
      }),
    );
    expect(tx.pedido.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [10, 20] } },
      data: { hojaCargaId: 500 },
    });
    // Final findUnique con includes completos
    expect(tx.hojaCarga.findUnique).toHaveBeenCalledWith(
      objectMatching({
        where: { id: 500 },
        include: objectMatching({
          pedidos: anyObject(),
          ruta: anyObject(),
          vehiculo: anyObject(),
          chofer: anyObject(),
        }),
      }),
    );
  });

  it('rechaza con NotFoundException + mensaje exacto si algún pedidoId no existe', async () => {
    // Arrange
    tx.ruta.findUnique.mockResolvedValue({ id: 1, activa: true });
    tx.vehiculo.findUnique.mockResolvedValue({
      id: 2,
      activo: true,
      capacidadKg: dec(100),
    });
    tx.chofer.findUnique.mockResolvedValue({ id: 3, activo: true });
    tx.pedido.findMany.mockResolvedValue([
      buildPedidoForCreate(10, OrderStatus.CONFIRMED, [{ cantidad: 5 }]),
    ]);

    // Act & Assert
    await expect(service.create(validDto, 1)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.create(validDto, 1)).rejects.toThrow(
      'Uno o más pedidos no fueron encontrados',
    );
    expect(tx.hojaCarga.create).not.toHaveBeenCalled();
  });

  it('rechaza con BadRequestException + mensaje listando ids no CONFIRMED', async () => {
    // Arrange
    tx.ruta.findUnique.mockResolvedValue({ id: 1, activa: true });
    tx.vehiculo.findUnique.mockResolvedValue({
      id: 2,
      activo: true,
      capacidadKg: dec(100),
    });
    tx.chofer.findUnique.mockResolvedValue({ id: 3, activo: true });
    tx.pedido.findMany.mockResolvedValue([
      buildPedidoForCreate(10, OrderStatus.CONFIRMED, [{ cantidad: 5 }]),
      buildPedidoForCreate(20, OrderStatus.REGISTERED, [{ cantidad: 3 }]),
    ]);

    // Act & Assert
    await expect(service.create(validDto, 1)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.create(validDto, 1)).rejects.toThrow(
      'Los siguientes pedidos no están en estado CONFIRMED: 20',
    );
    expect(tx.hojaCarga.create).not.toHaveBeenCalled();
  });

  it('rechaza con BadRequestException + mensaje exacto listando ids ya asignados', async () => {
    // Arrange — pedido 20 ya tiene hojaCargaId
    tx.ruta.findUnique.mockResolvedValue({ id: 1, activa: true });
    tx.vehiculo.findUnique.mockResolvedValue({
      id: 2,
      activo: true,
      capacidadKg: dec(100),
    });
    tx.chofer.findUnique.mockResolvedValue({ id: 3, activo: true });
    tx.pedido.findMany.mockResolvedValue([
      buildPedidoForCreate(10, OrderStatus.CONFIRMED, [{ cantidad: 5 }]),
      buildPedidoForCreate(20, OrderStatus.CONFIRMED, [{ cantidad: 3 }], 999),
    ]);

    // Act & Assert
    await expect(service.create(validDto, 1)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.create(validDto, 1)).rejects.toThrow(
      'Los siguientes pedidos ya están asignados a otra hoja de carga: 20',
    );
    expect(tx.hojaCarga.create).not.toHaveBeenCalled();
  });

  it('rechaza con mensaje exacto si el peso total excede la capacidad del vehículo', async () => {
    // Arrange — totalKg=200 pero vehículo capacidad=100
    tx.pedido.findMany.mockResolvedValue([
      buildPedidoForCreate(10, OrderStatus.CONFIRMED, [{ cantidad: 200 }]),
      buildPedidoForCreate(20, OrderStatus.CONFIRMED, [{ cantidad: 0.01 }]),
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
    await expect(service.create(validDto, 1)).rejects.toThrow(
      'El peso total (200.01 kg) excede la capacidad del vehículo (100 kg)',
    );
    expect(tx.hojaCarga.create).not.toHaveBeenCalled();
  });

  it('rechaza con mensaje exacto si la ruta no existe', async () => {
    // Arrange
    tx.ruta.findUnique.mockResolvedValue(null);

    // Act & Assert
    await expect(service.create(validDto, 1)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.create(validDto, 1)).rejects.toThrow(
      'Ruta no encontrada o inactiva',
    );
    // Fail-fast: ni siquiera se consulta vehículo
    expect(tx.vehiculo.findUnique).not.toHaveBeenCalled();
  });

  it('rechaza con mensaje exacto si la ruta está inactiva', async () => {
    // Arrange
    tx.ruta.findUnique.mockResolvedValue({ id: 1, activa: false });

    // Act & Assert
    await expect(service.create(validDto, 1)).rejects.toThrow(
      'Ruta no encontrada o inactiva',
    );
    expect(tx.vehiculo.findUnique).not.toHaveBeenCalled();
  });

  it('rechaza con mensaje exacto si el vehículo no existe', async () => {
    // Arrange
    tx.ruta.findUnique.mockResolvedValue({ id: 1, activa: true });
    tx.vehiculo.findUnique.mockResolvedValue(null);

    // Act & Assert
    await expect(service.create(validDto, 1)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.create(validDto, 1)).rejects.toThrow(
      'Vehículo no encontrado o inactivo',
    );
    // Fail-fast: ni siquiera se consulta chofer
    expect(tx.chofer.findUnique).not.toHaveBeenCalled();
  });

  it('rechaza con mensaje exacto si el vehículo está inactivo', async () => {
    // Arrange
    tx.ruta.findUnique.mockResolvedValue({ id: 1, activa: true });
    tx.vehiculo.findUnique.mockResolvedValue({
      id: 2,
      activo: false,
      capacidadKg: dec(100),
    });

    // Act & Assert
    await expect(service.create(validDto, 1)).rejects.toThrow(
      'Vehículo no encontrado o inactivo',
    );
  });

  it('rechaza con mensaje exacto si el chofer no existe', async () => {
    // Arrange
    tx.ruta.findUnique.mockResolvedValue({ id: 1, activa: true });
    tx.vehiculo.findUnique.mockResolvedValue({
      id: 2,
      activo: true,
      capacidadKg: dec(100),
    });
    tx.chofer.findUnique.mockResolvedValue(null);

    // Act & Assert
    await expect(service.create(validDto, 1)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.create(validDto, 1)).rejects.toThrow(
      'Chofer no encontrado o inactivo',
    );
    // Fail-fast: ni siquiera se consultan los pedidos
    expect(tx.pedido.findMany).not.toHaveBeenCalled();
  });

  it('rechaza con mensaje exacto si el chofer está inactivo', async () => {
    // Arrange
    tx.ruta.findUnique.mockResolvedValue({ id: 1, activa: true });
    tx.vehiculo.findUnique.mockResolvedValue({
      id: 2,
      activo: true,
      capacidadKg: dec(100),
    });
    tx.chofer.findUnique.mockResolvedValue({ id: 3, activo: false });

    // Act & Assert
    await expect(service.create(validDto, 1)).rejects.toThrow(
      'Chofer no encontrado o inactivo',
    );
  });

  it('permite peso EXACTAMENTE igual a la capacidad (boundary)', async () => {
    // Arrange — totalKg=100 = capacidad=100 → debe permitir
    tx.pedido.findMany.mockResolvedValue([
      buildPedidoForCreate(10, OrderStatus.CONFIRMED, [{ cantidad: 100 }]),
      buildPedidoForCreate(20, OrderStatus.CONFIRMED, [{ cantidad: 0 }]),
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
    tx.hojaCarga.findUnique.mockResolvedValue({ id: 500 });

    // Act
    const result = await service.create(validDto, 1);

    // Assert — la hoja se creó (no lanzó excepción)
    expect(result).toBeDefined();
    expect(tx.hojaCarga.create).toHaveBeenCalled();
  });

  it('include exacto en findUnique final: pedidos.cliente, ruta, vehiculo, chofer con selects exactos', async () => {
    // Arrange
    setupValidContext();

    // Act
    await service.create(validDto, 1);

    // Assert — kills ObjectLiteral + BooleanLiteral en TODOS los selects del find final
    const args = firstCallArg<{
      include: {
        pedidos: {
          include: {
            cliente: { select: { id: boolean; razonSocial: boolean } };
          };
        };
        ruta: { select: { id: boolean; nombre: boolean; zona: boolean } };
        vehiculo: {
          select: {
            id: boolean;
            placa: boolean;
            marca: boolean;
            modelo: boolean;
          };
        };
        chofer: {
          select: { id: boolean; nombre: boolean; apellido: boolean };
        };
      };
    }>(tx.hojaCarga.findUnique);
    expect(args.include.pedidos.include.cliente.select).toEqual({
      id: true,
      razonSocial: true,
    });
    expect(args.include.ruta.select).toEqual({
      id: true,
      nombre: true,
      zona: true,
    });
    expect(args.include.vehiculo.select).toEqual({
      id: true,
      placa: true,
      marca: true,
      modelo: true,
    });
    expect(args.include.chofer.select).toEqual({
      id: true,
      nombre: true,
      apellido: true,
    });
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
      .mockResolvedValueOnce(hoja)
      .mockResolvedValueOnce({ id: 100, estado: DispatchStatus.DESPACHADO });
    tx.pedido.update.mockResolvedValue({});
    tx.estadoPedidoLog.create.mockResolvedValue({});
    tx.entrega.create.mockResolvedValue({});
    tx.hojaCarga.update.mockResolvedValue({});

    // Act
    await service.confirmDispatch(100, {}, 9);

    // Assert
    expect(tx.hojaCarga.findUnique).toHaveBeenCalledWith(
      objectMatching({
        where: { id: 100 },
        include: objectMatching({
          pedidos: anyObject(),
        }),
      }),
    );
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

  it('lanza NotFoundException con mensaje exacto cuando la hoja no existe', async () => {
    // Arrange
    tx.hojaCarga.findUnique.mockResolvedValue(null);

    // Act & Assert
    await expect(service.confirmDispatch(999, {}, 1)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.confirmDispatch(999, {}, 1)).rejects.toThrow(
      'Hoja de carga no encontrada',
    );
    expect(tx.pedido.update).not.toHaveBeenCalled();
    expect(tx.entrega.create).not.toHaveBeenCalled();
  });

  it('lanza BadRequestException con mensaje exacto si la hoja no está en PREPARANDO', async () => {
    // Arrange
    const hoja = buildHojaForConfirm(DispatchStatus.DESPACHADO, [1]);
    tx.hojaCarga.findUnique.mockResolvedValue(hoja);

    // Act & Assert
    await expect(service.confirmDispatch(100, {}, 1)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.confirmDispatch(100, {}, 1)).rejects.toThrow(
      'Solo se puede confirmar una hoja en estado PREPARANDO. Estado actual: DESPACHADO',
    );
    expect(tx.pedido.update).not.toHaveBeenCalled();
    expect(tx.entrega.create).not.toHaveBeenCalled();
  });

  it('lanza BadRequestException si la hoja está en EN_RUTA', async () => {
    // Arrange
    const hoja = buildHojaForConfirm(DispatchStatus.EN_RUTA, [1]);
    tx.hojaCarga.findUnique.mockResolvedValue(hoja);

    // Act & Assert
    await expect(service.confirmDispatch(100, {}, 1)).rejects.toThrow(
      'Solo se puede confirmar una hoja en estado PREPARANDO. Estado actual: EN_RUTA',
    );
  });

  it('include exacto en primer findUnique: pedidos.detalles.producto {id, nombre, unidadMedida}', async () => {
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

    // Assert — kills ObjectLiteral + BooleanLiteral del primer findUnique (con detalles.producto)
    const calls = tx.hojaCarga.findUnique.mock.calls as unknown as Array<
      [
        {
          where: { id: number };
          include: {
            pedidos: {
              include: {
                detalles: {
                  include: {
                    producto: {
                      select: {
                        id: boolean;
                        nombre: boolean;
                        unidadMedida: boolean;
                      };
                    };
                  };
                };
              };
            };
          };
        },
      ]
    >;
    const firstArgs = calls[0][0];
    expect(firstArgs.where).toEqual({ id: 100 });
    expect(
      firstArgs.include.pedidos.include.detalles.include.producto.select,
    ).toEqual({ id: true, nombre: true, unidadMedida: true });
  });

  it('include exacto en findUnique final: ruta, vehiculo, chofer y pedidos.{cliente, entrega}', async () => {
    // Arrange
    const hoja = buildHojaForConfirm(DispatchStatus.PREPARANDO, [1]);
    tx.hojaCarga.findUnique
      .mockResolvedValueOnce(hoja)
      .mockResolvedValueOnce({ id: 100 });
    tx.pedido.update.mockResolvedValue({});
    tx.estadoPedidoLog.create.mockResolvedValue({});
    tx.entrega.create.mockResolvedValue({});
    tx.hojaCarga.update.mockResolvedValue({});

    // Act
    await service.confirmDispatch(100, {}, 9);

    // Assert — segundo findUnique (return final)
    const calls = tx.hojaCarga.findUnique.mock.calls as unknown as Array<
      [
        {
          where: { id: number };
          include: {
            pedidos: {
              include: {
                cliente: {
                  select: { id: boolean; razonSocial: boolean };
                };
                entrega: { select: { id: boolean; estado: boolean } };
              };
            };
            ruta: {
              select: { id: boolean; nombre: boolean; zona: boolean };
            };
            vehiculo: {
              select: {
                id: boolean;
                placa: boolean;
                marca: boolean;
                modelo: boolean;
              };
            };
            chofer: {
              select: {
                id: boolean;
                nombre: boolean;
                apellido: boolean;
              };
            };
          };
        },
      ]
    >;
    const secondArgs = calls[1][0];
    expect(secondArgs.include.pedidos.include.cliente.select).toEqual({
      id: true,
      razonSocial: true,
    });
    expect(secondArgs.include.pedidos.include.entrega.select).toEqual({
      id: true,
      estado: true,
    });
    expect(secondArgs.include.ruta.select).toEqual({
      id: true,
      nombre: true,
      zona: true,
    });
    expect(secondArgs.include.vehiculo.select).toEqual({
      id: true,
      placa: true,
      marca: true,
      modelo: true,
    });
    expect(secondArgs.include.chofer.select).toEqual({
      id: true,
      nombre: true,
      apellido: true,
    });
  });
});

// =====================================================================
// getOrdersGroupedByRoute
// =====================================================================

describe('DispatchService — getOrdersGroupedByRoute', () => {
  let service: DispatchService;
  let prisma: { pedido: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { pedido: { findMany: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatchService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DispatchService>(DispatchService);
  });

  const buildPedidoConRuta = (opts: {
    id: number;
    rutaId: number | null;
    rutaNombre?: string;
    rutaZona?: string;
    cantidades: number[];
  }) => ({
    id: opts.id,
    cliente: {
      id: 1,
      razonSocial: `Cliente ${opts.id}`,
      direccion: 'Av. Falsa 123',
      telefono: '999999999',
      ruta: opts.rutaId
        ? {
            id: opts.rutaId,
            nombre: opts.rutaNombre ?? `Ruta ${opts.rutaId}`,
            zona: opts.rutaZona ?? 'Zona X',
          }
        : null,
    },
    detalles: opts.cantidades.map((c, idx) => ({
      productoId: idx + 1,
      cantidad: dec(c),
      producto: { id: idx + 1, nombre: `Prod ${idx + 1}` },
    })),
  });

  it('filtra por estado CONFIRMED y rango [day, nextDay)', async () => {
    // Arrange
    prisma.pedido.findMany.mockResolvedValue([]);

    // Act
    await service.getOrdersGroupedByRoute('2026-05-10');

    // Assert — verifica el WHERE exacto (kills "where: {}" mutant)
    const args = firstCallArg<{
      where: { estado: string; fechaEntrega: { gte: Date; lt: Date } };
      include: object;
    }>(prisma.pedido.findMany);
    expect(args.where.estado).toBe(OrderStatus.CONFIRMED);
    expect(args.where.fechaEntrega.gte).toBeInstanceOf(Date);
    expect(args.where.fechaEntrega.lt).toBeInstanceOf(Date);
    expect(args.where.fechaEntrega.gte.toISOString()).toBe(
      '2026-05-10T00:00:00.000Z',
    );
    expect(args.where.fechaEntrega.lt.toISOString()).toBe(
      '2026-05-11T00:00:00.000Z',
    );
  });

  it('agrupa pedidos por ruta y suma totalKg correctamente', async () => {
    // Arrange — 2 pedidos en la misma ruta con cantidades distintas
    prisma.pedido.findMany.mockResolvedValue([
      buildPedidoConRuta({
        id: 1,
        rutaId: 100,
        rutaNombre: 'Ruta Centro',
        cantidades: [5, 3],
      }),
      buildPedidoConRuta({
        id: 2,
        rutaId: 100,
        rutaNombre: 'Ruta Centro',
        cantidades: [10],
      }),
      buildPedidoConRuta({
        id: 3,
        rutaId: 200,
        rutaNombre: 'Ruta Sur',
        cantidades: [2],
      }),
    ]);

    // Act
    const result = await service.getOrdersGroupedByRoute('2026-05-10');

    // Assert
    expect(result).toHaveLength(2);
    const rutaCentro = result.find((g) => g.ruta.id === 100);
    const rutaSur = result.find((g) => g.ruta.id === 200);
    expect(rutaCentro?.pedidos).toHaveLength(2);
    expect(rutaCentro?.totalKg).toBe(18); // 5+3 + 10
    expect(rutaCentro?.ruta.nombre).toBe('Ruta Centro');
    expect(rutaSur?.pedidos).toHaveLength(1);
    expect(rutaSur?.totalKg).toBe(2);
  });

  it('omite pedidos cuyo cliente no tiene ruta asignada', async () => {
    // Arrange
    prisma.pedido.findMany.mockResolvedValue([
      buildPedidoConRuta({
        id: 1,
        rutaId: 100,
        cantidades: [5],
      }),
      buildPedidoConRuta({
        id: 2,
        rutaId: null, // sin ruta
        cantidades: [99],
      }),
    ]);

    // Act
    const result = await service.getOrdersGroupedByRoute('2026-05-10');

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].pedidos).toHaveLength(1);
    expect(result[0].pedidos[0].id).toBe(1);
  });

  it('mapea cliente y detalles del pedido al RouteGroup (todos los campos)', async () => {
    // Arrange
    prisma.pedido.findMany.mockResolvedValue([
      buildPedidoConRuta({
        id: 7,
        rutaId: 1,
        cantidades: [12.5, 0.5],
      }),
    ]);

    // Act
    const result = await service.getOrdersGroupedByRoute('2026-05-10');

    // Assert — kills mutaciones de campos individuales en pedidoData.cliente
    const pedido = result[0].pedidos[0];
    expect(pedido.id).toBe(7);
    expect(pedido.cliente).toEqual({
      id: 1, // builder fija cliente.id=1
      razonSocial: 'Cliente 7',
      direccion: 'Av. Falsa 123',
      telefono: '999999999',
    });
    expect(pedido.detalles).toHaveLength(2);
    expect(pedido.detalles[0].cantidad).toBe(12.5);
    expect(pedido.detalles[0].productoId).toBe(1);
    expect(pedido.detalles[0].producto).toEqual({ id: 1, nombre: 'Prod 1' });
    expect(pedido.detalles[1].cantidad).toBe(0.5);
    expect(result[0].totalKg).toBe(13);
    // ruta también mapeada
    expect(result[0].ruta).toEqual({
      id: 1,
      nombre: 'Ruta 1',
      zona: 'Zona X',
    });
  });

  it('devuelve array vacío cuando no hay pedidos confirmados', async () => {
    // Arrange
    prisma.pedido.findMany.mockResolvedValue([]);

    // Act
    const result = await service.getOrdersGroupedByRoute('2026-05-10');

    // Assert
    expect(result).toEqual([]);
  });

  it('include exacto: cliente.{id, razonSocial, direccion, telefono, ruta} y detalles.producto', async () => {
    // Arrange
    prisma.pedido.findMany.mockResolvedValue([]);

    // Act
    await service.getOrdersGroupedByRoute('2026-05-10');

    // Assert — kills ObjectLiteral + BooleanLiteral en TODOS los selects anidados
    const args = firstCallArg<{
      include: {
        cliente: {
          select: {
            id: boolean;
            razonSocial: boolean;
            direccion: boolean;
            telefono: boolean;
            ruta: {
              select: { id: boolean; nombre: boolean; zona: boolean };
            };
          };
        };
        detalles: {
          include: {
            producto: { select: { id: boolean; nombre: boolean } };
          };
        };
      };
    }>(prisma.pedido.findMany);
    expect(args.include.cliente.select).toEqual({
      id: true,
      razonSocial: true,
      direccion: true,
      telefono: true,
      ruta: { select: { id: true, nombre: true, zona: true } },
    });
    expect(args.include.detalles.include.producto.select).toEqual({
      id: true,
      nombre: true,
    });
  });
});

// =====================================================================
// findAll (hojas de carga)
// =====================================================================

describe('DispatchService — findAll', () => {
  let service: DispatchService;
  let prisma: {
    hojaCarga: { findMany: jest.Mock; count: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      hojaCarga: { findMany: jest.fn(), count: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatchService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<DispatchService>(DispatchService);
  });

  it('sin fecha: usa where vacío y defaults page=1 pageSize=20', async () => {
    // Arrange
    prisma.hojaCarga.findMany.mockResolvedValue([]);
    prisma.hojaCarga.count.mockResolvedValue(0);

    // Act
    const result = await service.findAll();

    // Assert
    expect(result).toEqual({ data: [], total: 0, page: 1, pageSize: 20 });
    expect(prisma.hojaCarga.findMany).toHaveBeenCalledWith(
      objectMatching({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { fecha: 'desc' },
        include: objectMatching({
          ruta: anyObject(),
          vehiculo: anyObject(),
          chofer: anyObject(),
          _count: { select: { pedidos: true } },
        }),
      }),
    );
    expect(prisma.hojaCarga.count).toHaveBeenCalledWith({ where: {} });
  });

  it('con fecha: aplica rango fechaEntrega [day, nextDay)', async () => {
    // Arrange
    prisma.hojaCarga.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.hojaCarga.count.mockResolvedValue(1);

    // Act
    const result = await service.findAll('2026-05-10');

    // Assert
    expect(result.total).toBe(1);
    const args = firstCallArg<{
      where: { fecha: { gte: Date; lt: Date } };
    }>(prisma.hojaCarga.findMany);
    expect(args.where.fecha.gte.toISOString()).toBe('2026-05-10T00:00:00.000Z');
    expect(args.where.fecha.lt.toISOString()).toBe('2026-05-11T00:00:00.000Z');
    // count debe usar el MISMO where (kills "count(where:{})" mutant)
    expect(prisma.hojaCarga.count).toHaveBeenCalledWith(
      objectMatching({
        where: objectMatching({
          fecha: objectMatching({
            gte: expect.any(Date) as Date,
            lt: expect.any(Date) as Date,
          }),
        }),
      }),
    );
  });

  it('aplica skip = (page-1) * pageSize correctamente', async () => {
    // Arrange
    prisma.hojaCarga.findMany.mockResolvedValue([]);
    prisma.hojaCarga.count.mockResolvedValue(0);

    // Act
    await service.findAll(undefined, 4, 25);

    // Assert
    expect(prisma.hojaCarga.findMany).toHaveBeenCalledWith(
      objectMatching({
        skip: 75, // (4-1) * 25
        take: 25,
      }),
    );
  });

  it('include exacto: ruta, vehiculo, chofer y _count.pedidos', async () => {
    // Arrange
    prisma.hojaCarga.findMany.mockResolvedValue([]);
    prisma.hojaCarga.count.mockResolvedValue(0);

    // Act
    await service.findAll();

    // Assert — kills ObjectLiteral + BooleanLiteral en selects del include
    const args = firstCallArg<{
      include: {
        ruta: { select: { id: boolean; nombre: boolean; zona: boolean } };
        vehiculo: {
          select: { id: boolean; placa: boolean; marca: boolean };
        };
        chofer: {
          select: { id: boolean; nombre: boolean; apellido: boolean };
        };
        _count: { select: { pedidos: boolean } };
      };
      orderBy: { fecha: 'desc' | 'asc' };
    }>(prisma.hojaCarga.findMany);
    expect(args.include.ruta.select).toEqual({
      id: true,
      nombre: true,
      zona: true,
    });
    expect(args.include.vehiculo.select).toEqual({
      id: true,
      placa: true,
      marca: true,
    });
    expect(args.include.chofer.select).toEqual({
      id: true,
      nombre: true,
      apellido: true,
    });
    expect(args.include._count.select).toEqual({ pedidos: true });
    expect(args.orderBy).toEqual({ fecha: 'desc' });
  });
});

// =====================================================================
// findOne (hoja de carga)
// =====================================================================

describe('DispatchService — findOne', () => {
  let service: DispatchService;
  let prisma: { hojaCarga: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = { hojaCarga: { findUnique: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatchService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<DispatchService>(DispatchService);
  });

  it('devuelve la hoja con todos los includes', async () => {
    // Arrange
    const hoja = {
      id: 100,
      estado: DispatchStatus.PREPARANDO,
      pedidos: [],
      ruta: {},
      vehiculo: {},
      chofer: {},
      creadoPor: {},
    };
    prisma.hojaCarga.findUnique.mockResolvedValue(hoja);

    // Act
    const result = await service.findOne(100);

    // Assert
    expect(result).toEqual(hoja);
    expect(prisma.hojaCarga.findUnique).toHaveBeenCalledWith(
      objectMatching({
        where: { id: 100 },
        include: objectMatching({
          ruta: anyObject(),
          vehiculo: anyObject(),
          chofer: anyObject(),
          pedidos: anyObject(),
          creadoPor: anyObject(),
        }),
      }),
    );
  });

  it('lanza NotFoundException con mensaje exacto cuando la hoja no existe', async () => {
    // Arrange
    prisma.hojaCarga.findUnique.mockResolvedValue(null);

    // Act & Assert
    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    await expect(service.findOne(999)).rejects.toThrow(
      'Hoja de carga no encontrada',
    );
  });

  it('include exacto: ruta, vehiculo, chofer, pedidos.*, creadoPor con selects exactos', async () => {
    // Arrange
    prisma.hojaCarga.findUnique.mockResolvedValue({
      id: 100,
      pedidos: [],
      ruta: {},
      vehiculo: {},
      chofer: {},
      creadoPor: {},
    });

    // Act
    await service.findOne(100);

    // Assert — kills ObjectLiteral + BooleanLiteral en TODOS los selects
    const args = firstCallArg<{
      include: {
        ruta: { select: { id: boolean; nombre: boolean; zona: boolean } };
        vehiculo: {
          select: {
            id: boolean;
            placa: boolean;
            marca: boolean;
            modelo: boolean;
          };
        };
        chofer: {
          select: {
            id: boolean;
            nombre: boolean;
            apellido: boolean;
            dni: boolean;
            licencia: boolean;
            telefono: boolean;
          };
        };
        pedidos: {
          include: {
            cliente: {
              select: {
                id: boolean;
                razonSocial: boolean;
                direccion: boolean;
                telefono: boolean;
              };
            };
            detalles: {
              include: {
                producto: { select: { id: boolean; nombre: boolean } };
              };
            };
            entrega: {
              select: {
                id: boolean;
                estado: boolean;
                observacion: boolean;
                fechaEntrega: boolean;
              };
            };
          };
        };
        creadoPor: { select: { id: boolean; nombre: boolean } };
      };
    }>(prisma.hojaCarga.findUnique);
    expect(args.include.ruta.select).toEqual({
      id: true,
      nombre: true,
      zona: true,
    });
    expect(args.include.vehiculo.select).toEqual({
      id: true,
      placa: true,
      marca: true,
      modelo: true,
    });
    expect(args.include.chofer.select).toEqual({
      id: true,
      nombre: true,
      apellido: true,
      dni: true,
      licencia: true,
      telefono: true,
    });
    expect(args.include.pedidos.include.cliente.select).toEqual({
      id: true,
      razonSocial: true,
      direccion: true,
      telefono: true,
    });
    expect(
      args.include.pedidos.include.detalles.include.producto.select,
    ).toEqual({ id: true, nombre: true });
    expect(args.include.pedidos.include.entrega.select).toEqual({
      id: true,
      estado: true,
      observacion: true,
      fechaEntrega: true,
    });
    expect(args.include.creadoPor.select).toEqual({
      id: true,
      nombre: true,
    });
  });
});

// =====================================================================
// getRouteSheet
// =====================================================================

describe('DispatchService — getRouteSheet', () => {
  let service: DispatchService;
  let prisma: { hojaCarga: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = { hojaCarga: { findUnique: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatchService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<DispatchService>(DispatchService);
  });

  const buildHojaWithPedidos = (
    pedidos: Array<{ id: number; cantidades: number[] }>,
  ) => ({
    id: 100,
    fecha: new Date('2026-05-10'),
    estado: DispatchStatus.DESPACHADO,
    totalKg: dec(15),
    ruta: { id: 1, nombre: 'Ruta Centro', zona: 'Centro' },
    vehiculo: { placa: 'ABC-123', marca: 'Toyota', modelo: 'Hilux' },
    chofer: {
      nombre: 'Juan',
      apellido: 'Pérez',
      dni: '12345678',
      licencia: 'LIC-001',
      telefono: '999',
    },
    pedidos: pedidos.map((p) => ({
      id: p.id,
      cliente: {
        id: p.id,
        razonSocial: `Cliente ${p.id}`,
        direccion: `Dir ${p.id}`,
        telefono: `tel-${p.id}`,
      },
      detalles: p.cantidades.map((c, idx) => ({
        productoId: idx + 1,
        cantidad: dec(c),
        producto: { id: idx + 1, nombre: `Prod ${idx + 1}` },
      })),
    })),
  });

  it('mapea hoja completa con paradas, ruta, vehiculo, chofer y totalKg', async () => {
    // Arrange
    const hoja = buildHojaWithPedidos([
      { id: 10, cantidades: [5] },
      { id: 20, cantidades: [3, 2] },
    ]);
    prisma.hojaCarga.findUnique.mockResolvedValue(hoja);

    // Act
    const result = await service.getRouteSheet(100);

    // Assert — chequea TODOS los campos (kills mutaciones de cada propiedad)
    expect(result.hoja).toEqual({
      id: 100,
      fecha: new Date('2026-05-10'),
      estado: DispatchStatus.DESPACHADO,
    });
    expect(result.ruta).toEqual({ nombre: 'Ruta Centro', zona: 'Centro' });
    expect(result.vehiculo).toEqual({
      placa: 'ABC-123',
      marca: 'Toyota',
      modelo: 'Hilux',
    });
    expect(result.chofer).toEqual({
      nombre: 'Juan',
      apellido: 'Pérez',
      dni: '12345678',
      licencia: 'LIC-001',
      telefono: '999',
    });
    expect(result.totalKg).toBe(15);
    expect(result.paradas).toHaveLength(2);
    // Cada parada tiene cliente mapeado completo
    expect(result.paradas[0].cliente).toEqual({
      razonSocial: 'Cliente 10',
      direccion: 'Dir 10',
      telefono: 'tel-10',
    });
  });

  it('asigna orden secuencial empezando en 1 a cada parada', async () => {
    // Arrange
    const hoja = buildHojaWithPedidos([
      { id: 10, cantidades: [5] },
      { id: 20, cantidades: [3] },
      { id: 30, cantidades: [1] },
    ]);
    prisma.hojaCarga.findUnique.mockResolvedValue(hoja);

    // Act
    const result = await service.getRouteSheet(100);

    // Assert
    expect(result.paradas.map((p) => p.orden)).toEqual([1, 2, 3]);
    expect(result.paradas[0].pedido.id).toBe(10);
    expect(result.paradas[1].pedido.id).toBe(20);
    expect(result.paradas[2].pedido.id).toBe(30);
  });

  it('mapea productos de cada parada (nombre y cantidad como número)', async () => {
    // Arrange
    const hoja = buildHojaWithPedidos([{ id: 10, cantidades: [5.5, 2.25] }]);
    prisma.hojaCarga.findUnique.mockResolvedValue(hoja);

    // Act
    const result = await service.getRouteSheet(100);

    // Assert
    const productos = result.paradas[0].productos;
    expect(productos).toHaveLength(2);
    expect(productos[0].nombre).toBe('Prod 1');
    expect(productos[0].cantidad).toBe(5.5);
    expect(productos[1].cantidad).toBe(2.25);
  });

  it('ordena pedidos por id ASC en la query', async () => {
    // Arrange
    prisma.hojaCarga.findUnique.mockResolvedValue(
      buildHojaWithPedidos([{ id: 1, cantidades: [1] }]),
    );

    // Act
    await service.getRouteSheet(100);

    // Assert
    expect(prisma.hojaCarga.findUnique).toHaveBeenCalledWith(
      objectMatching({
        where: { id: 100 },
        include: objectMatching({
          pedidos: objectMatching({
            orderBy: { id: 'asc' },
          }),
        }),
      }),
    );
  });

  it('lanza NotFoundException con mensaje exacto cuando la hoja no existe', async () => {
    // Arrange
    prisma.hojaCarga.findUnique.mockResolvedValue(null);

    // Act & Assert
    await expect(service.getRouteSheet(999)).rejects.toThrow(NotFoundException);
    await expect(service.getRouteSheet(999)).rejects.toThrow(
      'Hoja de carga no encontrada',
    );
  });

  it('include exacto: ruta, vehiculo, chofer, pedidos.{cliente, detalles.producto} con selects exactos', async () => {
    // Arrange
    prisma.hojaCarga.findUnique.mockResolvedValue(
      buildHojaWithPedidos([{ id: 1, cantidades: [1] }]),
    );

    // Act
    await service.getRouteSheet(100);

    // Assert — kills ObjectLiteral + BooleanLiteral en TODOS los selects
    const args = firstCallArg<{
      include: {
        ruta: { select: { id: boolean; nombre: boolean; zona: boolean } };
        vehiculo: {
          select: { placa: boolean; marca: boolean; modelo: boolean };
        };
        chofer: {
          select: {
            nombre: boolean;
            apellido: boolean;
            dni: boolean;
            licencia: boolean;
            telefono: boolean;
          };
        };
        pedidos: {
          include: {
            cliente: {
              select: {
                id: boolean;
                razonSocial: boolean;
                direccion: boolean;
                telefono: boolean;
              };
            };
            detalles: {
              include: {
                producto: { select: { id: boolean; nombre: boolean } };
              };
            };
          };
          orderBy: { id: 'asc' | 'desc' };
        };
      };
    }>(prisma.hojaCarga.findUnique);
    expect(args.include.ruta.select).toEqual({
      id: true,
      nombre: true,
      zona: true,
    });
    expect(args.include.vehiculo.select).toEqual({
      placa: true,
      marca: true,
      modelo: true,
    });
    expect(args.include.chofer.select).toEqual({
      nombre: true,
      apellido: true,
      dni: true,
      licencia: true,
      telefono: true,
    });
    expect(args.include.pedidos.include.cliente.select).toEqual({
      id: true,
      razonSocial: true,
      direccion: true,
      telefono: true,
    });
    expect(
      args.include.pedidos.include.detalles.include.producto.select,
    ).toEqual({ id: true, nombre: true });
    expect(args.include.pedidos.orderBy).toEqual({ id: 'asc' });
  });
});

// =====================================================================
// getDeliveryStatus
// =====================================================================

describe('DispatchService — getDeliveryStatus', () => {
  let service: DispatchService;
  let prisma: { hojaCarga: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = { hojaCarga: { findUnique: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatchService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<DispatchService>(DispatchService);
  });

  it('devuelve la lista de entregas mapeadas por pedido', async () => {
    // Arrange
    const hoja = {
      id: 100,
      pedidos: [
        {
          id: 1,
          cliente: { razonSocial: 'Cliente A' },
          entrega: {
            id: 11,
            estado: DeliveryStatus.ENTREGADO,
            observacion: null,
            fechaEntrega: new Date('2026-05-10T10:00:00Z'),
          },
        },
        {
          id: 2,
          cliente: { razonSocial: 'Cliente B' },
          entrega: {
            id: 12,
            estado: DeliveryStatus.NOVEDAD,
            observacion: 'Cliente ausente',
            fechaEntrega: new Date('2026-05-10T11:00:00Z'),
          },
        },
      ],
    };
    prisma.hojaCarga.findUnique.mockResolvedValue(hoja);

    // Act
    const result = await service.getDeliveryStatus(100);

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      pedidoId: 1,
      cliente: { razonSocial: 'Cliente A' },
      entrega: {
        id: 11,
        estado: DeliveryStatus.ENTREGADO,
        observacion: null,
        fechaEntrega: new Date('2026-05-10T10:00:00Z'),
      },
    });
    expect(result[1].entrega?.estado).toBe(DeliveryStatus.NOVEDAD);
    expect(result[1].entrega?.observacion).toBe('Cliente ausente');
  });

  it('mapea entrega como null cuando el pedido no tiene entrega registrada', async () => {
    // Arrange
    const hoja = {
      id: 100,
      pedidos: [
        {
          id: 1,
          cliente: { razonSocial: 'Cliente A' },
          entrega: null,
        },
      ],
    };
    prisma.hojaCarga.findUnique.mockResolvedValue(hoja);

    // Act
    const result = await service.getDeliveryStatus(100);

    // Assert
    expect(result[0].entrega).toBeNull();
    expect(result[0].pedidoId).toBe(1);
  });

  it('llama findUnique con el id correcto y los includes esperados', async () => {
    // Arrange
    prisma.hojaCarga.findUnique.mockResolvedValue({ id: 100, pedidos: [] });

    // Act
    await service.getDeliveryStatus(100);

    // Assert — kills "where: {}" mutant
    expect(prisma.hojaCarga.findUnique).toHaveBeenCalledWith(
      objectMatching({
        where: { id: 100 },
        include: objectMatching({
          pedidos: objectMatching({
            include: objectMatching({
              cliente: anyObject(),
              entrega: anyObject(),
            }),
          }),
        }),
      }),
    );
  });

  it('lanza NotFoundException con mensaje exacto cuando la hoja no existe', async () => {
    // Arrange
    prisma.hojaCarga.findUnique.mockResolvedValue(null);

    // Act & Assert
    await expect(service.getDeliveryStatus(999)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.getDeliveryStatus(999)).rejects.toThrow(
      'Hoja de carga no encontrada',
    );
  });

  it('devuelve array vacío cuando la hoja existe pero no tiene pedidos', async () => {
    // Arrange
    prisma.hojaCarga.findUnique.mockResolvedValue({ id: 100, pedidos: [] });

    // Act
    const result = await service.getDeliveryStatus(100);

    // Assert
    expect(result).toEqual([]);
  });

  it('include exacto: pedidos.{cliente.razonSocial, entrega.{id,estado,observacion,fechaEntrega}}', async () => {
    // Arrange
    prisma.hojaCarga.findUnique.mockResolvedValue({ id: 100, pedidos: [] });

    // Act
    await service.getDeliveryStatus(100);

    // Assert — kills ObjectLiteral + BooleanLiteral en TODOS los selects anidados
    const args = firstCallArg<{
      include: {
        pedidos: {
          include: {
            cliente: { select: { razonSocial: boolean } };
            entrega: {
              select: {
                id: boolean;
                estado: boolean;
                observacion: boolean;
                fechaEntrega: boolean;
              };
            };
          };
        };
      };
    }>(prisma.hojaCarga.findUnique);
    expect(args.include.pedidos.include.cliente.select).toEqual({
      razonSocial: true,
    });
    expect(args.include.pedidos.include.entrega.select).toEqual({
      id: true,
      estado: true,
      observacion: true,
      fechaEntrega: true,
    });
  });
});
