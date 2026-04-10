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

interface Driver {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  licencia: string | null;
  telefono: string | null;
  activo: boolean;
}

interface DriverForm {
  nombre: string;
  apellido: string;
  dni: string;
  licencia: string;
  telefono: string;
}

const EMPTY_FORM: DriverForm = {
  nombre: '',
  apellido: '',
  dni: '',
  licencia: '',
  telefono: '',
};

export default function ChoferesPage() {
  const [items, setItems] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DriverForm>(EMPTY_FORM);

  const fetchItems = () => {
    setLoading(true);
    apiGet<Driver[]>('/catalogs/drivers')
      .then(setItems)
      .catch(() => toast.error('Error al cargar choferes'))
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

  const openEdit = (item: Driver) => {
    setEditingId(item.id);
    setForm({
      nombre: item.nombre,
      apellido: item.apellido,
      dni: item.dni,
      licencia: item.licencia ?? '',
      telefono: item.telefono ?? '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      nombre: form.nombre,
      apellido: form.apellido,
      dni: form.dni,
      ...(form.licencia ? { licencia: form.licencia } : {}),
      ...(form.telefono ? { telefono: form.telefono } : {}),
    };
    try {
      if (editingId) {
        await apiPatch(`/catalogs/drivers/${editingId}`, payload);
        toast.success('Chofer actualizado correctamente');
      } else {
        await apiPost('/catalogs/drivers', payload);
        toast.success('Chofer creado correctamente');
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
    if (!confirm('¿Está seguro de desactivar este chofer?')) return;
    try {
      await apiDelete(`/catalogs/drivers/${id}`);
      toast.success('Chofer desactivado correctamente');
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al desactivar');
    }
  };

  const columns: Column<Driver>[] = [
    { key: 'id', label: 'ID', className: 'w-16' },
    {
      key: 'nombre',
      label: 'Nombre Completo',
      render: (row) => `${row.nombre} ${row.apellido}`,
    },
    { key: 'dni', label: 'DNI' },
    {
      key: 'licencia',
      label: 'Licencia',
      render: (row) => row.licencia ?? '—',
    },
    {
      key: 'telefono',
      label: 'Teléfono',
      render: (row) => row.telefono ?? '—',
    },
    {
      key: 'activo',
      label: 'Estado',
      render: (row) => (
        <Badge variant={row.activo ? 'default' : 'secondary'}>
          {row.activo ? 'Activo' : 'Inactivo'}
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
          {row.activo && (
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
        title="Choferes"
        description="Gestión de choferes de distribución"
        action={
          <Button onClick={openCreate}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Nuevo Chofer
          </Button>
        }
      />
      <DataTable columns={columns} data={items} loading={loading} />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Nuevo'} Chofer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Nombre del chofer"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apellido">Apellido *</Label>
              <Input
                id="apellido"
                value={form.apellido}
                onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                placeholder="Apellido del chofer"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dni">DNI *</Label>
              <Input
                id="dni"
                value={form.dni}
                onChange={(e) => setForm({ ...form, dni: e.target.value.replace(/\D/g, '') })}
                placeholder="12345678"
                maxLength={8}
                minLength={8}
                pattern="[0-9]{8}"
                inputMode="numeric"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="licencia">Licencia</Label>
              <Input
                id="licencia"
                value={form.licencia}
                onChange={(e) => setForm({ ...form, licencia: e.target.value })}
                placeholder="Número de licencia"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                inputMode="numeric"
                maxLength={9}
                minLength={9}
                pattern="9[0-9]{8}"
                placeholder="987654321"
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
