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

interface Supplier {
  id: number;
  razonSocial: string;
  ruc: string | null;
  direccion: string | null;
  telefono: string | null;
  contacto: string | null;
  activo: boolean;
}

interface SupplierForm {
  razonSocial: string;
  ruc: string;
  direccion: string;
  telefono: string;
  contacto: string;
}

const EMPTY_FORM: SupplierForm = {
  razonSocial: '',
  ruc: '',
  direccion: '',
  telefono: '',
  contacto: '',
};

export default function ProveedoresPage() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SupplierForm>(EMPTY_FORM);

  const fetchItems = () => {
    setLoading(true);
    apiGet<Supplier[]>('/catalogs/suppliers')
      .then(setItems)
      .catch(() => toast.error('Error al cargar proveedores'))
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

  const openEdit = (item: Supplier) => {
    setEditingId(item.id);
    setForm({
      razonSocial: item.razonSocial,
      ruc: item.ruc ?? '',
      direccion: item.direccion ?? '',
      telefono: item.telefono ?? '',
      contacto: item.contacto ?? '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      razonSocial: form.razonSocial,
      ruc: form.ruc || undefined,
      direccion: form.direccion || undefined,
      telefono: form.telefono || undefined,
      contacto: form.contacto || undefined,
    };
    try {
      if (editingId) {
        await apiPatch(`/catalogs/suppliers/${editingId}`, payload);
        toast.success('Proveedor actualizado correctamente');
      } else {
        await apiPost('/catalogs/suppliers', payload);
        toast.success('Proveedor creado correctamente');
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
    if (!confirm('¿Está seguro de desactivar este proveedor?')) return;
    try {
      await apiDelete(`/catalogs/suppliers/${id}`);
      toast.success('Proveedor desactivado correctamente');
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al desactivar');
    }
  };

  const columns: Column<Supplier>[] = [
    { key: 'id', label: 'ID', className: 'w-16' },
    { key: 'razonSocial', label: 'Razón Social' },
    { key: 'ruc', label: 'RUC', className: 'w-32' },
    { key: 'telefono', label: 'Teléfono', className: 'w-32' },
    { key: 'contacto', label: 'Contacto', className: 'w-40' },
    {
      key: 'activo',
      label: 'Estado',
      className: 'w-24',
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
        title="Proveedores"
        description="Gestión del catálogo de proveedores"
        action={
          <Button onClick={openCreate}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Nuevo Proveedor
          </Button>
        }
      />
      <DataTable columns={columns} data={items} loading={loading} />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="@sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Nuevo'} Proveedor</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="razonSocial">Razón Social *</Label>
              <Input
                id="razonSocial"
                value={form.razonSocial}
                onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ruc">RUC</Label>
              <Input
                id="ruc"
                value={form.ruc}
                onChange={(e) => setForm({ ...form, ruc: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contacto">Contacto</Label>
                <Input
                  id="contacto"
                  value={form.contacto}
                  onChange={(e) => setForm({ ...form, contacto: e.target.value })}
                />
              </div>
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
