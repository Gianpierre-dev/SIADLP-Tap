'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { DataTable, Column } from '@/components/data-table';
import { SearchableSelect } from '@/components/searchable-select';
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
import { PlusIcon, PencilIcon, Trash2Icon, RotateCcwIcon, Loader2Icon } from 'lucide-react';
import { useConfirm } from '@/components/confirm-dialog';
import { useAuthStore } from '@/lib/auth';

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

const PAGE_SIZE = 10;

export default function ClientesPage() {
  const [items, setItems] = useState<Client[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const askConfirm = useConfirm();
  const { hasPermission } = useAuthStore();
  const puedeCrear = hasPermission('clientes.crear');
  const puedeEliminar = hasPermission('clientes.eliminar');
  const [incluirInactivos, setIncluirInactivos] = useState(false);

  // Filtros + paginación client-side (el endpoint devuelve todo el array).
  const [busqueda, setBusqueda] = useState('');
  const [rutaFilter, setRutaFilter] = useState('');
  const [page, setPage] = useState(1);

  const [departamentos, setDepartamentos] = useState<UbigeoOption[]>([]);
  const [provinciasUbigeo, setProvinciasUbigeo] = useState<UbigeoOption[]>([]);
  const [distritos, setDistritos] = useState<UbigeoOption[]>([]);

  const fetchItems = () => {
    setLoading(true);
    apiGet<Client[]>(
      `/catalogs/clients${incluirInactivos ? '?incluirInactivos=true' : ''}`,
    )
      .then(setItems)
      .catch(() => toast.error('Error al cargar clientes'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incluirInactivos]);

  useEffect(() => {
    // Las rutas solo se usan en el formulario de alta/edición. Un rol de solo
    // lectura (ej. Chofer) no tiene permiso sobre rutas, así que evitamos la
    // llamada que devolvería 403.
    if (hasPermission('rutas.leer')) {
      apiGet<Route[]>('/catalogs/routes')
        .then(setRoutes)
        .catch(() => toast.error('Error al cargar rutas'));
    }
    apiGet<UbigeoOption[]>('/ubigeo/departamentos')
      .then(setDepartamentos)
      .catch(() => toast.error('Error al cargar departamentos'));
  }, [hasPermission]);

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
    if (
      !(await askConfirm({
        description: '¿Está seguro de desactivar este cliente?',
        confirmText: 'Desactivar',
        destructive: true,
      }))
    )
      return;
    try {
      await apiDelete(`/catalogs/clients/${id}`);
      toast.success('Cliente desactivado correctamente');
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al desactivar');
    }
  };

  const handleReactivate = async (id: number) => {
    try {
      await apiPatch(`/catalogs/clients/${id}/reactivar`, {});
      toast.success('Cliente reactivado correctamente');
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al reactivar');
    }
  };

  // Aplica búsqueda (Razón Social o RUC) y filtro por ruta sobre el array completo.
  const filtradas = items.filter((c) => {
    const q = busqueda.trim().toLowerCase();
    const coincideBusqueda =
      q === '' ||
      c.razonSocial.toLowerCase().includes(q) ||
      (c.ruc ?? '').toLowerCase().includes(q);
    const coincideRuta = rutaFilter === '' || c.rutaId === Number(rutaFilter);
    return coincideBusqueda && coincideRuta;
  });

  const total = filtradas.length;
  const paginadas = filtradas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const onBusquedaChange = (value: string) => {
    setBusqueda(value);
    setPage(1);
  };

  const onRutaChange = (value: string) => {
    setRutaFilter(value);
    setPage(1);
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setRutaFilter('');
    setPage(1);
  };

  const columns: Column<Client>[] = [
    { key: 'id', label: 'ID', className: 'w-12' },
    {
      key: 'razonSocial',
      label: 'Razón Social',
      className: 'max-w-[11rem]',
      render: (row) => (
        <span className="block truncate text-sm" title={row.razonSocial}>
          {row.razonSocial}
        </span>
      ),
    },
    { key: 'ruc', label: 'RUC', className: 'w-24 text-xs' },
    {
      key: 'direccion',
      label: 'Dirección',
      className: 'max-w-[10rem]',
      render: (row) => (
        <span className="block truncate text-xs" title={row.direccion ?? ''}>
          {row.direccion ?? '—'}
        </span>
      ),
    },
    {
      key: 'ruta',
      label: 'Ruta',
      className: 'w-24',
      render: (row) => (
        <span className="block truncate text-xs" title={row.ruta?.nombre ?? ''}>
          {row.ruta?.nombre ?? '—'}
        </span>
      ),
    },
    {
      key: 'activo',
      label: 'Estado',
      className: 'w-20',
      render: (row) => (
        <Badge variant={row.activo ? 'default' : 'secondary'}>
          {row.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      className: 'w-20',
      render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            <PencilIcon className="h-4 w-4" />
          </Button>
          {row.activo ? (
            <Button variant="ghost" size="sm" onClick={() => handleDeactivate(row.id)}>
              <Trash2Icon className="h-4 w-4 text-destructive" />
            </Button>
          ) : (
            puedeEliminar && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleReactivate(row.id)}
                title="Reactivar"
              >
                <RotateCcwIcon className="h-4 w-4 text-primary" />
              </Button>
            )
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
          puedeCrear ? (
            <Button onClick={openCreate}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Nuevo Cliente
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="busqueda" className="text-xs text-muted-foreground">
            Buscar
          </Label>
          <Input
            id="busqueda"
            value={busqueda}
            onChange={(e) => onBusquedaChange(e.target.value)}
            placeholder="Razón Social o RUC"
            className="w-64"
          />
        </div>

        {hasPermission('rutas.leer') && routes.length > 0 && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="rutaFilter" className="text-xs text-muted-foreground">
              Ruta
            </Label>
            <select
              id="rutaFilter"
              value={rutaFilter}
              onChange={(e) => onRutaChange(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Todas</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        {(busqueda || rutaFilter) && (
          <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
            Limpiar filtros
          </Button>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={incluirInactivos}
            onChange={(e) => {
              setIncluirInactivos(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-input"
          />
          Ver inactivos
        </label>
      </div>

      <DataTable
        columns={columns}
        data={paginadas}
        loading={loading}
        pagination={{ page, pageSize: PAGE_SIZE, total }}
        onPageChange={setPage}
      />
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
                {form.ruc && form.ruc.length !== 11 && (
                  <p className="text-xs text-destructive mt-1">
                    El RUC debe tener 11 dígitos ({11 - form.ruc.length > 0 ? `faltan ${11 - form.ruc.length}` : `sobran ${form.ruc.length - 11}`})
                  </p>
                )}
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
                {form.telefono && (form.telefono.length !== 9 || !form.telefono.startsWith('9')) && (
                  <p className="text-xs text-destructive mt-1">
                    {!form.telefono.startsWith('9') && form.telefono.length > 0
                      ? 'El teléfono debe empezar con 9'
                      : `El teléfono debe tener 9 dígitos (faltan ${9 - form.telefono.length})`}
                  </p>
                )}
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
                <SearchableSelect
                  options={departamentos.map((d) => ({
                    value: d.id,
                    label: d.nombre,
                  }))}
                  value={form.departamentoId}
                  onChange={handleDepartamentoChange}
                  placeholder="Seleccionar departamento"
                  searchPlaceholder="Buscar departamento..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="provincia">Provincia</Label>
                <SearchableSelect
                  options={provinciasUbigeo.map((p) => ({
                    value: p.id,
                    label: p.nombre,
                  }))}
                  value={form.provinciaId}
                  onChange={handleProvinciaChange}
                  disabled={!form.departamentoId}
                  placeholder="Seleccionar provincia"
                  searchPlaceholder="Buscar provincia..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="distrito">Distrito</Label>
                <SearchableSelect
                  options={distritos.map((d) => ({
                    value: d.id,
                    label: d.nombre,
                  }))}
                  value={form.distritoId}
                  onChange={handleDistritoChange}
                  disabled={!form.provinciaId}
                  placeholder="Seleccionar distrito"
                  searchPlaceholder="Buscar distrito..."
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="rutaId">Ruta *</Label>
                <SearchableSelect
                  options={routes.map((r) => ({ value: r.id, label: r.nombre }))}
                  value={form.rutaId}
                  onChange={(v) => setForm({ ...form, rutaId: v })}
                  placeholder="Seleccionar ruta"
                  searchPlaceholder="Buscar ruta..."
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
