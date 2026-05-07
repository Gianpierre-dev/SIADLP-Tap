import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './input';

describe('Input', () => {
  describe('renderizado', () => {
    it('renderiza un input por defecto', () => {
      render(<Input data-testid="input" />);
      expect(screen.getByTestId('input')).toBeInTheDocument();
    });

    it('aplica el atributo data-slot="input"', () => {
      render(<Input data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute(
        'data-slot',
        'input',
      );
    });

    it('renderiza con type="email" cuando se pasa', () => {
      render(<Input type="email" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('type', 'email');
    });

    it('renderiza con type="password" cuando se pasa', () => {
      render(<Input type="password" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('type', 'password');
    });

    it('renderiza placeholder', () => {
      render(<Input placeholder="Ingresá tu correo" />);
      expect(
        screen.getByPlaceholderText('Ingresá tu correo'),
      ).toBeInTheDocument();
    });

    it('aplica className adicional', () => {
      render(<Input className="custom-input" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveClass('custom-input');
    });
  });

  describe('comportamiento controlado', () => {
    it('refleja el value pasado por prop', () => {
      render(<Input value="hello" onChange={() => undefined} />);
      expect(screen.getByDisplayValue('hello')).toBeInTheDocument();
    });

    it('dispara onChange cuando el usuario tipea', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(<Input onChange={handleChange} data-testid="input" />);
      await user.type(screen.getByTestId('input'), 'abc');

      expect(handleChange).toHaveBeenCalledTimes(3);
    });
  });

  describe('estado disabled', () => {
    it('está deshabilitado cuando disabled=true', () => {
      render(<Input disabled data-testid="input" />);
      expect(screen.getByTestId('input')).toBeDisabled();
    });

    it('NO permite tipear cuando está disabled', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <Input disabled onChange={handleChange} data-testid="input" />,
      );
      await user.type(screen.getByTestId('input'), 'no debería pasar');

      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe('estados de validación HTML5', () => {
    it('respeta required', () => {
      render(<Input required data-testid="input" />);
      expect(screen.getByTestId('input')).toBeRequired();
    });

    it('respeta pattern (validación HTML5)', () => {
      render(<Input pattern="[0-9]{8}" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute(
        'pattern',
        '[0-9]{8}',
      );
    });

    it('respeta maxLength', () => {
      render(<Input maxLength={11} data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('maxLength', '11');
    });

    it('respeta inputMode (importante para accesibilidad mobile)', () => {
      render(<Input inputMode="numeric" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute(
        'inputMode',
        'numeric',
      );
    });
  });

  describe('atributo aria-invalid', () => {
    it('aplica aria-invalid cuando se setea', () => {
      render(<Input aria-invalid="true" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute(
        'aria-invalid',
        'true',
      );
    });
  });
});
