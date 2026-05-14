import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { ClientsService } from './clients.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

type PrismaMock = {
  cliente: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  ruta: { findUnique: jest.Mock };
  departamento: { findUnique: jest.Mock };
  provincia: { findUnique: jest.Mock };
  distrito: { findUnique: jest.Mock };
};

// Typed wrappers to keep TS strict-mode happy (jest's expect.* return `any`)
const objectMatching = <T extends object>(shape: T): T =>
  expect.objectContaining(shape) as T;
const anyObject = (): object => expect.any(Object) as object;

const buildCreateDto = (
  overrides: Partial<CreateClientDto> = {},
): CreateClientDto => ({
  razonSocial: 'Bodega Don Pepe',
  direccion: 'Av. Siempre Viva 742',
  rutaId: 1,
  departamentoId: '15',
  provinciaId: '1501',
  distritoId: '150101',
  ...overrides,
});

describe('ClientsService', () => {
  let service: ClientsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = {
      cliente: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      ruta: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, activa: true }),
      },
      departamento: {
        findUnique: jest.fn().mockResolvedValue({ id: '15', nombre: 'Lima' }),
      },
      provincia: {
        findUnique: jest.fn().mockResolvedValue({ id: '1501', nombre: 'Lima' }),
      },
      distrito: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: '150101', nombre: 'Lima' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ClientsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
  });

  describe('create', () => {
    it('crea cliente con FK a ruta y ubigeo cuando los datos son válidos', async () => {
      // Arrange
      const dto = buildCreateDto({ ruc: '20123456789' });
      prisma.cliente.findUnique.mockResolvedValue(null);
      prisma.cliente.create.mockResolvedValue({
        id: 1,
        ...dto,
        activo: true,
        ruta: { id: 1, nombre: 'Ruta Norte', zona: 'Norte' },
        departamento: { id: '15', nombre: 'Lima' },
        provincia: { id: '1501', nombre: 'Lima' },
        distrito: { id: '150101', nombre: 'Lima' },
      });

      // Act
      const result = await service.create(dto);

      // Assert
      expect(result.id).toBe(1);
      expect(prisma.cliente.create).toHaveBeenCalledWith(
        objectMatching({
          data: dto,
          include: objectMatching({
            ruta: anyObject(),
            departamento: anyObject(),
            provincia: anyObject(),
            distrito: anyObject(),
          }),
        }),
      );
    });

    it('lanza ConflictException cuando el RUC ya está registrado', async () => {
      // Arrange
      const dto = buildCreateDto({ ruc: '20123456789' });
      prisma.cliente.findUnique.mockResolvedValue({
        id: 99,
        ruc: '20123456789',
      });

      // Act & Assert
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      await expect(service.create(dto)).rejects.toThrow(/RUC.*registrado/i);
      expect(prisma.cliente.create).not.toHaveBeenCalled();
    });

    it('NO valida unicidad de RUC cuando el DTO no trae RUC (es opcional)', async () => {
      // Arrange
      const dto = buildCreateDto({ ruc: undefined });
      prisma.cliente.create.mockResolvedValue({ id: 1, ...dto });

      // Act
      await service.create(dto);

      // Assert
      expect(prisma.cliente.findUnique).not.toHaveBeenCalled();
      expect(prisma.cliente.create).toHaveBeenCalledTimes(1);
    });

    it('lanza BadRequestException cuando la ruta no existe', async () => {
      // Arrange
      const dto = buildCreateDto({ rutaId: 9999 });
      prisma.cliente.findUnique.mockResolvedValue(null);
      prisma.ruta.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(/Ruta no encontrada/i);
      expect(prisma.cliente.create).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException cuando la ruta está inactiva', async () => {
      // Arrange
      const dto = buildCreateDto();
      prisma.cliente.findUnique.mockResolvedValue(null);
      prisma.ruta.findUnique.mockResolvedValue({ id: 1, activa: false });

      // Act & Assert
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(/Ruta/i);
      expect(prisma.cliente.create).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException cuando el departamento no existe', async () => {
      // Arrange
      const dto = buildCreateDto({ departamentoId: '99' });
      prisma.cliente.findUnique.mockResolvedValue(null);
      prisma.departamento.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        /Departamento no encontrado/i,
      );
      expect(prisma.cliente.create).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException cuando la provincia no existe', async () => {
      // Arrange
      const dto = buildCreateDto({ provinciaId: '9999' });
      prisma.cliente.findUnique.mockResolvedValue(null);
      prisma.provincia.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        /Provincia no encontrada/i,
      );
      expect(prisma.cliente.create).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException cuando el distrito no existe', async () => {
      // Arrange
      const dto = buildCreateDto({ distritoId: '999999' });
      prisma.cliente.findUnique.mockResolvedValue(null);
      prisma.distrito.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        /Distrito no encontrado/i,
      );
      expect(prisma.cliente.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('devuelve solo clientes activos ordenados por razonSocial', async () => {
      // Arrange
      prisma.cliente.findMany.mockResolvedValue([
        { id: 1, razonSocial: 'A', activo: true },
        { id: 2, razonSocial: 'B', activo: true },
      ]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toHaveLength(2);
      expect(prisma.cliente.findMany).toHaveBeenCalledWith({
        where: { activo: true },
        include: anyObject(),
        orderBy: { razonSocial: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('devuelve cliente con ubigeo desnormalizado (departamento, provincia, distrito, ruta)', async () => {
      // Arrange
      const cliente = {
        id: 1,
        razonSocial: 'Bodega X',
        ruta: { id: 1, nombre: 'Norte', zona: 'N' },
        departamento: { id: '15', nombre: 'Lima' },
        provincia: { id: '1501', nombre: 'Lima' },
        distrito: { id: '150101', nombre: 'Lima' },
      };
      prisma.cliente.findUnique.mockResolvedValue(cliente);

      // Act
      const result = await service.findOne(1);

      // Assert
      expect(result).toEqual(cliente);
      expect(prisma.cliente.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: objectMatching({
          ruta: anyObject(),
          departamento: anyObject(),
          provincia: anyObject(),
          distrito: anyObject(),
        }),
      });
    });

    it('lanza NotFoundException cuando el cliente no existe', async () => {
      // Arrange
      prisma.cliente.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow(/no encontrado/i);
    });
  });

  describe('update', () => {
    it('actualiza solo los campos provistos sin tocar los demás', async () => {
      // Arrange — solo se actualiza razonSocial
      const existing = {
        id: 1,
        razonSocial: 'Old Name',
        direccion: 'Vieja',
        activo: true,
      };
      prisma.cliente.findUnique.mockResolvedValue(existing);
      const dto: UpdateClientDto = { razonSocial: 'New Name' };
      prisma.cliente.update.mockResolvedValue({ ...existing, ...dto });

      // Act
      const result = await service.update(1, dto);

      // Assert
      expect(result.razonSocial).toBe('New Name');
      expect(prisma.cliente.update).toHaveBeenCalledWith(
        objectMatching({
          where: { id: 1 },
          data: { razonSocial: 'New Name' },
        }),
      );
    });

    it('lanza NotFoundException cuando el cliente a actualizar no existe', async () => {
      // Arrange
      prisma.cliente.findUnique.mockResolvedValue(null);
      const dto: UpdateClientDto = { razonSocial: 'X' };

      // Act & Assert
      await expect(service.update(999, dto)).rejects.toThrow(NotFoundException);
      expect(prisma.cliente.update).not.toHaveBeenCalled();
    });

    it('lanza ConflictException si el nuevo RUC ya está en uso por OTRO cliente', async () => {
      // Arrange — cliente 1 existe; otro cliente (id=2) ya tiene el RUC
      prisma.cliente.findUnique.mockResolvedValue({ id: 1, activo: true });
      prisma.cliente.findFirst.mockResolvedValue({ id: 2, ruc: '20999999999' });
      const dto: UpdateClientDto = { ruc: '20999999999' };

      // Act & Assert
      await expect(service.update(1, dto)).rejects.toThrow(ConflictException);
      expect(prisma.cliente.update).not.toHaveBeenCalled();
    });

    it('permite mantener el mismo RUC del propio cliente sin lanzar conflict', async () => {
      // Arrange — la consulta excluye al propio cliente con NOT { id }
      prisma.cliente.findUnique.mockResolvedValue({
        id: 1,
        ruc: '20111111111',
        activo: true,
      });
      prisma.cliente.findFirst.mockResolvedValue(null);
      const dto: UpdateClientDto = { ruc: '20111111111', razonSocial: 'X' };
      prisma.cliente.update.mockResolvedValue({ id: 1, ...dto });

      // Act
      const result = await service.update(1, dto);

      // Assert
      expect(result.id).toBe(1);
      expect(prisma.cliente.findFirst).toHaveBeenCalledWith({
        where: { ruc: '20111111111', NOT: { id: 1 } },
      });
    });
  });

  describe('deactivate (soft delete)', () => {
    it('marca activo=false en lugar de hacer DELETE real', async () => {
      // Arrange
      prisma.cliente.findUnique.mockResolvedValue({ id: 1, activo: true });
      prisma.cliente.update.mockResolvedValue({ id: 1, activo: false });

      // Act
      const result = await service.deactivate(1);

      // Assert
      expect(result.activo).toBe(false);
      expect(prisma.cliente.update).toHaveBeenCalledWith(
        objectMatching({
          where: { id: 1 },
          data: { activo: false },
        }),
      );
    });

    it('lanza NotFoundException cuando el cliente a desactivar no existe', async () => {
      // Arrange
      prisma.cliente.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deactivate(999)).rejects.toThrow(NotFoundException);
      expect(prisma.cliente.update).not.toHaveBeenCalled();
    });
  });
});
