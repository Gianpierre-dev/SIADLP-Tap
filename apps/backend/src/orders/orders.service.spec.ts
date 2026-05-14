import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@siadlp/shared';

import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ChangeOrderStatusDto } from './dto/change-order-status.dto';

type TxMock = {
  pedido: {
    create: jest.Mock;
    update: jest.Mock;
    findUnique: jest.Mock;
  };
  estadoPedidoLog: { create: jest.Mock };
};

type PrismaMock = {
  cliente: { findUnique: jest.Mock };
  producto: { findMany: jest.Mock };
  pedido: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
  detallePedido: { findMany: jest.Mock };
  $transaction: jest.Mock;
};

// Typed wrappers to keep TS strict-mode happy (jest's expect.* return `any`)
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

const buildPrismaMock = (): { prisma: PrismaMock; tx: TxMock } => {
  const tx: TxMock = {
    pedido: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    estadoPedidoLog: { create: jest.fn() },
  };
  const prisma: PrismaMock = {
    cliente: { findUnique: jest.fn() },
    producto: { findMany: jest.fn() },
    pedido: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    detallePedido: { findMany: jest.fn() },
    $transaction: jest.fn((cb: (txClient: TxMock) => unknown) => cb(tx)),
  };
  return { prisma, tx };
};

const buildCreateDto = (
  overrides: Partial<CreateOrderDto> = {},
): CreateOrderDto => ({
  clienteId: 1,
  fechaEntrega: '2026-05-10',
  observacion: 'Sin tomate',
  detalles: [
    { productoId: 10, cantidad: 5 },
    { productoId: 20, cantidad: 3 },
  ],
  ...overrides,
});

