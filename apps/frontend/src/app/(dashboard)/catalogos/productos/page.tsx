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

interface Product {
  id: number;
  nombre: string;
  codigoSku: string;
  descripcion: string | null;
  unidadMedida: string;
  activo: boolean;
}

interface ProductForm {
  nombre: string;
  codigoSku: string;
  descripcion: string;
  unidadMedida: string;
}

const EMPTY_FORM: ProductForm = {
  nombre: '',
  codigoSku: '',
  descripcion: '',
  unidadMedida: '',
};

export default function ProductosPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);

  const fetchItems = () => {
    setLoading(true);
    apiGet<Product[]>('/catalogs/products')
      .then(setItems)
      .catch(() => toast.error('Error al cargar productos'))
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

  const openEdit = (item: Product) => {
    setEditingId(item.id);
    setForm({
      nombre: item.nombre,
      codigoSku: item.codigoSku,
      descripcion: item.descripcion ?? '',
      unidadMedida: item.unidadMedida,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      nombre: form.nombre,
      codigoSku: form.codigoSku,
      descripcion: form.descripcion || undefined,
      unidadMedida: form.unidadMedida,
    };
    try {
      if (editingId) {
        await apiPatch(`/catalogs/products/${editingId}`, payload);
        toast.success('Producto actualizado correctamente');
      } else {
        await apiPost('/catalogs/products', payload);
        toast.success('Producto creado correctamente');
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
    if (!confirm('¿Está seguro de desactivar este producto?')) return;
    try {
      await apiDelete(`/catalogs/products/${id}`);
      toast.success('Producto desactivado correctamente');
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al desactivar');
    }
  };

  const columns: Column<Product>[] = [
    { key: 'id', label: 'ID', className: 'w-16' },
    { key: 'codigoSku', label: 'SKU', className: 'w-32' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'unidadMedida', label: 'Unidad', className: 'w-24' },
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
        title="Productos"
        description="Gestión del catálogo de productos"
        action={
          <Button onClick={openCreate}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Nuevo Producto
          </Button>
        }
      />
      <DataTable columns={columns} data={items} loading={loading} />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Nuevo'} Producto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="codigoSku">Código SKU *</Label>
                <Input
                  id="codigoSku"
                  value={form.codigoSku}
                  onChange={(e) => setForm({ ...form, codigoSku: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unidadMedida">Unidad de Medida *</Label>
                <Input
                  id="unidadMedida"
                  value={form.unidadMedida}
                  onChange={(e) => setForm({ ...form, unidadMedida: e.target.value })}
                  placeholder="ej. kg, und, lt"
                  required
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="descripcion">Descripción</Label>
                <Input
                  id="descripcion"
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
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
