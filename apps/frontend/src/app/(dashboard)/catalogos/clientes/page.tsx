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

interface UbigeoOption {
  id: string;
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
  departamentoId: string | null;
  provinciaId: string | null;
  distritoId: string | null;
  departamento: { id: string; nombre: string } | null;
  provincia: { id: string; nombre: string } | null;
  distrito: { id: string; nombre: string } | null;
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
  departamentoId: string;
  provinciaId: string;
  distritoId: string;
  rutaId: number | '';
}

const EMPTY_FORM: ClientForm = {
  razonSocial: '',
  nombreComercial: '',
  ruc: '',
  direccion: '',
  telefono: '',
  contacto: '',
  departamentoId: '',
  provinciaId: '',
  distritoId: '',
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

  const [departamentos, setDepartamentos] = useState<UbigeoOption[]>([]);
  const [provinciasUbigeo, setProvinciasUbigeo] = useState<UbigeoOption[]>([]);
  const [distritos, setDistritos] = useState<UbigeoOption[]>([]);

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
    apiGet<UbigeoOption[]>('/ubigeo/departamentos')
      .then(setDepartamentos)
      .catch(() => toast.error('Error al cargar departamentos'));
  }, []);

  const handleDepartamentoChange = (departamentoId: string) => {
    setForm((prev) => ({ ...prev, departamentoId, provinciaId: '', distritoId: '' }));
    setProvinciasUbigeo([]);
    setDistritos([]);
    if (departamentoId) {
      apiGet<UbigeoOption[]>(`/ubigeo/provincias/${departamentoId}`)
        .then(setProvinciasUbigeo)
        .catch(() => {});
    }
  };

  const handleProvinciaChange = (provinciaId: string) => {
    setForm((prev) => ({ ...prev, provinciaId, distritoId: '' }));
    setDistritos([]);
    if (provinciaId) {
      apiGet<UbigeoOption[]>(`/ubigeo/distritos/${provinciaId}`)
        .then(setDistritos)
        .catch(() => {});
    }
  };

  const handleDistritoChange = (distritoId: string) => {
    setForm((prev) => ({ ...prev, distritoId }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setProvinciasUbigeo([]);
    setDistritos([]);
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
      departamentoId: item.departamentoId ?? '',
      provinciaId: item.provinciaId ?? '',
      distritoId: item.distritoId ?? '',
      rutaId: item.rutaId,
    });
    setProvinciasUbigeo([]);
    setDistritos([]);
    if (item.departamentoId) {
      apiGet<UbigeoOption[]>(`/ubigeo/provincias/${item.departamentoId}`)
        .then(setProvinciasUbigeo)
        .catch(() => {});
    }
    if (item.provinciaId) {
      apiGet<UbigeoOption[]>(`/ubigeo/distritos/${item.provinciaId}`)
        .then(setDistritos)
        .catch(() => {});
    }
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
      departamentoId: form.departamentoId || undefined,
      provinciaId: form.provinciaId || undefined,
      distritoId: form.distritoId || undefined,
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
      key: 'ubicacion',
      label: 'Ubicación',
      render: (row) => {
        const parts = [row.distrito?.nombre, row.provincia?.nombre].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : '—';
      },
    },
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

  const selectClassName =
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

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
                  onChange={(e) => setForm({ ...form, ruc: e.target.value.replace(/\D/g, '') })}
                  maxLength={11}
                  minLength={11}
                  pattern="[0-9]{11}"
                  inputMode="numeric"
                  placeholder="20123456789"
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
                  onChange={(e) => setForm({ ...form, telefono: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                  inputMode="numeric"
                  maxLength={9}
                  minLength={9}
                  pattern="9[0-9]{8}"
                  placeholder="987654321"
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
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="departamento">Departamento</Label>
                <select
                  id="departamento"
                  className={selectClassName}
                  value={form.departamentoId}
                  onChange={(e) => handleDepartamentoChange(e.target.value)}
                >
                  <option value="">Seleccionar departamento</option>
                  {departamentos.map((d) => (
                    <option key={d.id} value={d.id}>{d.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="provincia">Provincia</Label>
                <select
                  id="provincia"
                  className={selectClassName}
                  value={form.provinciaId}
                  onChange={(e) => handleProvinciaChange(e.target.value)}
                  disabled={!form.departamentoId}
                >
                  <option value="">Seleccionar provincia</option>
                  {provinciasUbigeo.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="distrito">Distrito</Label>
                <select
                  id="distrito"
                  className={selectClassName}
                  value={form.distritoId}
                  onChange={(e) => handleDistritoChange(e.target.value)}
                  disabled={!form.provinciaId}
                >
                  <option value="">Seleccionar distrito</option>
                  {distritos.map((d) => (
                    <option key={d.id} value={d.id}>{d.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="rutaId">Ruta *</Label>
                <select
                  id="rutaId"
                  className={selectClassName}
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
