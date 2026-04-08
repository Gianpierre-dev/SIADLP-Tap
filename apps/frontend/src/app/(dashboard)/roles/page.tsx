'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
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
import { PlusIcon, PencilIcon, Loader2Icon } from 'lucide-react';

interface Permission {
  id: number;
  modulo: string;
  accion: string;
  descripcion: string | null;
}

interface Role {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  permisos: Array<{
    permisoId: number;
    permiso: { id: number; modulo: string; accion: string; descripcion: string | null };
  }>;
}

interface RoleListItem {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  permisos: Role['permisos'];
}

interface RoleForm {
  nombre: string;
  descripcion: string;
}

const EMPTY_FORM: RoleForm = { nombre: '', descripcion: '' };

const moduleLabels: Record<string, string> = {
  usuarios: 'Usuarios',
  roles: 'Roles',
  clientes: 'Clientes',
  proveedores: 'Proveedores',
  productos: 'Productos',
  rutas: 'Rutas',
  vehiculos: 'Vehículos',
  choferes: 'Choferes',
  pedidos: 'Pedidos',
  compras: 'Compras',
  produccion: 'Producción',
  inventario: 'Inventario',
  despacho: 'Despacho',
  reportes: 'Reportes',
  auditoria: 'Auditoría',
};

const CHECKBOX_CLASS =
  'h-4 w-4 rounded border border-input accent-primary cursor-pointer';

export default function RolesPage() {
  const [items, setItems] = useState<RoleListItem[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [permissionsError, setPermissionsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<RoleForm>(EMPTY_FORM);
  const [selectedPermisos, setSelectedPermisos] = useState<Set<number>>(new Set());

  const fetchItems = () => {
    setLoading(true);
    apiGet<RoleListItem[]>('/roles')
      .then(setItems)
      .catch(() => toast.error('Error al cargar roles'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
    setPermissionsLoading(true);
    setPermissionsError(false);
    apiGet<Permission[]>('/roles/permissions')
      .then(setPermissions)
      .catch(() => {
        setPermissionsError(true);
        toast.error('Error al cargar permisos');
      })
      .finally(() => setPermissionsLoading(false));
  }, []);

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    if (!acc[p.modulo]) acc[p.modulo] = [];
    acc[p.modulo].push(p);
    return acc;
  }, {});

  const openCreate = () => {
    setMode('create');
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSelectedPermisos(new Set());
    setDialogOpen(true);
  };

  const openEdit = async (item: RoleListItem) => {
    setMode('edit');
    setEditingId(item.id);
    setForm({ nombre: item.nombre, descripcion: item.descripcion ?? '' });
    setDialogOpen(true);

    // Fetch full role to get permisoIds
    try {
      const full = await apiGet<Role>(`/roles/${item.id}`);
      setSelectedPermisos(new Set(full.permisos.map((rp) => rp.permisoId)));
    } catch {
      toast.error('Error al cargar permisos del rol');
      setSelectedPermisos(new Set(item.permisos.map((rp) => rp.permisoId)));
    }
  };

  const togglePermiso = (id: number) => {
    setSelectedPermisos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllModule = (modulo: string) => {
    setSelectedPermisos((prev) => {
      const next = new Set(prev);
      grouped[modulo].forEach((p) => next.add(p.id));
      return next;
    });
  };

  const deselectAllModule = (modulo: string) => {
    setSelectedPermisos((prev) => {
      const next = new Set(prev);
      grouped[modulo].forEach((p) => next.delete(p.id));
      return next;
    });
  };

  const isModuleAllSelected = (modulo: string) =>
    grouped[modulo]?.every((p) => selectedPermisos.has(p.id)) ?? false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      nombre: form.nombre,
      descripcion: form.descripcion || undefined,
      permisoIds: Array.from(selectedPermisos),
    };
    try {
      if (mode === 'edit' && editingId) {
        await apiPatch(`/roles/${editingId}`, payload);
        toast.success('Rol actualizado correctamente');
      } else {
        await apiPost('/roles', payload);
        toast.success('Rol creado correctamente');
      }
      setDialogOpen(false);
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar rol');
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<RoleListItem>[] = [
    { key: 'id', label: 'ID', className: 'w-16' },
    { key: 'nombre', label: 'Nombre', className: 'w-40' },
    {
      key: 'descripcion',
      label: 'Descripción',
      render: (row) => row.descripcion ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'permisos',
      label: 'Permisos',
      className: 'w-24 text-center',
      render: (row) => (
        <Badge variant="outline">{row.permisos.length}</Badge>
      ),
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
      className: 'w-20',
      render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            <PencilIcon className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles"
        description="Gestión de roles y permisos del sistema"
        action={
          <Button onClick={openCreate}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Nuevo Rol
          </Button>
        }
      />
      <DataTable columns={columns} data={items} loading={loading} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="@sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === 'create' ? 'Nuevo' : 'Editar'} Rol</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="r-nombre">Nombre *</Label>
                <Input
                  id="r-nombre"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-descripcion">Descripción</Label>
                <Input
                  id="r-descripcion"
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Permisos</Label>
              {permissionsLoading && (
                <p className="text-sm text-muted-foreground">Cargando permisos...</p>
              )}
              {!permissionsLoading && permissionsError && (
                <p className="text-sm text-destructive">Error al cargar permisos. Intentá cerrar y volver a abrir el diálogo.</p>
              )}
              <div className="space-y-4">
                {Object.entries(grouped).map(([modulo, perms]) => {
                  const allSelected = isModuleAllSelected(modulo);
                  return (
                    <div key={modulo} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {moduleLabels[modulo] ?? modulo}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() =>
                            allSelected
                              ? deselectAllModule(modulo)
                              : selectAllModule(modulo)
                          }
                        >
                          {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-x-6 gap-y-2">
                        {perms.map((p) => (
                          <label
                            key={p.id}
                            className="flex items-center gap-1.5 cursor-pointer text-sm"
                          >
                            <input
                              type="checkbox"
                              className={CHECKBOX_CLASS}
                              checked={selectedPermisos.has(p.id)}
                              onChange={() => togglePermiso(p.id)}
                            />
                            {p.accion}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
                {mode === 'create' ? 'Crear' : 'Actualizar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
