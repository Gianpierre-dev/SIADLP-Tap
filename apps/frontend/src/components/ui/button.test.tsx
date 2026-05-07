import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, buttonVariants } from './button';

describe('Button', () => {
  describe('renderizado', () => {
    it('renderiza el children como texto', () => {
      render(<Button>Click me</Button>);
      expect(
        screen.getByRole('button', { name: /click me/i }),
      ).toBeInTheDocument();
    });

    it('aplica el atributo data-slot="button"', () => {
      render(<Button>Test</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-slot', 'button');
    });

    it('aplica className adicional pasado por prop', () => {
      render(<Button className="custom-class">Test</Button>);
      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });
  });

  describe('variants', () => {
    it('aplica variant="default" por defecto', () => {
      render(<Button>Default</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-primary');
    });

    it('aplica variant="destructive" cuando se pasa', () => {
      render(<Button variant="destructive">Destructive</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('text-destructive');
    });

    it('aplica variant="outline" cuando se pasa', () => {
      render(<Button variant="outline">Outline</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('border-border');
    });

    it('aplica variant="ghost" cuando se pasa', () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('hover:bg-muted');
    });
  });

  describe('sizes', () => {
    it('aplica size="default" por defecto', () => {
      render(<Button>Default size</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('h-8');
    });

    it('aplica size="sm" cuando se pasa', () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('h-7');
    });

    it('aplica size="lg" cuando se pasa', () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('h-9');
    });
  });

  describe('interacción', () => {
    it('dispara onClick cuando se hace click', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<Button onClick={handleClick}>Clickable</Button>);
      await user.click(screen.getByRole('button'));

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('NO dispara onClick cuando está disabled', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(
        <Button disabled onClick={handleClick}>
          Disabled
        </Button>,
      );
      await user.click(screen.getByRole('button'));

      expect(handleClick).not.toHaveBeenCalled();
    });

    it('soporta navegación por teclado (Enter dispara click)', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<Button onClick={handleClick}>Keyboard</Button>);
      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Enter}');

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('accesibilidad', () => {
    it('expone aria-disabled cuando disabled', () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('respeta aria-label custom', () => {
      render(<Button aria-label="Cerrar sesión">X</Button>);
      expect(
        screen.getByRole('button', { name: /cerrar sesión/i }),
      ).toBeInTheDocument();
    });
  });
});

describe('buttonVariants — generador de clases', () => {
  it('genera clases con variant + size', () => {
    const classes = buttonVariants({ variant: 'destructive', size: 'sm' });
    expect(classes).toContain('text-destructive');
    expect(classes).toContain('h-7');
  });

  it('usa defaultVariants cuando no se pasa nada', () => {
    const classes = buttonVariants({});
    expect(classes).toContain('bg-primary');
    expect(classes).toContain('h-8');
  });
});
