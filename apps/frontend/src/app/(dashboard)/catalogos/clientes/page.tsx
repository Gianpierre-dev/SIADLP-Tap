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
}

interface Client {
  id: number;
  razonSocial: string;
  nombreComercial: string | null;
  ruc: string | null;
  direccion: string;
  telefono: string | null;
  contacto: string | null;
  ubigeo: string | null;
  rutaId: number;
  activo: boolean;
  ruta: { nombre: string };
}

interface ClientForm {
  razonSocial: string;
  nombreComercial: string;
  ruc: string;
  direccion: string;
  telefono: string;
  contacto: string;
  ubigeo: string;
  rutaId: number | '';
}

const EMPTY_FORM: ClientForm = {
  razonSocial: '',
  nombreComercial: '',
  ruc: '',
  direccion: '',
  telefono: '',
  contacto: '',
  ubigeo: '',
  rutaId: '',
};

export default function ClientesPage() {
  const [items, setItems] = useState<Client[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);

  const fetchItems = () => {
    setLoading(true);
    apiGet<Client[]>('/catalogs/clients')
      .then(setItems)
      .catch(() => toast.error('Error al cargar clientes'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
    apiGet<Route[]>('/catalogs/routes')
      .then(setRoutes)
      .catch(() => toast.error('Error al cargar rutas'));
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (item: Client) => {
    setEditingId(item.id);
    setForm({
      razonSocial: item.razonSocial,
      nombreComercial: item.nombreComercial ?? '',
      ruc: item.ruc ?? '',
      direccion: item.direccion,
      telefono: item.telefono ?? '',
      contacto: item.contacto ?? '',
      ubigeo: item.ubigeo ?? '',
      rutaId: item.rutaId,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      razonSocial: form.razonSocial,
      nombreComercial: form.nombreComercial || undefined,
      ruc: form.ruc || undefined,
      direccion: form.direccion,
      telefono: form.telefono || undefined,
      contacto: form.contacto || undefined,
      ubigeo: form.ubigeo || undefined,
      rutaId: Number(form.rutaId),
    };
    try {
      if (editingId) {
        await apiPatch(`/catalogs/clients/${editingId}`, payload);
        toast.success('Cliente actualizado correctamente');
      } else {
        await apiPost('/catalogs/clients', payload);
        toast.success('Cliente creado correctamente');
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
    if (!confirm('¿Está seguro de desactivar este cliente?')) return;
    try {
      await apiDelete(`/catalogs/clients/${id}`);
      toast.success('Cliente desactivado correctamente');
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al desactivar');
    }
  };

  const columns: Column<Client>[] = [
    { key: 'id', label: 'ID', className: 'w-16' },
    { key: 'razonSocial', label: 'Razón Social' },
    { key: 'ruc', label: 'RUC', className: 'w-32' },
    { key: 'direccion', label: 'Dirección' },
    {
      key: 'ruta',
      label: 'Ruta',
      className: 'w-36',
      render: (row) => row.ruta?.nombre ?? '—',
    },
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
        title="Clientes"
        description="Gestión del catálogo de clientes"
        action={
          <Button onClick={openCreate}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Nuevo Cliente
          </Button>
        }
      />
      <DataTable columns={columns} data={items} loading={loading} />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Nuevo'} Cliente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="razonSocial">Razón Social *</Label>
                <Input
                  id="razonSocial"
                  value={form.razonSocial}
                  onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nombreComercial">Nombre Comercial</Label>
                <Input
                  id="nombreComercial"
                  value={form.nombreComercial}
                  onChange={(e) => setForm({ ...form, nombreComercial: e.target.value })}
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
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="direccion">Dirección *</Label>
                <Input
                  id="direccion"
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                  required
                />
              </div>
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
              <div className="space-y-1.5">
                <Label htmlFor="ubigeo">Ubigeo</Label>
                <Input
                  id="ubigeo"
                  value={form.ubigeo}
                  onChange={(e) => setForm({ ...form, ubigeo: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rutaId">Ruta *</Label>
                <select
                  id="rutaId"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={form.rutaId}
                  onChange={(e) => setForm({ ...form, rutaId: e.target.value === '' ? '' : Number(e.target.value) })}
                  required
                >
                  <option value="">Seleccionar ruta</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
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
