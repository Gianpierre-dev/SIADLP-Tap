import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

// Filtro global: traduce errores conocidos de Prisma a respuestas HTTP limpias,
// para que una violación de restricción no se filtre como un 500 crudo. Es la
// red de seguridad detrás de los chequeos explícitos de cada servicio.
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ): void {
    const res = host.switchToHttp().getResponse<Response>();

    switch (exception.code) {
      case 'P2002': {
        const target = exception.meta?.['target'];
        const campo = Array.isArray(target)
          ? target.join(', ')
          : typeof target === 'string'
            ? target
            : 'un valor único';
        res.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: `Ya existe un registro con ese valor (campo único: ${campo})`,
        });
        return;
      }
      case 'P2025':
        res.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Not Found',
          message: 'El registro solicitado no fue encontrado',
        });
        return;
      case 'P2003':
        res.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message:
            'No se puede completar la operación: el registro está referenciado por otros datos',
        });
        return;
      default:
        this.logger.error(
          `Prisma error ${exception.code}: ${exception.message}`,
        );
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
          message: 'Error de base de datos',
        });
    }
  }
}
