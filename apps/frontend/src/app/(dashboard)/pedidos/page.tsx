'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
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
  Loader2Icon,
  Trash2Icon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChevronsUpDownIcon,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Order {
  id: number;
  clienteId: number;
  fechaEntrega: string;
  horaEntrega: string | null;
  estado: string;
  observacion: string | null;
  fechaCreacion: string;
  cliente: { id: number; razonSocial: string; ruta?: { nombre: string } };
  _count: { detalles: number };
}

interface OrderDetail {
  id: number;
  productoId: number;
  cantidad: string;
  producto: { id: number; nombre: string; codigoSku: string; unidadMedida: string };
}

interface OrderFull extends Omit<Order, '_count'> {
  detalles: OrderDetail[];
  estadoLogs: Array<{
    estadoAnterior: string | null;
    estadoNuevo: string;
    motivo: string | null;
    fechaCreacion: string;
    usuario: { id: number; nombre: string };
  }>;
  cliente: {
    id: number;
    razonSocial: string;
    ruc: string | null;
    direccion: string;
    telefono: string | null;
    distrito: { nombre: string } | null;
    ruta?: { id: number; nombre: string };
  };
}

interface Client {
  id: number;
  razonSocial: string;
  activo: boolean;
}

interface Product {
  id: number;
  nombre: string;
  codigoSku: string;
  unidadMedida: string;
  activo: boolean;
}

interface PaginatedResponse {
  data: Order[];
  total: number;
  page: number;
  pageSize: number;
}