describe('OrdersService — create', () => {
  let service: OrdersService;
  let prisma: PrismaMock;
  let tx: TxMock;

  beforeEach(async () => {
    ({ prisma, tx } = buildPrismaMock());
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<OrdersService>(OrdersService);
  });

  it('crea el pedido con sus detalles cuando cliente y productos son válidos', async () => {
    // Arrange
    prisma.cliente.findUnique.mockResolvedValue({ id: 1, activo: true });
    prisma.producto.findMany.mockResolvedValue([
      { id: 10, activo: true },
      { id: 20, activo: true },
    ]);
    tx.pedido.create.mockResolvedValue({
      id: 555,
      estado: OrderStatus.REGISTERED,
      detalles: [],
      cliente: { id: 1, razonSocial: 'X' },
    });

    // Act
    const result = await service.create(buildCreateDto(), 42);

    // Assert
    expect(result.id).toBe(555);
    // Cliente lookup uses the exact dto.clienteId — kills "where: {}" mutant.
    expect(prisma.cliente.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    // Producto batch fetch uses { in: productoIds } — kills both "where: {}" and
    // "in: []" mutants.
    expect(prisma.producto.findMany).toHaveBeenCalledWith({
      where: { id: { in: [10, 20] } },
    });
    expect(tx.pedido.create).toHaveBeenCalledWith(
      objectMatching({
        data: objectMatching({
          clienteId: 1,
          creadoPorId: 42,
          observacion: 'Sin tomate',
          fechaEntrega: new Date('2026-05-10'),
          estado: OrderStatus.REGISTERED,
          detalles: {
            create: [
              { productoId: 10, cantidad: 5 },
              { productoId: 20, cantidad: 3 },
            ],
          },
        }),
        include: objectMatching({
          detalles: anyObject(),
          cliente: anyObject(),
        }),
      }),
    );
  });

  it('lanza NotFoundException con mensaje exacto cuando el cliente no existe', async () => {
    // Arrange
    prisma.cliente.findUnique.mockResolvedValue(null);

    // Act & Assert
    await expect(service.create(buildCreateDto(), 1)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.create(buildCreateDto(), 1)).rejects.toThrow(
      'Cliente no encontrado o inactivo',
    );
    expect(prisma.producto.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lanza NotFoundException con mensaje exacto cuando el cliente está inactivo', async () => {
    // Arrange
    prisma.cliente.findUnique.mockResolvedValue({ id: 1, activo: false });

    // Act & Assert
    await expect(service.create(buildCreateDto(), 1)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.create(buildCreateDto(), 1)).rejects.toThrow(
      'Cliente no encontrado o inactivo',
    );
    expect(prisma.producto.findMany).not.toHaveBeenCalled();
  });

  it('lanza NotFoundException con mensaje exacto cuando algún producto no existe', async () => {
    // Arrange — solicita 10 y 20, pero solo existe 10
    prisma.cliente.findUnique.mockResolvedValue({ id: 1, activo: true });
    prisma.producto.findMany.mockResolvedValue([{ id: 10, activo: true }]);

    // Act & Assert
    await expect(service.create(buildCreateDto(), 1)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.create(buildCreateDto(), 1)).rejects.toThrow(
      'Uno o más productos no fueron encontrados',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lanza BadRequestException con mensaje exacto cuando algún producto está inactivo', async () => {
    // Arrange
    prisma.cliente.findUnique.mockResolvedValue({ id: 1, activo: true });
    prisma.producto.findMany.mockResolvedValue([
      { id: 10, activo: true },
      { id: 20, activo: false },
    ]);

    // Act & Assert
    await expect(service.create(buildCreateDto(), 1)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.create(buildCreateDto(), 1)).rejects.toThrow(
      'Uno o más productos no están activos',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('crea el pedido con estado REGISTERED seteado explícitamente', async () => {
    // Arrange
    prisma.cliente.findUnique.mockResolvedValue({ id: 1, activo: true });
    prisma.producto.findMany.mockResolvedValue([
      { id: 10, activo: true },
      { id: 20, activo: true },
    ]);
    tx.pedido.create.mockResolvedValue({
      id: 1,
      estado: OrderStatus.REGISTERED,
      detalles: [],
      cliente: {},
    });

    // Act
    const result = await service.create(buildCreateDto(), 1);

    // Assert — el servicio setea explícitamente estado=REGISTERED para no
    // depender del default del schema de Prisma.
    expect(tx.pedido.create).toHaveBeenCalledWith(
      objectMatching({
        data: objectMatching({
          estado: OrderStatus.REGISTERED,
        }),
      }),
    );
    expect(result.estado).toBe(OrderStatus.REGISTERED);
  });

  it('crea log inicial en EstadoPedidoLog con estadoAnterior=null y estadoNuevo=REGISTERED', async () => {
    // Arrange
    prisma.cliente.findUnique.mockResolvedValue({ id: 1, activo: true });
    prisma.producto.findMany.mockResolvedValue([
      { id: 10, activo: true },
      { id: 20, activo: true },
    ]);
    tx.pedido.create.mockResolvedValue({
      id: 99,
      detalles: [],
      cliente: {},
    });

    // Act
    await service.create(buildCreateDto(), 7);

    // Assert
    expect(tx.estadoPedidoLog.create).toHaveBeenCalledWith({
      data: {
        pedidoId: 99,
        estadoAnterior: null,
        estadoNuevo: OrderStatus.REGISTERED,
        usuarioId: 7,
      },
    });
  });

  it('mapea fechaEntrega del DTO (string) a Date en el create', async () => {
    // Arrange
    prisma.cliente.findUnique.mockResolvedValue({ id: 1, activo: true });
    prisma.producto.findMany.mockResolvedValue([
      { id: 10, activo: true },
      { id: 20, activo: true },
    ]);
    tx.pedido.create.mockResolvedValue({
      id: 1,
      detalles: [],
      cliente: {},
    });
    const dto = buildCreateDto({ fechaEntrega: '2026-12-31' });

    // Act
    await service.create(dto, 1);

    // Assert
    const createArgs = firstCallArg<{ data: { fechaEntrega: Date } }>(
      tx.pedido.create,
    );
    expect(createArgs.data.fechaEntrega).toBeInstanceOf(Date);
    expect(createArgs.data.fechaEntrega.toISOString()).toBe(
      '2026-12-31T00:00:00.000Z',
    );
  });

  it('include exacto en pedido.create: cliente y detalles.producto', async () => {
    // Arrange
    prisma.cliente.findUnique.mockResolvedValue({ id: 1, activo: true });
    prisma.producto.findMany.mockResolvedValue([
      { id: 10, activo: true },
      { id: 20, activo: true },
    ]);
    tx.pedido.create.mockResolvedValue({
      id: 1,
      detalles: [],
      cliente: {},
    });

    // Act
    await service.create(buildCreateDto(), 1);

    // Assert — kills ObjectLiteral + BooleanLiteral en selects del include
    const args = firstCallArg<{
      include: {
        detalles: {
          include: {
            producto: {
              select: { id: boolean; nombre: boolean; codigoSku: boolean };
            };
          };
        };
        cliente: { select: { id: boolean; razonSocial: boolean } };
      };
    }>(tx.pedido.create);
    expect(args.include.detalles.include.producto.select).toEqual({
      id: true,
      nombre: true,
      codigoSku: true,
    });
    expect(args.include.cliente.select).toEqual({
      id: true,
      razonSocial: true,
    });
  });
});

describe('OrdersService — changeStatus', () => {
  let service: OrdersService;
  let prisma: PrismaMock;
  let tx: TxMock;

  beforeEach(async () => {
    ({ prisma, tx } = buildPrismaMock());
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<OrdersService>(OrdersService);
  });

  it('permite la transición REGISTERED → CONFIRMED y persiste data correcta', async () => {
    // Arrange
    prisma.pedido.findUnique.mockResolvedValue({
      id: 1,
      estado: OrderStatus.REGISTERED,
    });
    tx.pedido.update.mockResolvedValue({
      id: 1,
      estado: OrderStatus.CONFIRMED,
    });
    const dto: ChangeOrderStatusDto = { nuevoEstado: OrderStatus.CONFIRMED };

    // Act
    const result = await service.changeStatus(1, dto, 5);

    // Assert
    expect(result.estado).toBe(OrderStatus.CONFIRMED);
    // Lookup uses the id arg — kills "where: {}" mutant.
    expect(prisma.pedido.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    expect(tx.pedido.update).toHaveBeenCalledWith(
      objectMatching({
        where: { id: 1 },
        data: { estado: OrderStatus.CONFIRMED },
        include: objectMatching({
          detalles: anyObject(),
          cliente: anyObject(),
          estadoLogs: anyObject(),
        }),
      }),
    );
  });

  it('rechaza con BadRequestException la transición inválida REGISTERED → DELIVERED', async () => {
    // Arrange
    prisma.pedido.findUnique.mockResolvedValue({
      id: 1,
      estado: OrderStatus.REGISTERED,
    });
    const dto: ChangeOrderStatusDto = { nuevoEstado: OrderStatus.DELIVERED };

    // Act & Assert
    await expect(service.changeStatus(1, dto, 1)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.changeStatus(1, dto, 1)).rejects.toThrow(
      'No se puede transicionar de REGISTERED a DELIVERED',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza explícitamente la transición a DISPATCHED con mensaje exacto', async () => {
    // Arrange
    prisma.pedido.findUnique.mockResolvedValue({
      id: 1,
      estado: OrderStatus.CONFIRMED,
    });
    const dto: ChangeOrderStatusDto = { nuevoEstado: OrderStatus.DISPATCHED };

    // Act & Assert
    await expect(service.changeStatus(1, dto, 1)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.changeStatus(1, dto, 1)).rejects.toThrow(
      'La transición a DISPATCHED solo se realiza mediante el módulo de despacho',
    );
  });

  it('exige motivo cuando se cancela el pedido — mensaje exacto', async () => {
    // Arrange
    prisma.pedido.findUnique.mockResolvedValue({
      id: 1,
      estado: OrderStatus.REGISTERED,
    });
    const dto: ChangeOrderStatusDto = { nuevoEstado: OrderStatus.CANCELLED };

    // Act & Assert
    await expect(service.changeStatus(1, dto, 1)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.changeStatus(1, dto, 1)).rejects.toThrow(
      'Se requiere un motivo para cancelar el pedido',
    );
  });

  it('permite cancelar cuando se proporciona motivo', async () => {
    // Arrange
    prisma.pedido.findUnique.mockResolvedValue({
      id: 1,
      estado: OrderStatus.REGISTERED,
    });
    tx.pedido.update.mockResolvedValue({
      id: 1,
      estado: OrderStatus.CANCELLED,
    });
    const dto: ChangeOrderStatusDto = {
      nuevoEstado: OrderStatus.CANCELLED,
      motivo: 'Cliente cambió de opinión',
    };

    // Act
    const result = await service.changeStatus(1, dto, 1);

    // Assert
    expect(result.estado).toBe(OrderStatus.CANCELLED);
    expect(tx.pedido.update).toHaveBeenCalledWith(
      objectMatching({
        where: { id: 1 },
        data: { estado: OrderStatus.CANCELLED },
      }),
    );
  });

  it('crea log de transición con estadoAnterior, estadoNuevo, motivo y usuario', async () => {
    // Arrange
    prisma.pedido.findUnique.mockResolvedValue({
      id: 1,
      estado: OrderStatus.REGISTERED,
    });
    tx.pedido.update.mockResolvedValue({
      id: 1,
      estado: OrderStatus.CANCELLED,
    });
    const dto: ChangeOrderStatusDto = {
      nuevoEstado: OrderStatus.CANCELLED,
      motivo: 'Cliente canceló por teléfono',
    };

    // Act
    await service.changeStatus(1, dto, 88);

    // Assert
    expect(tx.estadoPedidoLog.create).toHaveBeenCalledWith({
      data: {
        pedidoId: 1,
        estadoAnterior: OrderStatus.REGISTERED,
        estadoNuevo: OrderStatus.CANCELLED,
        motivo: 'Cliente canceló por teléfono',
        usuarioId: 88,
      },
    });
  });

  it('lanza NotFoundException con mensaje exacto cuando el pedido no existe', async () => {
    // Arrange
    prisma.pedido.findUnique.mockResolvedValue(null);
    const dto: ChangeOrderStatusDto = { nuevoEstado: OrderStatus.CONFIRMED };

    // Act & Assert
    await expect(service.changeStatus(999, dto, 1)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.changeStatus(999, dto, 1)).rejects.toThrow(
      'Pedido no encontrado',
    );
  });

  it('include exacto en update: cliente, detalles.producto, estadoLogs.usuario', async () => {
    // Arrange
    prisma.pedido.findUnique.mockResolvedValue({
      id: 1,
      estado: OrderStatus.REGISTERED,
    });
    tx.pedido.update.mockResolvedValue({
      id: 1,
      estado: OrderStatus.CONFIRMED,
    });

    // Act
    await service.changeStatus(1, { nuevoEstado: OrderStatus.CONFIRMED }, 1);

    // Assert — kills ObjectLiteral + BooleanLiteral en selects del include
    const args = firstCallArg<{
      include: {
        cliente: { select: { id: boolean; razonSocial: boolean } };
        detalles: {
          include: {
            producto: {
              select: { id: boolean; nombre: boolean; codigoSku: boolean };
            };
          };
        };
        estadoLogs: {
          orderBy: { fechaCreacion: 'asc' | 'desc' };
          include: {
            usuario: { select: { id: boolean; nombre: boolean } };
          };
        };
      };
    }>(tx.pedido.update);
    expect(args.include.cliente.select).toEqual({
      id: true,
      razonSocial: true,
    });
    expect(args.include.detalles.include.producto.select).toEqual({
      id: true,
      nombre: true,
      codigoSku: true,
    });
    expect(args.include.estadoLogs.orderBy).toEqual({
      fechaCreacion: 'desc',
    });
    expect(args.include.estadoLogs.include.usuario.select).toEqual({
      id: true,
      nombre: true,
    });
  });
});

describe('OrdersService — findOne', () => {
  let service: OrdersService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    ({ prisma } = buildPrismaMock());
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<OrdersService>(OrdersService);
  });

  it('devuelve el pedido con cliente, detalles y logs incluidos', async () => {
    // Arrange
    const pedido = {
      id: 1,
      estado: OrderStatus.REGISTERED,
      cliente: { id: 1, razonSocial: 'Cliente X' },
      detalles: [
        {
          productoId: 10,
          cantidad: 2,
          producto: { id: 10, nombre: 'Pan', codigoSku: 'PAN-001' },
        },
      ],
      estadoLogs: [
        {
          estadoAnterior: null,
          estadoNuevo: OrderStatus.REGISTERED,
          usuario: { id: 1, nombre: 'Admin' },
        },
      ],
    };
    prisma.pedido.findUnique.mockResolvedValue(pedido);

    // Act
    const result = await service.findOne(1);

    // Assert
    expect(result).toEqual(pedido);
    expect(prisma.pedido.findUnique).toHaveBeenCalledWith(
      objectMatching({
        where: { id: 1 },
        include: objectMatching({
          cliente: anyObject(),
          detalles: anyObject(),
          estadoLogs: objectMatching({
            orderBy: { fechaCreacion: 'asc' },
          }),
        }),
      }),
    );
  });

  it('lanza NotFoundException con mensaje exacto cuando el pedido no existe', async () => {
    // Arrange
    prisma.pedido.findUnique.mockResolvedValue(null);

    // Act & Assert
    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    await expect(service.findOne(999)).rejects.toThrow('Pedido no encontrado');
  });

  it('include exacto: cliente, detalles.producto, estadoLogs.usuario con selects', async () => {
    // Arrange
    prisma.pedido.findUnique.mockResolvedValue({
      id: 1,
      cliente: {},
      detalles: [],
      estadoLogs: [],
    });

    // Act
    await service.findOne(1);

    // Assert — kills ObjectLiteral + BooleanLiteral mutants en selects
    const args = firstCallArg<{
      include: {
        cliente: { select: { id: boolean; razonSocial: boolean } };
        detalles: {
          include: {
            producto: {
              select: { id: boolean; nombre: boolean; codigoSku: boolean };
            };
          };
        };
        estadoLogs: {
          orderBy: { fechaCreacion: 'asc' | 'desc' };
          include: {
            usuario: { select: { id: boolean; nombre: boolean } };
          };
        };
      };
    }>(prisma.pedido.findUnique);
    expect(args.include.cliente.select).toEqual({
      id: true,
      razonSocial: true,
    });
    expect(args.include.detalles.include.producto.select).toEqual({
      id: true,
      nombre: true,
      codigoSku: true,
    });
    expect(args.include.estadoLogs.orderBy).toEqual({
      fechaCreacion: 'asc',
    });
    expect(args.include.estadoLogs.include.usuario.select).toEqual({
      id: true,
      nombre: true,
    });
  });
});

describe('OrdersService — findAll', () => {
  let service: OrdersService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    ({ prisma } = buildPrismaMock());
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<OrdersService>(OrdersService);
  });

  it('devuelve la primera página con los defaults (page=1, pageSize=20)', async () => {
    // Arrange
    const pedidos = [
      { id: 1, cliente: { id: 1, razonSocial: 'A' }, _count: { detalles: 2 } },
    ];
    prisma.pedido.findMany.mockResolvedValue(pedidos);
    prisma.pedido.count.mockResolvedValue(1);

    // Act
    const result = await service.findAll();

    // Assert — defaults explícitos
    expect(result).toEqual({ data: pedidos, total: 1, page: 1, pageSize: 20 });
    expect(prisma.pedido.findMany).toHaveBeenCalledWith(
      objectMatching({
        skip: 0,
        take: 20,
        orderBy: { fechaCreacion: 'desc' },
        include: objectMatching({
          cliente: anyObject(),
          _count: { select: { detalles: true } },
        }),
      }),
    );
    expect(prisma.pedido.count).toHaveBeenCalled();
  });

  it('aplica skip = (page-1) * pageSize correctamente para la página 3', async () => {
    // Arrange
    prisma.pedido.findMany.mockResolvedValue([]);
    prisma.pedido.count.mockResolvedValue(0);

    // Act
    const result = await service.findAll(3, 10);

    // Assert
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(10);
    expect(prisma.pedido.findMany).toHaveBeenCalledWith(
      objectMatching({
        skip: 20, // (3-1) * 10
        take: 10,
      }),
    );
  });

  it('devuelve total y paginación intactos aunque no haya datos', async () => {
    // Arrange
    prisma.pedido.findMany.mockResolvedValue([]);
    prisma.pedido.count.mockResolvedValue(42);

    // Act
    const result = await service.findAll(2, 5);

    // Assert
    expect(result).toEqual({ data: [], total: 42, page: 2, pageSize: 5 });
  });

  it('include exacto: cliente {id, razonSocial} y _count.detalles=true', async () => {
    // Arrange
    prisma.pedido.findMany.mockResolvedValue([]);
    prisma.pedido.count.mockResolvedValue(0);

    // Act
    await service.findAll();

    // Assert — kills ObjectLiteral (select:{}) + BooleanLiteral (id:false, razonSocial:false)
    const args = firstCallArg<{
      include: {
        cliente: { select: { id: boolean; razonSocial: boolean } };
        _count: { select: { detalles: boolean } };
      };
    }>(prisma.pedido.findMany);
    expect(args.include.cliente.select).toEqual({
      id: true,
      razonSocial: true,
    });
    expect(args.include._count.select).toEqual({ detalles: true });
  });
});

describe('OrdersService — findByDate', () => {
  let service: OrdersService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    ({ prisma } = buildPrismaMock());
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<OrdersService>(OrdersService);
  });

  it('filtra pedidos por rango [day, nextDay) usando gte/lt', async () => {
    // Arrange
    prisma.pedido.findMany.mockResolvedValue([{ id: 1 }]);

    // Act
    const result = await service.findByDate('2026-05-10');

    // Assert
    expect(result).toEqual([{ id: 1 }]);
    const callArgs = firstCallArg<{
      where: { fechaEntrega: { gte: Date; lt: Date } };
      include: object;
      orderBy: { fechaCreacion: 'desc' };
    }>(prisma.pedido.findMany);
    expect(callArgs.where.fechaEntrega.gte).toBeInstanceOf(Date);
    expect(callArgs.where.fechaEntrega.lt).toBeInstanceOf(Date);
    // Range [2026-05-10, 2026-05-11)
    expect(callArgs.where.fechaEntrega.gte.toISOString()).toBe(
      '2026-05-10T00:00:00.000Z',
    );
    expect(callArgs.where.fechaEntrega.lt.toISOString()).toBe(
      '2026-05-11T00:00:00.000Z',
    );
    expect(callArgs.orderBy).toEqual({ fechaCreacion: 'desc' });
  });

  it('incluye cliente {id, razonSocial} y _count.detalles=true (shape exacto)', async () => {
    // Arrange
    prisma.pedido.findMany.mockResolvedValue([]);

    // Act
    await service.findByDate('2026-01-01');

    // Assert — kills ObjectLiteral + BooleanLiteral en select de include
    const args = firstCallArg<{
      include: {
        cliente: { select: { id: boolean; razonSocial: boolean } };
        _count: { select: { detalles: boolean } };
      };
    }>(prisma.pedido.findMany);
    expect(args.include.cliente.select).toEqual({
      id: true,
      razonSocial: true,
    });
    expect(args.include._count.select).toEqual({ detalles: true });
  });
});

describe('OrdersService — findHistory', () => {
  let service: OrdersService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    ({ prisma } = buildPrismaMock());
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<OrdersService>(OrdersService);
  });

  it('sin filtros: ejecuta findMany con where vacío', async () => {
    // Arrange
    prisma.pedido.findMany.mockResolvedValue([]);

    // Act
    await service.findHistory({});

    // Assert
    expect(prisma.pedido.findMany).toHaveBeenCalledWith(
      objectMatching({
        where: {},
        orderBy: { fechaCreacion: 'desc' },
        include: objectMatching({
          cliente: anyObject(),
          _count: { select: { detalles: true } },
        }),
      }),
    );
  });

  it('aplica filtro estado cuando se proporciona', async () => {
    // Arrange
    prisma.pedido.findMany.mockResolvedValue([]);

    // Act
    await service.findHistory({ estado: OrderStatus.CONFIRMED });

    // Assert
    expect(prisma.pedido.findMany).toHaveBeenCalledWith(
      objectMatching({
        where: { estado: OrderStatus.CONFIRMED },
      }),
    );
  });

  it('aplica filtro clienteId cuando se proporciona', async () => {
    // Arrange
    prisma.pedido.findMany.mockResolvedValue([]);

    // Act
    await service.findHistory({ clienteId: 99 });

    // Assert
    expect(prisma.pedido.findMany).toHaveBeenCalledWith(
      objectMatching({
        where: { clienteId: 99 },
      }),
    );
  });

  it('aplica filtro de fechas (gte y lte) cuando se proporcionan ambos', async () => {
    // Arrange
    prisma.pedido.findMany.mockResolvedValue([]);

    // Act
    await service.findHistory({
      desde: '2026-01-01',
      hasta: '2026-01-31',
    });

    // Assert
    const args = firstCallArg<{
      where: { fechaCreacion: { gte: Date; lte: Date } };
    }>(prisma.pedido.findMany);
    expect(args.where.fechaCreacion.gte).toBeInstanceOf(Date);
    expect(args.where.fechaCreacion.lte).toBeInstanceOf(Date);
    expect(args.where.fechaCreacion.gte.toISOString()).toBe(
      '2026-01-01T00:00:00.000Z',
    );
    expect(args.where.fechaCreacion.lte.toISOString()).toBe(
      '2026-01-31T00:00:00.000Z',
    );
  });

  it('aplica solo gte cuando se proporciona "desde" sin "hasta"', async () => {
    // Arrange
    prisma.pedido.findMany.mockResolvedValue([]);

    // Act
    await service.findHistory({ desde: '2026-01-01' });

    // Assert
    const args = firstCallArg<{
      where: { fechaCreacion: { gte?: Date; lte?: Date } };
    }>(prisma.pedido.findMany);
    expect(args.where.fechaCreacion.gte).toBeInstanceOf(Date);
    expect(args.where.fechaCreacion.lte).toBeUndefined();
  });

  it('aplica solo lte cuando se proporciona "hasta" sin "desde"', async () => {
    // Arrange
    prisma.pedido.findMany.mockResolvedValue([]);

    // Act
    await service.findHistory({ hasta: '2026-12-31' });

    // Assert
    const args = firstCallArg<{
      where: { fechaCreacion: { gte?: Date; lte?: Date } };
    }>(prisma.pedido.findMany);
    expect(args.where.fechaCreacion.lte).toBeInstanceOf(Date);
    expect(args.where.fechaCreacion.gte).toBeUndefined();
  });

  it('combina todos los filtros simultáneamente', async () => {
    // Arrange
    prisma.pedido.findMany.mockResolvedValue([]);

    // Act
    await service.findHistory({
      estado: OrderStatus.DELIVERED,
      clienteId: 7,
      desde: '2026-05-01',
      hasta: '2026-05-31',
    });

    // Assert
    const args = firstCallArg<{
      where: {
        estado: string;
        clienteId: number;
        fechaCreacion: { gte: Date; lte: Date };
      };
    }>(prisma.pedido.findMany);
    expect(args.where.estado).toBe(OrderStatus.DELIVERED);
    expect(args.where.clienteId).toBe(7);
    expect(args.where.fechaCreacion.gte).toBeInstanceOf(Date);
    expect(args.where.fechaCreacion.lte).toBeInstanceOf(Date);
  });

  it('include exacto: cliente {id, razonSocial} y _count.detalles=true', async () => {
    // Arrange
    prisma.pedido.findMany.mockResolvedValue([]);

    // Act
    await service.findHistory({});

    // Assert — kills ObjectLiteral + BooleanLiteral en select de include
    const args = firstCallArg<{
      include: {
        cliente: { select: { id: boolean; razonSocial: boolean } };
        _count: { select: { detalles: boolean } };
      };
      orderBy: { fechaCreacion: 'desc' };
    }>(prisma.pedido.findMany);
    expect(args.include.cliente.select).toEqual({
      id: true,
      razonSocial: true,
    });
    expect(args.include._count.select).toEqual({ detalles: true });
    expect(args.orderBy).toEqual({ fechaCreacion: 'desc' });
  });
});

