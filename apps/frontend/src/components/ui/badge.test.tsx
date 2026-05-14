import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge, badgeVariants } from './badge';

describe('Badge', () => {
  describe('renderizado', () => {
    it('renderiza el children como texto', () => {
      render(<Badge>Activo</Badge>);
      expect(screen.getByText('Activo')).toBeInTheDocument();
    });

    it('renderiza por defecto como <span>', () => {
      render(<Badge>Tag</Badge>);
      const el = screen.getByText('Tag');
      expect(el.tagName).toBe('SPAN');
    });

    it('aplica el atributo data-slot="badge"', () => {
      render(<Badge>Tag</Badge>);
      expect(screen.getByText('Tag')).toHaveAttribute('data-slot', 'badge');
    });

    it('aplica className adicional pasado por prop', () => {
      render(<Badge className="my-custom-badge">Tag</Badge>);
      expect(screen.getByText('Tag')).toHaveClass('my-custom-badge');
    });
  });

  describe('variants', () => {
    it('aplica variant="default" por defecto (bg-primary)', () => {
      render(<Badge>Default</Badge>);
      expect(screen.getByText('Default').className).toContain('bg-primary');
    });

    it('aplica variant="secondary" cuando se pasa', () => {
      render(<Badge variant="secondary">Secondary</Badge>);
      expect(screen.getByText('Secondary').className).toContain('bg-secondary');
    });

    it('aplica variant="destructive" cuando se pasa', () => {
      render(<Badge variant="destructive">Destructive</Badge>);
      expect(screen.getByText('Destructive').className).toContain(
        'text-destructive',
      );
    });

    it('aplica variant="outline" cuando se pasa', () => {
      render(<Badge variant="outline">Outline</Badge>);
      expect(screen.getByText('Outline').className).toContain('border-border');
    });

    it('aplica variant="ghost" cuando se pasa', () => {
      render(<Badge variant="ghost">Ghost</Badge>);
      expect(screen.getByText('Ghost').className).toContain('hover:bg-muted');
    });

    it('aplica variant="link" cuando se pasa', () => {
      render(<Badge variant="link">Link</Badge>);
      expect(screen.getByText('Link').className).toContain('text-primary');
    });
  });

  describe('badgeVariants — generador de clases', () => {
    it('genera clases para variant="destructive"', () => {
      const classes = badgeVariants({ variant: 'destructive' });
      expect(classes).toContain('text-destructive');
    });

    it('usa defaultVariants cuando no se pasa nada', () => {
      const classes = badgeVariants({});
      expect(classes).toContain('bg-primary');
    });
  });
});
