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
  pedido: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

// Typed wrappers to keep TS strict-mode happy (jest's expect.* return `any`)
const objectMatching = <T extends object>(shape: T): T =>
  expect.objectContaining(shape) as T;
const anyObject = (): object => expect.any(Object) as object;

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
    tx = {
      pedido: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      estadoPedidoLog: { create: jest.fn() },
    };

    prisma = {
      cliente: { findUnique: jest.fn() },
      producto: { findMany: jest.fn() },
      pedido: { findUnique: jest.fn() },
      $transaction: jest.fn((cb: (txClient: TxMock) => unknown) => cb(tx)),
    };

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
    expect(tx.pedido.create).toHaveBeenCalledWith(
      objectMatching({
        data: objectMatching({
          clienteId: 1,
          creadoPorId: 42,
          detalles: {
            create: [
              { productoId: 10, cantidad: 5 },
              { productoId: 20, cantidad: 3 },
            ],
          },
        }),
      }),
    );
  });

  it('lanza NotFoundException cuando el cliente no existe', async () => {
    // Arrange
    prisma.cliente.findUnique.mockResolvedValue(null);

    // Act & Assert
    await expect(service.create(buildCreateDto(), 1)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.create(buildCreateDto(), 1)).rejects.toThrow(
      /cliente/i,
    );
    expect(prisma.producto.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lanza NotFoundException cuando el cliente está inactivo', async () => {
    // Arrange
    prisma.cliente.findUnique.mockResolvedValue({ id: 1, activo: false });

    // Act & Assert
    await expect(service.create(buildCreateDto(), 1)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.producto.findMany).not.toHaveBeenCalled();
  });

  it('lanza NotFoundException cuando algún producto no existe', async () => {
    // Arrange — solicita 10 y 20, pero solo existe 10
    prisma.cliente.findUnique.mockResolvedValue({ id: 1, activo: true });
    prisma.producto.findMany.mockResolvedValue([{ id: 10, activo: true }]);

    // Act & Assert
    await expect(service.create(buildCreateDto(), 1)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.create(buildCreateDto(), 1)).rejects.toThrow(
      /producto/i,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lanza BadRequestException cuando algún producto está inactivo', async () => {
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
});

describe('OrdersService — changeStatus', () => {
  let service: OrdersService;
  let prisma: PrismaMock;
  let tx: TxMock;

  beforeEach(async () => {
    tx = {
      pedido: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      estadoPedidoLog: { create: jest.fn() },
    };

    prisma = {
      cliente: { findUnique: jest.fn() },
      producto: { findMany: jest.fn() },
      pedido: { findUnique: jest.fn() },
      $transaction: jest.fn((cb: (txClient: TxMock) => unknown) => cb(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('permite la transición REGISTERED → CONFIRMED', async () => {
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
    expect(tx.pedido.update).toHaveBeenCalledWith(
      objectMatching({
        where: { id: 1 },
        data: { estado: OrderStatus.CONFIRMED },
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
      /transicionar/i,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza explícitamente la transición a DISPATCHED (debe ir por módulo de despacho)', async () => {
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
      /módulo de despacho/i,
    );
  });

  it('exige motivo cuando se cancela el pedido', async () => {
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
    await expect(service.changeStatus(1, dto, 1)).rejects.toThrow(/motivo/i);
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

  it('lanza NotFoundException cuando el pedido no existe', async () => {
    // Arrange
    prisma.pedido.findUnique.mockResolvedValue(null);
    const dto: ChangeOrderStatusDto = { nuevoEstado: OrderStatus.CONFIRMED };

    // Act & Assert
    await expect(service.changeStatus(999, dto, 1)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('OrdersService — findOne', () => {
  let service: OrdersService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    const tx: TxMock = {
      pedido: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      estadoPedidoLog: { create: jest.fn() },
    };

    prisma = {
      cliente: { findUnique: jest.fn() },
      producto: { findMany: jest.fn() },
      pedido: { findUnique: jest.fn() },
      $transaction: jest.fn((cb: (txClient: TxMock) => unknown) => cb(tx)),
    };

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
          estadoLogs: anyObject(),
        }),
      }),
    );
  });

  it('lanza NotFoundException cuando el pedido no existe', async () => {
    // Arrange
    prisma.pedido.findUnique.mockResolvedValue(null);

    // Act & Assert
    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    await expect(service.findOne(999)).rejects.toThrow(/no encontrado/i);
  });
});
