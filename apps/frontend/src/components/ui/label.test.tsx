import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Label } from './label';
import { Input } from './input';

describe('Label', () => {
  describe('renderizado', () => {
    it('renderiza el children como texto', () => {
      render(<Label>Correo</Label>);
      expect(screen.getByText('Correo')).toBeInTheDocument();
    });

    it('renderiza un elemento <label> nativo', () => {
      render(<Label>Correo</Label>);
      expect(screen.getByText('Correo').tagName).toBe('LABEL');
    });

    it('aplica el atributo data-slot="label"', () => {
      render(<Label>Correo</Label>);
      expect(screen.getByText('Correo')).toHaveAttribute('data-slot', 'label');
    });

    it('aplica className adicional pasado por prop', () => {
      render(<Label className="text-destructive">Error</Label>);
      expect(screen.getByText('Error')).toHaveClass('text-destructive');
    });
  });

  describe('asociación con un input (a11y)', () => {
    it('expone htmlFor cuando se pasa', () => {
      render(<Label htmlFor="email-input">Correo</Label>);
      const label = screen.getByText('Correo') as HTMLLabelElement;
      expect(label.htmlFor).toBe('email-input');
    });

    it('clickear el label foca el input asociado vía htmlFor', async () => {
      const user = userEvent.setup();

      render(
        <>
          <Label htmlFor="email-input">Correo</Label>
          <Input id="email-input" data-testid="email" />
        </>,
      );

      const input = screen.getByTestId('email');
      expect(input).not.toHaveFocus();

      await user.click(screen.getByText('Correo'));

      expect(input).toHaveFocus();
    });

    it('getByLabelText resuelve el input por su label asociado (semántica accesible)', () => {
      render(
        <>
          <Label htmlFor="ruc-input">RUC</Label>
          <Input id="ruc-input" />
        </>,
      );

      // Si esta query rompe, el wiring htmlFor/id está mal y los lectores
      // de pantalla NO podrán anunciar el campo correctamente.
      expect(screen.getByLabelText('RUC')).toBeInTheDocument();
    });
  });
});