describe('OrdersService — findConfirmedBySku', () => {
  let service: OrdersService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    ({ prisma } = buildPrismaMock());
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<OrdersService>(OrdersService);
  });

  it('agrupa cantidades por productoId y suma los .toNumber()', async () => {
    // Arrange
    prisma.detallePedido.findMany.mockResolvedValue([
      {
        productoId: 10,
        cantidad: dec(5),
        producto: { id: 10, nombre: 'Pan', codigoSku: 'PAN-001' },
      },
      {
        productoId: 10,
        cantidad: dec(3),
        producto: { id: 10, nombre: 'Pan', codigoSku: 'PAN-001' },
      },
      {
        productoId: 20,
        cantidad: dec(2),
        producto: { id: 20, nombre: 'Agua', codigoSku: 'AGU-001' },
      },
    ]);

    // Act
    const result = await service.findConfirmedBySku('2026-05-10');

    // Assert
    expect(result).toHaveLength(2);
    const pan = result.find((r) => r.producto.id === 10);
    const agua = result.find((r) => r.producto.id === 20);
    expect(pan?.totalCantidad).toBe(8); // 5 + 3
    expect(agua?.totalCantidad).toBe(2);
  });

  it('ordena alfabéticamente por nombre de producto (localeCompare)', async () => {
    // Arrange
    prisma.detallePedido.findMany.mockResolvedValue([
      {
        productoId: 1,
        cantidad: dec(1),
        producto: { id: 1, nombre: 'Zanahoria', codigoSku: 'Z-1' },
      },
      {
        productoId: 2,
        cantidad: dec(1),
        producto: { id: 2, nombre: 'Apio', codigoSku: 'A-1' },
      },
      {
        productoId: 3,
        cantidad: dec(1),
        producto: { id: 3, nombre: 'Manzana', codigoSku: 'M-1' },
      },
    ]);

    // Act
    const result = await service.findConfirmedBySku('2026-05-10');

    // Assert — sort ascendente: Apio, Manzana, Zanahoria
    expect(result.map((r) => r.producto.nombre)).toEqual([
      'Apio',
      'Manzana',
      'Zanahoria',
    ]);
  });

  it('filtra solo detalles de pedidos en estado CONFIRMED y rango de fecha', async () => {
    // Arrange
    prisma.detallePedido.findMany.mockResolvedValue([]);

    // Act
    await service.findConfirmedBySku('2026-05-10');

    // Assert — kills "where: {}" mutant + filtro estado/fecha mutants
    const args = firstCallArg<{
      where: {
        pedido: { estado: string; fechaEntrega: { gte: Date; lt: Date } };
      };
      include: object;
    }>(prisma.detallePedido.findMany);
    expect(args.where.pedido.estado).toBe(OrderStatus.CONFIRMED);
    expect(args.where.pedido.fechaEntrega.gte).toBeInstanceOf(Date);
    expect(args.where.pedido.fechaEntrega.lt).toBeInstanceOf(Date);
    expect(args.where.pedido.fechaEntrega.gte.toISOString()).toBe(
      '2026-05-10T00:00:00.000Z',
    );
    expect(args.where.pedido.fechaEntrega.lt.toISOString()).toBe(
      '2026-05-11T00:00:00.000Z',
    );
  });

  it('devuelve array vacío cuando no hay detalles', async () => {
    // Arrange
    prisma.detallePedido.findMany.mockResolvedValue([]);

    // Act
    const result = await service.findConfirmedBySku('2026-05-10');

    // Assert
    expect(result).toEqual([]);
  });

  it('include exacto: producto {id, nombre, codigoSku}', async () => {
    // Arrange
    prisma.detallePedido.findMany.mockResolvedValue([]);

    // Act
    await service.findConfirmedBySku('2026-05-10');

    // Assert — kills ObjectLiteral + BooleanLiteral en select PRODUCTO_SELECT
    const args = firstCallArg<{
      include: {
        producto: {
          select: { id: boolean; nombre: boolean; codigoSku: boolean };
        };
      };
    }>(prisma.detallePedido.findMany);
    expect(args.include.producto.select).toEqual({
      id: true,
      nombre: true,
      codigoSku: true,
    });
  });
});