interface OrderLine {
  productoId: number;
  cantidad: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const STATE_COLORS: Record<string, string> = {
  REGISTERED: 'bg-[#e3f2fd] text-[#1565c0]',
  CONFIRMED:  'bg-[#e8f5e9] text-[#33691e]',
  DISPATCHED: 'bg-[#fff3c4] text-[#8a6914]',
  ON_ROUTE:   'bg-[#fef3c7] text-[#d97706]',
  DELIVERED:  'bg-[#e8f5e9] text-[#245216]',
  CANCELLED:  'bg-[#fee2e2] text-[#c62828]',
  ISSUE:      'bg-[#fef3c7] text-[#d97706]',
};

const STATE_LABELS: Record<string, string> = {
  REGISTERED: 'Registrado',
  CONFIRMED: 'Confirmado',
  DISPATCHED: 'Despachado',
  ON_ROUTE: 'En Ruta',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
  ISSUE: 'Novedad',
};

const EMPTY_LINE: OrderLine = { productoId: 0, cantidad: 0 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

// Fecha + hora en la zona horaria local del operador (Perú en su navegador).
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StateBadge({ estado }: { estado: string }) {
  const colorClass = STATE_COLORS[estado] ?? 'bg-gray-100 text-gray-800';
  return (
    <Badge className={`${colorClass} border-0`}>
      {STATE_LABELS[estado] ?? estado}
    </Badge>
  );
}

// Combobox de productos con búsqueda — reemplaza al <select> nativo, que se
// vuelve inusable con muchos productos. Tipeás SKU o nombre y filtra.
function ProductCombobox({
  products,
  value,
  onChange,
}: {
  products: Product[];
  value: number;
  onChange: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const selected = products.find((p) => p.id === value);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? products.filter((p) =>
        `${p.codigoSku} ${p.nombre}`.toLowerCase().includes(q),
      )
    : products;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-left text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span className={selected ? 'truncate' : 'truncate text-muted-foreground'}>
          {selected
            ? `[${selected.codigoSku}] ${selected.nombre}`
            : 'Seleccionar producto'}
        </span>
        <ChevronsUpDownIcon className="h-4 w-4 shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="border-b p-2">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por SKU o nombre..."
              className="h-8"
            />
          </div>
          <div className="max-h-48 overflow-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                Sin resultados
              </div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-accent ${
                    p.id === value ? 'bg-accent' : ''
                  }`}
                >
                  [{p.codigoSku}] {p.nombre}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PedidosPage() {
  const { hasPermission } = useAuthStore();
  const puedeCrear = hasPermission('pedidos.crear');

  const router = useRouter();

  // List state
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  // Filtro por estado, inicializado desde el query param (?estado=) sin useSearchParams
  const [estadoFilter, setEstadoFilter] = useState<string>(() =>
    typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('estado') ?? '')
      : '',
  );
  const [rutaFilter, setRutaFilter] = useState('');
  const [clienteFilter, setClienteFilter] = useState('');
  const [rutas, setRutas] = useState<{ id: number; nombre: string }[]>([]);
  const [clientesFiltro, setClientesFiltro] = useState<Client[]>([]);

  // Catalog data
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clienteId, setClienteId] = useState<number | ''>('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [horaEntrega, setHoraEntrega] = useState('');
  const [observacion, setObservacion] = useState('');
  const [lines, setLines] = useState<OrderLine[]>([{ ...EMPTY_LINE }]);

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderFull | null>(null);

  // Status change
  const [statusSaving, setStatusSaving] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchOrders = (targetPage: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(targetPage));
    params.set('pageSize', String(PAGE_SIZE));
    if (estadoFilter) params.set('estado', estadoFilter);
    if (rutaFilter) params.set('rutaId', rutaFilter);
    if (clienteFilter) params.set('clienteId', clienteFilter);
    apiGet<PaginatedResponse>(`/orders?${params.toString()}`)
      .then((res) => {
        setOrders(res.data);
        setTotal(res.total);
      })
      .catch(() => toast.error('Error al cargar pedidos'))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchOrders(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, estadoFilter, rutaFilter, clienteFilter]);

  const onEstadoChange = (value: string) => {
    setEstadoFilter(value);
    setPage(1);
    router.replace(`/pedidos${value ? `?estado=${value}` : ''}`);
  };

  const onRutaChange = (value: string) => {
    setRutaFilter(value);
    setPage(1);
  };

  const onClienteChange = (value: string) => {
    setClienteFilter(value);
    setPage(1);
  };

  const limpiarFiltros = () => {
    setEstadoFilter('');
    setRutaFilter('');
    setClienteFilter('');
    setPage(1);
    router.replace('/pedidos');
  };

  useEffect(() => {
    if (!puedeCrear) return;
    apiGet<Client[]>('/catalogs/clients')
      .then(setClients)
      .catch(() => toast.error('Error al cargar clientes'));

    apiGet<Product[]>('/catalogs/products')
      .then(setProducts)
      .catch(() => toast.error('Error al cargar productos'));
  }, [puedeCrear]);

  // Catálogos para los filtros de la lista (rutas y clientes), independientes
  // del permiso de creación — un lector puede filtrar sin poder crear.
  useEffect(() => {
    if (hasPermission('rutas.leer')) {
      apiGet<{ id: number; nombre: string }[]>('/catalogs/routes')
        .then(setRutas)
        .catch(() => {});
    }
    if (hasPermission('clientes.leer')) {
      apiGet<Client[]>('/catalogs/clients')
        .then(setClientesFiltro)
        .catch(() => {});
    }
  }, [hasPermission]);

  // ── Create dialog ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setClienteId('');
    setFechaEntrega('');
    setHoraEntrega('');
    setObservacion('');
    setLines([{ ...EMPTY_LINE }]);
    setCreateOpen(true);
  };

  const addLine = () => setLines((prev) => [...prev, { ...EMPTY_LINE }]);

  const removeLine = (index: number) =>
    setLines((prev) => prev.filter((_, i) => i !== index));

  const updateLine = (index: number, field: keyof OrderLine, value: number) =>
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    const validLines = lines.filter((l) => l.productoId > 0 && l.cantidad > 0);
    if (validLines.length === 0) {
      toast.error('Agregá al menos una línea con producto y cantidad válidos');
      return;
    }
    if (!clienteId) {
      toast.error('Seleccioná un cliente');
      return;
    }
    if (!fechaEntrega) {
      toast.error('Ingresá la fecha de entrega');
      return;
    }
    if (fechaEntrega < new Date().toLocaleDateString('en-CA')) {
      toast.error('La fecha de entrega no puede ser anterior a hoy');
      return;
    }
    if (!horaEntrega) {
      toast.error('Ingresá la hora de entrega');
      return;
    }

    setSaving(true);
    try {
      await apiPost('/orders', {
        clienteId: Number(clienteId),
        fechaEntrega,
        horaEntrega,
        observacion: observacion || undefined,
        detalles: validLines.map((l) => ({
          productoId: l.productoId,
          cantidad: l.cantidad,
        })),
      });
      toast.success('Pedido creado correctamente');
      setCreateOpen(false);
      fetchOrders(page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear pedido');
    } finally {
      setSaving(false);
    }
  };

  // ── Detail dialog ──────────────────────────────────────────────────────────

  const openDetail = (order: Order) => {
    setSelectedOrder(null);
    setDetailOpen(true);
    setDetailLoading(true);
    apiGet<OrderFull>(`/orders/${order.id}`)
      .then(setSelectedOrder)
      .catch(() => toast.error('Error al cargar detalle del pedido'))
      .finally(() => setDetailLoading(false));
  };

  // ── Status changes ─────────────────────────────────────────────────────────

  const confirmOrder = async () => {
    if (!selectedOrder) return;
    setStatusSaving(true);
    try {
      await apiPatch(`/orders/${selectedOrder.id}/status`, {
        nuevoEstado: 'CONFIRMED',
      });
      toast.success('Pedido confirmado');
      setDetailOpen(false);
      fetchOrders(page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al confirmar');
    } finally {
      setStatusSaving(false);
    }
  };

  const openCancelDialog = () => {
    setCancelMotivo('');
    setCancelOpen(true);
  };

  const cancelOrder = async () => {
    if (!selectedOrder) return;
    setStatusSaving(true);
    try {
      await apiPatch(`/orders/${selectedOrder.id}/status`, {
        nuevoEstado: 'CANCELLED',
        motivo: cancelMotivo || undefined,
      });
      toast.success('Pedido cancelado');
      setCancelOpen(false);
      setDetailOpen(false);
      fetchOrders(page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cancelar');
    } finally {
      setStatusSaving(false);
    }
  };

  // ── Table columns ──────────────────────────────────────────────────────────

  const columns: Column<Order>[] = [
    { key: 'id', label: 'ID', className: 'w-16' },
    {
      key: 'cliente',
      label: 'Cliente',
      render: (row) => row.cliente.razonSocial,
    },
    {
      key: 'ruta',
      label: 'Ruta',
      className: 'w-32',
      render: (row) => row.cliente.ruta?.nombre ?? '—',
    },
    {
      key: 'items',
      label: 'Ítems',
      className: 'w-20',
      render: (row) => row._count.detalles,
    },
    {
      key: 'fechaEntrega',
      label: 'Fecha Entrega',
      className: 'w-36',
      render: (row) =>
        row.horaEntrega
          ? `${formatDate(row.fechaEntrega)} · ${row.horaEntrega}`
          : formatDate(row.fechaEntrega),
    },
    {
      key: 'estado',
      label: 'Estado',
      className: 'w-32',
      render: (row) => <StateBadge estado={row.estado} />,
    },
    {
      key: 'fechaCreacion',
      label: 'Fecha y hora',
      className: 'w-44',
      render: (row) => formatDateTime(row.fechaCreacion),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      className: 'w-24',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            openDetail(row);
          }}
        >
          Ver
        </Button>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos"
        description="Gestión de pedidos de clientes"
        action={
          puedeCrear ? (
            <Button onClick={openCreate}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Nuevo Pedido
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="estadoFilter" className="text-xs text-muted-foreground">
            Estado
          </Label>
          <select
            id="estadoFilter"
            value={estadoFilter}
            onChange={(e) => onEstadoChange(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Todos</option>
            {Object.entries(STATE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {rutas.length > 0 && (
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
              {rutas.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        {clientesFiltro.length > 0 && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="clienteFilter" className="text-xs text-muted-foreground">
              Cliente
            </Label>
            <select
              id="clienteFilter"
              value={clienteFilter}
              onChange={(e) => onClienteChange(e.target.value)}
              className="flex h-9 max-w-[220px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Todos</option>
              {clientesFiltro.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.razonSocial}
                </option>
              ))}
            </select>
          </div>
        )}

        {(estadoFilter || rutaFilter || clienteFilter) && (
          <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
            Limpiar filtros
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={orders}
        loading={loading}
        pagination={{ page, pageSize: PAGE_SIZE, total }}
        onPageChange={setPage}
        onRowClick={openDetail}
      />

      {/* ── Create Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo Pedido</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-5">
            {/* Header fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="clienteId">Cliente *</Label>
                <select
                  id="clienteId"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={clienteId}
                  onChange={(e) =>
                    setClienteId(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  required
                >
                  <option value="">Seleccionar cliente</option>
                  {clients
                    .filter((c) => c.activo)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.razonSocial}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fechaEntrega">Fecha de Entrega *</Label>
                <Input
                  id="fechaEntrega"
                  type="date"
                  value={fechaEntrega}
                  min={new Date().toLocaleDateString('en-CA')}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="horaEntrega">Hora de Entrega *</Label>
                <Input
                  id="horaEntrega"
                  type="time"
                  value={horaEntrega}
                  onChange={(e) => setHoraEntrega(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="observacion">Observación</Label>
                <Input
                  id="observacion"
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Líneas de pedido *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Agregar línea
                </Button>
              </div>

              <div className="rounded-md border divide-y">
                {lines.map((line, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3">
                    <div className="flex-1">
                      <ProductCombobox
                        products={products.filter((p) => p.activo)}
                        value={line.productoId}
                        onChange={(id) => updateLine(idx, 'productoId', id)}
                      />
                    </div>
                    <div className="w-36 flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        placeholder="Cant."
                        value={line.cantidad || ''}
                        onChange={(e) =>
                          updateLine(idx, 'cantidad', Number(e.target.value))
                        }
                      />
                      <span className="text-sm text-muted-foreground w-12 shrink-0">
                        {products.find((p) => p.id === line.productoId)?.unidadMedida ?? ''}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={lines.length === 1}
                      onClick={() => removeLine(idx)}
                    >
                      <Trash2Icon className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
                Crear Pedido
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedOrder
                ? `Pedido #${selectedOrder.id} — ${selectedOrder.cliente.razonSocial}`
                : 'Cargando pedido…'}
            </DialogTitle>
          </DialogHeader>

          {detailLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!detailLoading && selectedOrder && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Estado</p>
                  <StateBadge estado={selectedOrder.estado} />
                </div>
                <div>
                  <p className="text-muted-foreground">Fecha de Entrega</p>
                  <p>
                    {formatDate(selectedOrder.fechaEntrega)}
                    {selectedOrder.horaEntrega &&
                      ` · ${selectedOrder.horaEntrega}`}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fecha y hora del pedido</p>
                  <p>{formatDateTime(selectedOrder.fechaCreacion)}</p>
                </div>
                {selectedOrder.observacion && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Observación</p>
                    <p>{selectedOrder.observacion}</p>
                  </div>
                )}
              </div>

              {/* Datos del cliente / entrega */}
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="text-sm font-medium mb-2">Datos del cliente</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-muted-foreground">RUC</p>
                    <p>{selectedOrder.cliente.ruc ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Teléfono</p>
                    <p>{selectedOrder.cliente.telefono ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Distrito</p>
                    <p>{selectedOrder.cliente.distrito?.nombre ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ruta de reparto</p>
                    <p className="font-medium">
                      {selectedOrder.cliente.ruta?.nombre ?? '—'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Dirección de entrega</p>
                    <p>{selectedOrder.cliente.direccion}</p>
                  </div>
                </div>
              </div>

              {/* Line items */}
              <div>
                <p className="text-sm font-medium mb-2">Detalle del pedido</p>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2">SKU</th>
                        <th className="text-left px-3 py-2">Producto</th>
                        <th className="text-right px-3 py-2">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedOrder.detalles.map((d) => (
                        <tr key={d.id}>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                            {d.producto.codigoSku}
                          </td>
                          <td className="px-3 py-2">{d.producto.nombre}</td>
                          <td className="px-3 py-2 text-right">
                            {d.cantidad} {d.producto.unidadMedida}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Estado log */}
              {selectedOrder.estadoLogs.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Historial de estados</p>
                  <div className="space-y-2">
                    {selectedOrder.estadoLogs.map((log, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm">
                        <ClockIcon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {log.estadoAnterior && (
                              <>
                                <StateBadge estado={log.estadoAnterior} />
                                <span className="text-muted-foreground">→</span>
                              </>
                            )}
                            <StateBadge estado={log.estadoNuevo} />
                            <span className="text-muted-foreground text-xs">
                              {formatDate(log.fechaCreacion)} · {log.usuario.nombre}
                            </span>
                          </div>
                          {log.motivo && (
                            <p className="text-muted-foreground mt-0.5">{log.motivo}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {selectedOrder.estado === 'REGISTERED' && (
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={openCancelDialog}
                    disabled={statusSaving}
                  >
                    <XCircleIcon className="h-4 w-4 mr-2 text-destructive" />
                    Cancelar pedido
                  </Button>
                  <Button onClick={confirmOrder} disabled={statusSaving}>
                    {statusSaving ? (
                      <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircleIcon className="h-4 w-4 mr-2" />
                    )}
                    Confirmar
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Cancel Motivo Dialog ──────────────────────────────────────────── */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Podés ingresar un motivo de cancelación (opcional).
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="cancelMotivo">Motivo</Label>
              <Input
                id="cancelMotivo"
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                placeholder="Ej: Cliente solicitó anulación"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Volver
            </Button>
            <Button variant="destructive" onClick={cancelOrder} disabled={statusSaving}>
              {statusSaving && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
              Confirmar cancelación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
