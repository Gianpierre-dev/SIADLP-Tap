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
import { useConfirm } from '@/components/confirm-dialog';
import { useAuthStore } from '@/lib/auth';

// Categorías de licencia de conducir vigentes en Perú (MTC), agrupadas por clase.
const CATEGORIAS_POR_CLASE: Record<string, string[]> = {
  A: ['A-I', 'A-IIa', 'A-IIb', 'A-IIIa', 'A-IIIb', 'A-IIIc'],
  B: ['B-I', 'B-IIa', 'B-IIb', 'B-IIc'],
};

const SELECT_CLASS =
  'flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50';

// Select estilado para los filtros de la lista (estilo del módulo pedidos).
const FILTER_SELECT_CLASS =
  'flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

const PAGE_SIZE = 10;

// Estado del brevete según la fecha de revalidación comparada con hoy (Perú).
type BreveteEstado = 'vigente' | 'porVencer' | 'vencido' | 'sinFecha';

// Devuelve el estado del brevete: vencido si revalidación < hoy; por vencer si
// está entre hoy y hoy+30 días; vigente en otro caso.
function getBreveteEstado(fechaRevalidacion: string | null): BreveteEstado {
  if (!fechaRevalidacion) return 'sinFecha';
  const hoy = new Date().toLocaleDateString('en-CA');
  const reval = fechaRevalidacion.slice(0, 10);
  if (reval < hoy) return 'vencido';
  const limite = new Date();
  limite.setDate(limite.getDate() + 30);
  const limiteStr = limite.toLocaleDateString('en-CA');
  if (reval <= limiteStr) return 'porVencer';
  return 'vigente';
}

interface Driver {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  licencia: string;
  licenciaClase: string;
  licenciaCategoria: string;
  fechaRevalidacion: string;
  telefono: string | null;
  activo: boolean;
}

interface DriverForm {
  nombre: string;
  apellido: string;
  dni: string;
  licencia: string;
  licenciaClase: string;
  licenciaCategoria: string;
  fechaRevalidacion: string;
  telefono: string;
}

const EMPTY_FORM: DriverForm = {
  nombre: '',
  apellido: '',
  dni: '',
  licencia: '',
  licenciaClase: 'A',
  licenciaCategoria: 'A-IIb',
  fechaRevalidacion: '',
  telefono: '',
};

