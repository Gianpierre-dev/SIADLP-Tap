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
import {
  PlusIcon,
  Loader2Icon,
  Trash2Icon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Order {
  id: number;
  clienteId: number;
  fechaEntrega: string;
  estado: string;
  total: string;
  observacion: string | null;
  fechaCreacion: string;
  cliente: { id: number; razonSocial: string };
  _count: { detalles: number };
}

interface OrderDetail {
  id: number;
  productoId: number;
  cantidad: string;
  precioUnitario: string;
  subtotal: string;
  producto: { id: number; nombre: string; codigoSku: string; precioBase: string };
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
    ruta?: { id: number; nombre: string; tarifa: string };
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
  precioBase: string;
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

const PAGE_SIZE = 20;

const STATE_COLORS: Record<string, string> = {
  REGISTERED: 'bg-blue-100 text-blue-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  DISPATCHED: 'bg-yellow-100 text-yellow-800',
  ON_ROUTE: 'bg-amber-100 text-amber-800',
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  COLLECTED: 'bg-purple-100 text-purple-800',
  CANCELLED: 'bg-red-100 text-red-800',
  ISSUE: 'bg-orange-100 text-orange-800',
};

const STATE_LABELS: Record<string, string> = {
  REGISTERED: 'Registrado',
  CONFIRMED: 'Confirmado',
  DISPATCHED: 'Despachado',
  ON_ROUTE: 'En Ruta',
  DELIVERED: 'Entregado',
  COLLECTED: 'Cobrado',
  CANCELLED: 'Cancelado',
  ISSUE: 'Novedad',
};

const EMPTY_LINE: OrderLine = { productoId: 0, cantidad: 0 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function formatTotal(value: string): string {
  return `S/ ${Number(value).toFixed(2)}`;
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PedidosPage() {
  // List state
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Catalog data
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clienteId, setClienteId] = useState<number | ''>('');
  const [fechaEntrega, setFechaEntrega] = useState('');
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
    apiGet<PaginatedResponse>(`/orders?page=${targetPage}&pageSize=${PAGE_SIZE}`)
      .then((res) => {
        setOrders(res.data);
        setTotal(res.total);
      })
      .catch(() => toast.error('Error al cargar pedidos'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders(page);
  }, [page]);

  useEffect(() => {
    apiGet<Client[]>('/catalogs/clients')
      .then(setClients)
      .catch(() => toast.error('Error al cargar clientes'));

    apiGet<Product[]>('/catalogs/products')
      .then(setProducts)
      .catch(() => toast.error('Error al cargar productos'));
  }, []);

  // ── Create dialog ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setClienteId('');
    setFechaEntrega('');
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

    setSaving(true);
    try {
      await apiPost('/orders', {
        clienteId: Number(clienteId),
        fechaEntrega,
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
      key: 'fechaEntrega',
      label: 'Fecha Entrega',
      className: 'w-32',
      render: (row) => formatDate(row.fechaEntrega),
    },
    {
      key: 'estado',
      label: 'Estado',
      className: 'w-32',
      render: (row) => <StateBadge estado={row.estado} />,
    },
    {
      key: 'total',
      label: 'Total',
      className: 'w-28 text-right',
      render: (row) => formatTotal(row.total),
    },
    {
      key: 'fechaCreacion',
      label: 'Fecha Creación',
      className: 'w-32',
      render: (row) => formatDate(row.fechaCreacion),
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
          <Button onClick={openCreate}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Nuevo Pedido
          </Button>
        }
      />

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
                  onChange={(e) => setFechaEntrega(e.target.value)}
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
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={line.productoId || ''}
                        onChange={(e) =>
                          updateLine(idx, 'productoId', Number(e.target.value))
                        }
                      >
                        <option value="">Seleccionar producto</option>
                        {products
                          .filter((p) => p.activo)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              [{p.codigoSku}] {p.nombre}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="w-28">
                      <Input
                        type="number"
                        min={1}
                        placeholder="Cant."
                        value={line.cantidad || ''}
                        onChange={(e) =>
                          updateLine(idx, 'cantidad', Number(e.target.value))
                        }
                      />
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
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-semibold">{formatTotal(selectedOrder.total)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fecha de Entrega</p>
                  <p>{formatDate(selectedOrder.fechaEntrega)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fecha de Creación</p>
                  <p>{formatDate(selectedOrder.fechaCreacion)}</p>
                </div>
                {selectedOrder.cliente.ruta && (
                  <div>
                    <p className="text-muted-foreground">Ruta</p>
                    <p>{selectedOrder.cliente.ruta.nombre}</p>
                  </div>
                )}
                {selectedOrder.observacion && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Observación</p>
                    <p>{selectedOrder.observacion}</p>
                  </div>
                )}
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
                        <th className="text-right px-3 py-2">P. Unitario</th>
                        <th className="text-right px-3 py-2">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedOrder.detalles.map((d) => (
                        <tr key={d.id}>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                            {d.producto.codigoSku}
                          </td>
                          <td className="px-3 py-2">{d.producto.nombre}</td>
                          <td className="px-3 py-2 text-right">{d.cantidad}</td>
                          <td className="px-3 py-2 text-right">
                            {formatTotal(d.precioUnitario)}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            {formatTotal(d.subtotal)}
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
