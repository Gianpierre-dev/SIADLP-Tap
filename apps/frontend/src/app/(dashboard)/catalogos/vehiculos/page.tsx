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
import {
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  Loader2Icon,
  RotateCcwIcon,
} from 'lucide-react';
import { useConfirm } from '@/components/confirm-dialog';
import { useAuthStore } from '@/lib/auth';

interface Vehicle {
  id: number;
  placa: string;
  marca: string | null;
  modelo: string | null;
  capacidadKg: string; // Decimal from Prisma
  activo: boolean;
}

interface VehicleForm {
  placa: string;
  marca: string;
  modelo: string;
  capacidadKg: number;
}

const EMPTY_FORM: VehicleForm = {
  placa: '',
  marca: '',
  modelo: '',
  capacidadKg: 0,
};

const PAGE_SIZE = 10;

export default function VehiculosPage() {
  const [items, setItems] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<VehicleForm>(EMPTY_FORM);
  // Busqueda + paginacion client-side
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [verInactivos, setVerInactivos] = useState(false);
  const askConfirm = useConfirm();

  const fetchItems = (incluirInactivos = verInactivos) => {
    setLoading(true);
    apiGet<Vehicle[]>(
      `/catalogs/vehicles${incluirInactivos ? '?incluirInactivos=true' : ''}`,
    )
      .then(setItems)
      .catch(() => toast.error('Error al cargar vehículos'))
      .finally(() => setLoading(false));
  };

  const { hasPermission } = useAuthStore();

  useEffect(() => {
    if (hasPermission('vehiculos.leer')) fetchItems();
  }, [hasPermission]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (item: Vehicle) => {
    setEditingId(item.id);
    setForm({
      placa: item.placa,
      marca: item.marca ?? '',
      modelo: item.modelo ?? '',
      capacidadKg: Number(item.capacidadKg),
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      placa: form.placa,
      capacidadKg: form.capacidadKg,
      ...(form.marca ? { marca: form.marca } : {}),
      ...(form.modelo ? { modelo: form.modelo } : {}),
    };
    try {
      if (editingId) {
        await apiPatch(`/catalogs/vehicles/${editingId}`, payload);
        toast.success('Vehículo actualizado correctamente');
      } else {
        await apiPost('/catalogs/vehicles', payload);
        toast.success('Vehículo creado correctamente');
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
        description: '¿Está seguro de desactivar este vehículo?',
        confirmText: 'Desactivar',
        destructive: true,
      }))
    )
      return;
    try {
      await apiDelete(`/catalogs/vehicles/${id}`);
      toast.success('Vehículo desactivado correctamente');
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al desactivar');
    }
  };

  const handleReactivate = async (id: number) => {
    try {
      await apiPatch(`/catalogs/vehicles/${id}/reactivar`, {});
      toast.success('Vehículo reactivado correctamente');
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al reactivar');
    }
  };

  const toggleVerInactivos = (checked: boolean) => {
    setVerInactivos(checked);
    setPage(1);
    fetchItems(checked);
  };

  // Filtrado client-side por placa, marca o modelo (case-insensitive)
  const filtradas = items.filter((v) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      v.placa.toLowerCase().includes(q) ||
      (v.marca ?? '').toLowerCase().includes(q) ||
      (v.modelo ?? '').toLowerCase().includes(q)
    );
  });
  const total = filtradas.length;
  const pageItems = filtradas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<Vehicle>[] = [
    { key: 'id', label: 'ID', className: 'w-16' },
    { key: 'placa', label: 'Placa' },
    {
      key: 'marca',
      label: 'Marca',
      render: (row) => row.marca ?? '—',
    },
    {
      key: 'modelo',
      label: 'Modelo',
      render: (row) => row.modelo ?? '—',
    },
    {
      key: 'capacidadKg',
      label: 'Capacidad',
      render: (row) => `${Number(row.capacidadKg).toFixed(0)} kg`,
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
          {row.activo ? (
            <Button variant="ghost" size="sm" onClick={() => handleDeactivate(row.id)}>
              <Trash2Icon className="h-4 w-4 text-destructive" />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => handleReactivate(row.id)}>
              <RotateCcwIcon className="h-4 w-4 text-emerald-600" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehículos"
        description="Gestión de vehículos de distribución"
        action={
          <Button onClick={openCreate}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Nuevo Vehículo
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
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Placa, marca o modelo"
            className="w-64"
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={verInactivos}
            onChange={(e) => toggleVerInactivos(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          Ver inactivos
        </label>
      </div>
      <DataTable
        columns={columns}
        data={pageItems}
        loading={loading}
        pagination={{ page, pageSize: PAGE_SIZE, total }}
        onPageChange={setPage}
      />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Nuevo'} Vehículo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="placa">Placa *</Label>
              <Input
                id="placa"
                value={form.placa}
                onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })}
                placeholder="ABC-123"
                maxLength={7}
                pattern="[A-Z0-9]{3}-[A-Z0-9]{3}"
                style={{ textTransform: 'uppercase' }}
                required
              />
              {form.placa && !/^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(form.placa) && (
                <p className="text-xs text-destructive mt-1">
                  La placa debe tener formato ABC-123
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="marca">Marca</Label>
              <Input
                id="marca"
                value={form.marca}
                onChange={(e) => setForm({ ...form, marca: e.target.value })}
                placeholder="Marca del vehículo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modelo">Modelo</Label>
              <Input
                id="modelo"
                value={form.modelo}
                onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                placeholder="Modelo del vehículo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacidadKg">Capacidad (kg) *</Label>
              <Input
                id="capacidadKg"
                type="number"
                min="0.01"
                step="0.01"
                value={form.capacidadKg}
                onChange={(e) =>
                  setForm({ ...form, capacidadKg: parseFloat(e.target.value) || 0 })
                }
                placeholder="0.00"
                required
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
