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

interface User {
  id: number;
  correo: string;
  nombre: string;
  activo: boolean;
  rolId: number;
  rol: { nombre: string };
}

interface Role {
  id: number;
  nombre: string;
  activo: boolean;
}

interface CreateForm {
  correo: string;
  contrasena: string;
  nombre: string;
  rolId: number | '';
}

interface EditForm {
  correo: string;
  nombre: string;
  rolId: number | '';
}

const EMPTY_CREATE: CreateForm = { correo: '', contrasena: '', nombre: '', rolId: '' };
const EMPTY_EDIT: EditForm = { correo: '', nombre: '', rolId: '' };

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export default function UsuariosPage() {
  const [items, setItems] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const fetchItems = () => {
    setLoading(true);
    apiGet<User[]>('/users')
      .then(setItems)
      .catch(() => toast.error('Error al cargar usuarios'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
    apiGet<Role[]>('/roles')
      .then(setRoles)
      .catch(() => toast.error('Error al cargar roles'));

    const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (raw) {
      try {
        const parsed: { id?: number } = JSON.parse(raw) as { id?: number };
        if (parsed.id) setCurrentUserId(parsed.id);
      } catch {
        // ignore
      }
    }
  }, []);

  const openCreate = () => {
    setMode('create');
    setEditingId(null);
    setCreateForm(EMPTY_CREATE);
    setDialogOpen(true);
  };

  const openEdit = (item: User) => {
    setMode('edit');
    setEditingId(item.id);
    setEditForm({ correo: item.correo, nombre: item.nombre, rolId: item.rolId });
    setDialogOpen(true);
  };

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!PASSWORD_REGEX.test(createForm.contrasena)) {
      toast.error('La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número');
      return;
    }
    setSaving(true);
    try {
      await apiPost('/users', {
        correo: createForm.correo,
        contrasena: createForm.contrasena,
        nombre: createForm.nombre,
        rolId: Number(createForm.rolId),
      });
      toast.success('Usuario creado correctamente');
      setDialogOpen(false);
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    try {
      await apiPatch(`/users/${editingId}`, {
        correo: editForm.correo,
        nombre: editForm.nombre,
        rolId: Number(editForm.rolId),
      });
      toast.success('Usuario actualizado correctamente');
      setDialogOpen(false);
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm('¿Está seguro de desactivar este usuario?')) return;
    try {
      await apiDelete(`/users/${id}`);
      toast.success('Usuario desactivado correctamente');
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al desactivar usuario');
    }
  };

  const isSelf = editingId !== null && editingId === currentUserId;

  const columns: Column<User>[] = [
    { key: 'id', label: 'ID', className: 'w-16' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'correo', label: 'Correo' },
    {
      key: 'rol',
      label: 'Rol',
      className: 'w-36',
      render: (row) => row.rol?.nombre ?? '—',
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
        title="Usuarios"
        description="Gestión de usuarios del sistema"
        action={
          <Button onClick={openCreate}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Nuevo Usuario
          </Button>
        }
      />
      <DataTable columns={columns} data={items} loading={loading} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{mode === 'create' ? 'Nuevo' : 'Editar'} Usuario</DialogTitle>
          </DialogHeader>

          {mode === 'create' ? (
            <form onSubmit={handleSubmitCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="c-nombre">Nombre *</Label>
                <Input
                  id="c-nombre"
                  value={createForm.nombre}
                  onChange={(e) => setCreateForm({ ...createForm, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-correo">Correo *</Label>
                <Input
                  id="c-correo"
                  type="email"
                  value={createForm.correo}
                  onChange={(e) => setCreateForm({ ...createForm, correo: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-contrasena">Contraseña *</Label>
                <Input
                  id="c-contrasena"
                  type="password"
                  value={createForm.contrasena}
                  onChange={(e) => setCreateForm({ ...createForm, contrasena: e.target.value })}
                  placeholder="Mín. 8 chars, mayúscula, minúscula y número"
                  minLength={8}
                  required
                />
                {createForm.contrasena && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(createForm.contrasena) && (
                  <p className="text-xs text-destructive mt-1">
                    {createForm.contrasena.length < 8
                      ? `Mínimo 8 caracteres (faltan ${8 - createForm.contrasena.length})`
                      : 'Debe incluir mayúscula, minúscula y número'}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-rol">Rol *</Label>
                <select
                  id="c-rol"
                  className={SELECT_CLASS}
                  value={createForm.rolId}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      rolId: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                  required
                >
                  <option value="">Seleccionar rol</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
                  Crear
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form onSubmit={handleSubmitEdit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="e-nombre">Nombre *</Label>
                <Input
                  id="e-nombre"
                  value={editForm.nombre}
                  onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-correo">Correo *</Label>
                <Input
                  id="e-correo"
                  type="email"
                  value={editForm.correo}
                  onChange={(e) => setEditForm({ ...editForm, correo: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-rol">Rol *</Label>
                <select
                  id="e-rol"
                  className={SELECT_CLASS}
                  value={editForm.rolId}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      rolId: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                  disabled={isSelf}
                  required
                >
                  <option value="">Seleccionar rol</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
                {isSelf && (
                  <p className="text-xs text-muted-foreground mt-1">
                    No podés cambiar tu propio rol.
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
                  Actualizar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
