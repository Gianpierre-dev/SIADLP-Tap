import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';

const validateDto = async (input: unknown) => {
  const dto = plainToInstance(LoginDto, input);
  return validate(dto);
};

describe('LoginDto — validaciones de entrada', () => {
  describe('correo (@IsEmail)', () => {
    it('acepta un correo válido', async () => {
      const errors = await validateDto({
        correo: 'admin@siadlp.com',
        contrasena: 'password123',
      });
      expect(errors).toHaveLength(0);
    });

    it('rechaza un correo sin @', async () => {
      const errors = await validateDto({
        correo: 'admin-siadlp.com',
        contrasena: 'password123',
      });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('correo');
      expect(errors[0].constraints).toHaveProperty('isEmail');
    });

    it('rechaza un correo sin dominio', async () => {
      const errors = await validateDto({
        correo: 'admin@',
        contrasena: 'password123',
      });
      expect(errors[0].constraints).toHaveProperty('isEmail');
    });

    it('rechaza correo vacío', async () => {
      const errors = await validateDto({
        correo: '',
        contrasena: 'password123',
      });
      expect(errors[0].constraints).toHaveProperty('isEmail');
    });

    it('rechaza correo no provisto', async () => {
      const errors = await validateDto({ contrasena: 'password123' });
      expect(errors[0].property).toBe('correo');
    });
  });

  describe('contrasena (@IsString @MinLength(8))', () => {
    it('acepta contraseña de exactamente 8 caracteres', async () => {
      const errors = await validateDto({
        correo: 'admin@siadlp.com',
        contrasena: '12345678',
      });
      expect(errors).toHaveLength(0);
    });

    it('rechaza contraseña de 7 caracteres', async () => {
      const errors = await validateDto({
        correo: 'admin@siadlp.com',
        contrasena: '1234567',
      });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('contrasena');
      expect(errors[0].constraints).toHaveProperty('minLength');
    });

    it('rechaza contraseña vacía', async () => {
      const errors = await validateDto({
        correo: 'admin@siadlp.com',
        contrasena: '',
      });
      expect(errors[0].constraints).toHaveProperty('minLength');
    });

    it('rechaza contraseña no provista', async () => {
      const errors = await validateDto({ correo: 'admin@siadlp.com' });
      expect(errors[0].property).toBe('contrasena');
    });

    it('rechaza contraseña que no sea string (numérico)', async () => {
      const errors = await validateDto({
        correo: 'admin@siadlp.com',
        contrasena: 12345678,
      });
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });
});
