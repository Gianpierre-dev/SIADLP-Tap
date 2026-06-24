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
  KeyRoundIcon,
  CopyIcon,
  CheckIcon,
} from 'lucide-react';
import { useConfirm } from '@/components/confirm-dialog';

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

const PAGE_SIZE = 10;

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

// Select de filtros (sin w-full, ancho según contenido).
const FILTER_SELECT_CLASS =
  'flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

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
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [contrasenaTemporal, setContrasenaTemporal] = useState<string | null>(null);
  const [resetting, setResetting] = useState<number | null>(null);
  const [copiado, setCopiado] = useState(false);
  const askConfirm = useConfirm();

  // Búsqueda + filtro por rol + paginación client-side.
  const [search, setSearch] = useState('');
  const [rolFilter, setRolFilter] = useState('');
  const [page, setPage] = useState(1);

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
    if (
      !(await askConfirm({
        description: '¿Está seguro de desactivar este usuario?',
        confirmText: 'Desactivar',
        destructive: true,
      }))
    )
      return;
    try {
      await apiDelete(`/users/${id}`);
      toast.success('Usuario desactivado correctamente');
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al desactivar usuario');
    }
  };

  const handleResetPassword = async (user: User) => {
    const confirmar = await askConfirm({
      title: 'Resetear contraseña',
      description:
        `¿Resetear la contraseña de ${user.nombre}?\n\n` +
        'Se generará una contraseña temporal que el usuario deberá cambiar al iniciar sesión.',
      confirmText: 'Resetear',
    });
    if (!confirmar) return;
    setResetting(user.id);
    try {
      const res = await apiPost<{ contrasenaTemporal: string }>(
        `/users/${user.id}/reset-password`,
        {},
      );
      setResetTarget(user);
      setContrasenaTemporal(res.contrasenaTemporal);
      setResetDialogOpen(true);
      setCopiado(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Error al resetear la contraseña',
      );
    } finally {
      setResetting(null);
    }
  };

  const handleCopiarTemporal = async () => {
    if (!contrasenaTemporal) return;
    try {
      await navigator.clipboard.writeText(contrasenaTemporal);
      setCopiado(true);
      toast.success('Contraseña copiada al portapapeles');
    } catch {
      toast.error('No se pudo copiar. Selecciona y copia manualmente.');
    }
  };

  const isSelf = editingId !== null && editingId === currentUserId;

  // Filtrado client-side: búsqueda por nombre/correo + filtro por rol.
  const filtrados = items.filter((u) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      u.nombre.toLowerCase().includes(q) ||
      u.correo.toLowerCase().includes(q);
    const matchRol = !rolFilter || String(u.rolId) === rolFilter;
    return matchSearch && matchRol;
  });

  const total = filtrados.length;
  const pageData = filtrados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const onSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const onRolFilterChange = (value: string) => {
    setRolFilter(value);
    setPage(1);
  };

  // Opciones de rol para el filtro: usa /roles si están cargados; si no,
  // deriva de los roles presentes en la lista de usuarios.
  const rolesFiltro =
    roles.length > 0
      ? roles.map((r) => ({ id: r.id, nombre: r.nombre }))
      : Array.from(
          new Map(
            items
              .filter((u) => u.rol)
              .map((u) => [u.rolId, { id: u.rolId, nombre: u.rol.nombre }]),
          ).values(),
        );

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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEdit(row)}
            aria-label="Editar usuario"
          >
            <PencilIcon className="h-4 w-4" />
          </Button>
          {row.activo && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleResetPassword(row)}
              disabled={resetting === row.id}
              aria-label="Resetear contraseña"
              title="Resetear contraseña"
            >
              {resetting === row.id ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRoundIcon className="h-4 w-4 text-amber-600" />
              )}
            </Button>
          )}
          {row.activo && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeactivate(row.id)}
              aria-label="Desactivar usuario"
            >
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
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="search" className="text-xs text-muted-foreground">
            Buscar
          </Label>
          <Input
            id="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Nombre o correo"
            className="h-9 w-64"
          />
        </div>

        {rolesFiltro.length > 0 && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="rolFilter" className="text-xs text-muted-foreground">
              Rol
            </Label>
            <select
              id="rolFilter"
              value={rolFilter}
              onChange={(e) => onRolFilterChange(e.target.value)}
              className={FILTER_SELECT_CLASS}
            >
              <option value="">Todos</option>
              {rolesFiltro.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        {(search || rolFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setRolFilter('');
              setPage(1);
            }}
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={pageData}
        loading={loading}
        pagination={{ page, pageSize: PAGE_SIZE, total }}
        onPageChange={setPage}
      />

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

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Contraseña temporal generada</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {resetTarget?.nombre} debe usar esta contraseña para iniciar sesión.
              Se le pedirá cambiarla inmediatamente.
            </p>
            <div className="flex items-center gap-2 rounded-md border border-input bg-muted/50 px-3 py-2">
              <code className="flex-1 select-all font-mono text-sm">
                {contrasenaTemporal}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopiarTemporal}
                aria-label="Copiar contraseña"
              >
                {copiado ? (
                  <CheckIcon className="h-4 w-4 text-[#33691e]" />
                ) : (
                  <CopyIcon className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
            >
              <KeyRoundIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <p>
                Esta contraseña solo se muestra una vez. Compártela por un canal
                seguro y ciérrala una vez transmitida.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setResetDialogOpen(false)}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
