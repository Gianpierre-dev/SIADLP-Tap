'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiGet } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { DataTable, Column } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DownloadIcon, SearchIcon } from 'lucide-react';

// Backend local por defecto (igual que en api.ts) para la descarga via fetch directo
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4020/api';

interface AuditEntry {
  id: number;
  accion: string;
  modulo: string;
  entidadId: number | null;
  detalle: string | null;
  ip: string | null;
  fechaCreacion: string;
  usuario: { id: number; nombre: string; correo: string };
}

interface AuditResponse {
  data: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

interface UserOption {
  id: number;
  nombre: string;
  correo: string;
}

const PAGE_SIZE = 20;

// Acciones posibles registradas por el interceptor de auditoria
const actions = ['crear', 'editar', 'eliminar'];

const modules = [
  'autenticacion',
  'usuarios',
  'roles',
  'clientes',
  'productos',
  'rutas',
  'vehiculos',
  'choferes',
  'pedidos',
  'despacho',
  'empresa',
  'auditoria',
];

const actionLabels: Record<string, string> = {
  crear: 'Crear',
  editar: 'Editar',
  eliminar: 'Eliminar',
};

const actionVariant: Record<string, 'default' | 'secondary' | 'destructive'> = {
  crear: 'default',
  editar: 'secondary',
  eliminar: 'destructive',
};

interface Filters {
  usuarioId: string;
  accion: string;
  modulo: string;
  desde: string;
  hasta: string;
}

const EMPTY_FILTERS: Filters = {
  usuarioId: '',
  accion: '',
  modulo: '',
  desde: '',
  hasta: '',
};

// Arma los query params a partir de los filtros (compartido por fetch y export)
function buildFilterParams(f: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (f.usuarioId) params.set('usuarioId', f.usuarioId);
  if (f.accion) params.set('accion', f.accion);
  if (f.modulo) params.set('modulo', f.modulo);
  if (f.desde) params.set('desde', f.desde);
  if (f.hasta) params.set('hasta', f.hasta);
  return params;
}

export default function AuditoriaPage() {
  const { hasPermission } = useAuthStore();

  const [data, setData] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [users, setUsers] = useState<UserOption[]>([]);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);

  const fetchData = useCallback(
    (currentPage: number, currentFilters: Filters) => {
      setLoading(true);
      const params = buildFilterParams(currentFilters);
      params.set('page', String(currentPage));
      params.set('pageSize', String(PAGE_SIZE));
      apiGet<AuditResponse>(`/audit?${params.toString()}`)
        .then((res) => {
          setData(res.data);
          setTotal(res.total);
        })
        .catch(() => toast.error('Error al cargar el registro de auditoría'))
        .finally(() => setLoading(false));
    },
    [],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData(page, applied);
  }, [fetchData, page, applied]);

  // Carga de usuarios para el filtro, guardada por permiso
  useEffect(() => {
    if (!hasPermission('usuarios.leer')) return;
    apiGet<UserOption[]>('/users')
      .then((res) => setUsers(res))
      .catch(() => toast.error('Error al cargar los usuarios'));
  }, [hasPermission]);

  // Descarga el Excel respetando los filtros aplicados
  const handleExport = async () => {
    setExporting(true);
    try {
      const params = buildFilterParams(applied);
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/audit/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Error al exportar');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'auditoria.xlsx';
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Excel exportado correctamente');
    } catch {
      toast.error('Error al exportar el Excel');
    } finally {
      setExporting(false);
    }
  };

  const handleApply = () => {
    setPage(1);
    setApplied({ ...filters });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const columns: Column<AuditEntry>[] = [
    { key: 'id', label: 'ID', className: 'w-12' },
    {
      key: 'fechaCreacion',
      label: 'Fecha',
      className: 'w-24',
      render: (row) => (
        <span className="text-[0.65rem] leading-tight">
          {new Date(row.fechaCreacion).toLocaleString('es-PE', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
        </span>
      ),
    },
    {
      key: 'usuario',
      label: 'Usuario',
      className: 'max-w-[6rem]',
      render: (row) => (
        <span className="block truncate text-sm font-medium" title={`${row.usuario.nombre} — ${row.usuario.correo}`}>
          {row.usuario.nombre}
        </span>
      ),
    },
    {
      key: 'accion',
      label: 'Acción',
      className: 'w-24',
      render: (row) => (
        <div className="flex flex-col">
          <Badge variant={actionVariant[row.accion] ?? 'secondary'}>
            {actionLabels[row.accion] ?? row.accion}
          </Badge>
          {row.entidadId !== null && row.entidadId !== undefined && (
            <span className="mt-0.5 text-[0.6rem] text-muted-foreground">
              #{row.entidadId}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'modulo',
      label: 'Módulo',
      className: 'w-20',
      render: (row) => (
        <span className="capitalize text-xs">{row.modulo}</span>
      ),
    },
    {
      key: 'detalle',
      label: 'Detalle',
      className: 'max-w-[8rem]',
      render: (row) => (
        <span className="block truncate text-xs text-muted-foreground" title={row.detalle ?? undefined}>
          {row.detalle ?? '—'}
        </span>
      ),
    },
    {
      key: 'ip',
      label: 'IP',
      className: 'w-20',
      render: (row) => (
        <span className="text-[0.65rem] font-mono">{row.ip ?? '—'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoría"
        description="Registro de acciones realizadas en el sistema"
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-md border bg-card p-4">
        {hasPermission('usuarios.leer') && (
          <div className="space-y-1.5">
            <Label htmlFor="usuario">Usuario</Label>
            <select
              id="usuario"
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={filters.usuarioId}
              onChange={(e) =>
                setFilters((f) => ({ ...f, usuarioId: e.target.value }))
              }
            >
              <option value="">Todos</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="accion">Acción</Label>
          <select
            id="accion"
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={filters.accion}
            onChange={(e) => setFilters((f) => ({ ...f, accion: e.target.value }))}
          >
            <option value="">Todas</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {actionLabels[a] ?? a}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="modulo">Módulo</Label>
          <select
            id="modulo"
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={filters.modulo}
            onChange={(e) => setFilters((f) => ({ ...f, modulo: e.target.value }))}
          >
            <option value="">Todos</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="audit-desde">Desde</Label>
          <Input
            id="audit-desde"
            type="date"
            value={filters.desde}
            onChange={(e) => setFilters((f) => ({ ...f, desde: e.target.value }))}
            className="w-40"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="audit-hasta">Hasta</Label>
          <Input
            id="audit-hasta"
            type="date"
            value={filters.hasta}
            onChange={(e) => setFilters((f) => ({ ...f, hasta: e.target.value }))}
            className="w-40"
          />
        </div>

        <Button onClick={handleApply}>
          <SearchIcon className="mr-2 h-4 w-4" />
          Aplicar
        </Button>

        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          <DownloadIcon className="mr-2 h-4 w-4" />
          {exporting ? 'Exportando…' : 'Exportar Excel'}
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        pagination={{ page, pageSize: PAGE_SIZE, total }}
        onPageChange={handlePageChange}
        emptyMessage="No hay registros de auditoría para los filtros aplicados"
      />
    </div>
  );
}