export default function ChoferesPage() {
  const [items, setItems] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [breveteFilter, setBreveteFilter] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DriverForm>(EMPTY_FORM);
  const askConfirm = useConfirm();

  const fetchItems = () => {
    setLoading(true);
    apiGet<Driver[]>('/catalogs/drivers')
      .then(setItems)
      .catch(() => toast.error('Error al cargar choferes'))
      .finally(() => setLoading(false));
  };

  const { hasPermission } = useAuthStore();

  useEffect(() => {
    if (hasPermission('choferes.leer')) fetchItems();
  }, [hasPermission]);

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
      licenciaClase: item.licenciaClase ?? 'A',
      licenciaCategoria: item.licenciaCategoria ?? 'A-IIb',
      fechaRevalidacion: item.fechaRevalidacion
        ? item.fechaRevalidacion.slice(0, 10)
        : '',
      telefono: item.telefono ?? '',
    });
    setDialogOpen(true);
  };

  // Al cambiar la clase, ajusta la categoría a la primera válida de esa clase.
  const handleClaseChange = (clase: string) => {
    const categorias = CATEGORIAS_POR_CLASE[clase] ?? [];
    setForm({
      ...form,
      licenciaClase: clase,
      licenciaCategoria: categorias[0] ?? '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      nombre: form.nombre,
      apellido: form.apellido,
      dni: form.dni,
      licencia: form.licencia.toUpperCase(),
      licenciaClase: form.licenciaClase,
      licenciaCategoria: form.licenciaCategoria,
      fechaRevalidacion: new Date(form.fechaRevalidacion).toISOString(),
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
    if (
      !(await askConfirm({
        description: '¿Está seguro de desactivar este chofer?',
        confirmText: 'Desactivar',
        destructive: true,
      }))
    )
      return;
    try {
      await apiDelete(`/catalogs/drivers/${id}`);
      toast.success('Chofer desactivado correctamente');
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al desactivar');
    }
  };

  // Búsqueda case-insensitive por nombre, apellido, DNI o licencia.
  const onSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const onBreveteChange = (value: string) => {
    setBreveteFilter(value);
    setPage(1);
  };

  // Filtrado client-side (búsqueda + estado de brevete).
  const filtradas = items.filter((d) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      d.nombre.toLowerCase().includes(q) ||
      d.apellido.toLowerCase().includes(q) ||
      d.dni.toLowerCase().includes(q) ||
      (d.licencia ?? '').toLowerCase().includes(q);
    const matchBrevete =
      !breveteFilter || getBreveteEstado(d.fechaRevalidacion) === breveteFilter;
    return matchSearch && matchBrevete;
  });

  const total = filtradas.length;
  const paginadas = filtradas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
      key: 'licenciaCategoria',
      label: 'Categoría',
      render: (row) => (
        <Badge variant="secondary">{row.licenciaCategoria}</Badge>
      ),
    },
    {
      key: 'telefono',
      label: 'Teléfono',
      render: (row) => row.telefono ?? '—',
    },
    {
      key: 'fechaRevalidacion',
      label: 'Revalidación',
      render: (row) => {
        if (!row.fechaRevalidacion) return '—';
        const estado = getBreveteEstado(row.fechaRevalidacion);
        // Marca visual: rojo para vencidos, ámbar para por vencer.
        const color =
          estado === 'vencido'
            ? 'text-destructive font-medium'
            : estado === 'porVencer'
              ? 'text-amber-600 font-medium'
              : '';
        return (
          <span className={color}>
            {new Date(row.fechaRevalidacion).toLocaleDateString('es-PE')}
          </span>
        );
      },
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

  const dniInvalido = form.dni.length > 0 && form.dni.length !== 8;
  const licenciaInvalida =
    form.licencia.length > 0 && form.licencia.length !== 9;
  const telefonoInvalido =
    form.telefono.length > 0 &&
    (form.telefono.length !== 9 || !form.telefono.startsWith('9'));

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
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="search" className="text-xs text-muted-foreground">
            Buscar
          </Label>
          <Input
            id="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Nombre, apellido, DNI o licencia"
            className="w-64"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="breveteFilter" className="text-xs text-muted-foreground">
            Brevete
          </Label>
          <select
            id="breveteFilter"
            value={breveteFilter}
            onChange={(e) => onBreveteChange(e.target.value)}
            className={FILTER_SELECT_CLASS}
          >
            <option value="">Todos</option>
            <option value="vigente">Vigentes</option>
            <option value="porVencer">Por vencer (≤30 días)</option>
            <option value="vencido">Vencidos</option>
          </select>
        </div>
        {(search || breveteFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setBreveteFilter('');
              setPage(1);
            }}
          >
            Limpiar filtros
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={paginadas}
        loading={loading}
        pagination={{ page, pageSize: PAGE_SIZE, total }}
        onPageChange={setPage}
      />
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
              {dniInvalido && (
                <p className="text-xs text-destructive mt-1">
                  El DNI debe tener 8 dígitos
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="licencia">N° de Licencia (Brevete) *</Label>
              <Input
                id="licencia"
                value={form.licencia}
                onChange={(e) =>
                  setForm({
                    ...form,
                    licencia: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9),
                  })
                }
                placeholder="Q12345678"
                maxLength={9}
                required
              />
              {licenciaInvalida && (
                <p className="text-xs text-destructive mt-1">
                  La licencia debe tener 9 caracteres
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="clase">Clase *</Label>
                <select
                  id="clase"
                  className={SELECT_CLASS}
                  value={form.licenciaClase}
                  onChange={(e) => handleClaseChange(e.target.value)}
                  required
                >
                  <option value="A">A (autos y camiones)</option>
                  <option value="B">B (motos / menores)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoría *</Label>
                <select
                  id="categoria"
                  className={SELECT_CLASS}
                  value={form.licenciaCategoria}
                  onChange={(e) => setForm({ ...form, licenciaCategoria: e.target.value })}
                  required
                >
                  {(CATEGORIAS_POR_CLASE[form.licenciaClase] ?? []).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fechaRevalidacion">Fecha de Revalidación *</Label>
              <Input
                id="fechaRevalidacion"
                type="date"
                value={form.fechaRevalidacion}
                onChange={(e) => setForm({ ...form, fechaRevalidacion: e.target.value })}
                required
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
              {telefonoInvalido && (
                <p className="text-xs text-destructive mt-1">
                  El teléfono debe tener 9 dígitos y empezar con 9
                </p>
              )}
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
