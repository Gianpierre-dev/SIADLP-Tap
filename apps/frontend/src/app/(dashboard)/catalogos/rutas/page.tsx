'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { DataTable, Column } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { PlusIcon, PencilIcon, Trash2Icon, Loader2Icon } from 'lucide-react';

interface Route {
  id: number;
  nombre: string;
  zona: string;
  tarifa: string; // Decimal from Prisma
  descripcion: string | null;
  activa: boolean;
}

interface RouteForm {
  nombre: string;
  zona: string;
  tarifa: number;
  descripcion: string;
}

const EMPTY_FORM: RouteForm = {
  nombre: '',
  zona: '',
  tarifa: 0,
  descripcion: '',
};

export default function RutasPage() {
  const [items, setItems] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<RouteForm>(EMPTY_FORM);

  const fetchItems = () => {
    setLoading(true);
    apiGet<Route[]>('/catalogs/routes')
      .then(setItems)
      .catch(() => toast.error('Error al cargar rutas'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (item: Route) => {
    setEditingId(item.id);
    setForm({
      nombre: item.nombre,
      zona: item.zona,
      tarifa: Number(item.tarifa),
      descripcion: item.descripcion ?? '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await apiPatch(`/catalogs/routes/${editingId}`, form);
        toast.success('Ruta actualizada correctamente');
      } else {
        await apiPost('/catalogs/routes', form);
        toast.success('Ruta creada correctamente');
      }
      setDialogOpen(false);
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm('¿Está seguro de desactivar esta ruta?')) return;
    try {
      await apiDelete(`/catalogs/routes/${id}`);
      toast.success('Ruta desactivada correctamente');
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al desactivar');
    }
  };

  const columns: Column<Route>[] = [
    { key: 'id', label: 'ID', className: 'w-16' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'zona', label: 'Zona' },
    {
      key: 'tarifa',
      label: 'Tarifa (S/)',
      render: (row) => `S/ ${Number(row.tarifa).toFixed(2)}`,
    },
    {
      key: 'descripcion',
      label: 'Descripción',
      render: (row) => row.descripcion ?? '—',
    },
    {
      key: 'activa',
      label: 'Estado',
      render: (row) => (
        <Badge variant={row.activa ? 'default' : 'secondary'}>
          {row.activa ? 'Activa' : 'Inactiva'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      className: 'w-24',
      render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            <PencilIcon className="h-4 w-4" />
          </Button>
          {row.activa && (
            <Button variant="ghost" size="sm" onClick={() => handleDeactivate(row.id)}>
              <Trash2Icon className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rutas"
        description="Gestión de rutas de distribución"
        action={
          <Button onClick={openCreate}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Nueva Ruta
          </Button>
        }
      />
      <DataTable columns={columns} data={items} loading={loading} />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Nueva'} Ruta</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Nombre de la ruta"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zona">Zona *</Label>
              <Input
                id="zona"
                value={form.zona}
                onChange={(e) => setForm({ ...form, zona: e.target.value })}
                placeholder="Zona de cobertura"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tarifa">Tarifa (S/) *</Label>
              <Input
                id="tarifa"
                type="number"
                min="0"
                step="0.01"
                value={form.tarifa}
                onChange={(e) =>
                  setForm({ ...form, tarifa: parseFloat(e.target.value) || 0 })
                }
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Input
                id="descripcion"
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Descripción opcional"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
                {editingId ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
