'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiGet } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { DataTable, Column } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SearchIcon } from 'lucide-react';

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

const PAGE_SIZE = 20;

const modules = [
  'autenticacion',
  'usuarios',
  'roles',
  'clientes',
  'proveedores',
  'productos',
  'rutas',
  'vehiculos',
  'choferes',
  'pedidos',
  'compras',
  'produccion',
  'inventario',
  'despacho',
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
  modulo: string;
  desde: string;
  hasta: string;
}

const EMPTY_FILTERS: Filters = { modulo: '', desde: '', hasta: '' };

export default function AuditoriaPage() {
  const [data, setData] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);

  const fetchData = useCallback(
    (currentPage: number, currentFilters: Filters) => {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(PAGE_SIZE),
        modulo: currentFilters.modulo,
        desde: currentFilters.desde,
        hasta: currentFilters.hasta,
      });
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
    fetchData(page, applied);
  }, [fetchData, page, applied]);

  const handleApply = () => {
    setPage(1);
    setApplied({ ...filters });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const columns: Column<AuditEntry>[] = [
    { key: 'id', label: 'ID', className: 'w-16' },
    {
      key: 'fechaCreacion',
      label: 'Fecha',
      className: 'w-44',
      render: (row) =>
        new Date(row.fechaCreacion).toLocaleString('es-PE', {
          dateStyle: 'short',
          timeStyle: 'short',
        }),
    },
    {
      key: 'usuario',
      label: 'Usuario',
      className: 'w-44',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium leading-tight">{row.usuario.nombre}</span>
          <span className="text-xs text-muted-foreground">{row.usuario.correo}</span>
        </div>
      ),
    },
    {
      key: 'accion',
      label: 'Acción',
      className: 'w-28',
      render: (row) => (
        <Badge variant={actionVariant[row.accion] ?? 'secondary'}>
          {actionLabels[row.accion] ?? row.accion}
        </Badge>
      ),
    },
    {
      key: 'modulo',
      label: 'Módulo',
      className: 'w-32',
      render: (row) => (
        <span className="capitalize">{row.modulo}</span>
      ),
    },
    {
      key: 'entidadId',
      label: 'Entidad ID',
      className: 'w-24',
      render: (row) => row.entidadId ?? '—',
    },
    {
      key: 'detalle',
      label: 'Detalle',
      render: (row) => (
        <span className="max-w-xs truncate block text-sm text-muted-foreground" title={row.detalle ?? undefined}>
          {row.detalle ?? '—'}
        </span>
      ),
    },
    {
      key: 'ip',
      label: 'IP',
      className: 'w-32',
      render: (row) => row.ip ?? '—',
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
