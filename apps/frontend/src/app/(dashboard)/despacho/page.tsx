'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';
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
import { Loader2Icon, PlusIcon, TruckIcon } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoadSheet {
  id: number;
  fecha: string;
  estado: string;
  numeroGre: string | null;
  totalKg: string;
  totalMonto: string;
  ruta: { id: number; nombre: string; zona: string };
  vehiculo: { id: number; placa: string; marca: string };
  chofer: { id: number; nombre: string; apellido: string };
  _count: { pedidos: number };
}

interface RouteGroup {
  ruta: { id: number; nombre: string; zona: string };
  pedidos: Array<{
    id: number;
    total: number;
    cliente: { id: number; razonSocial: string; direccion: string; telefono: string | null };
  }>;
  totalKg: number;
  totalMonto: number;
}

interface DeliveryEntry {
  pedidoId: number;
  totalPedido: number;
  cliente: { razonSocial: string };
  entrega: {
    id: number;
    estado: string;
    montoCobrado: number | null;
    metodoPago: string | null;
    observacion: string | null;
    fechaEntrega: string | null;
  } | null;
}

interface LoadSheetFull extends LoadSheet {
  pedidos: Array<{
    id: number;
    total: string;
    cliente: { razonSocial: string; direccion: string };
    entrega: {
      id: number;
      estado: string;
      montoCobrado: number | null;
      metodoPago: string | null;
      observacion: string | null;
      fechaEntrega: string | null;
    } | null;
  }>;
}

interface Route {
  id: number;
  nombre: string;
  zona: string;
}

interface Vehicle {
  id: number;
  placa: string;
  marca: string;
}

interface Driver {
  id: number;
  nombre: string;
  apellido: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const stateColors: Record<string, string> = {
  PREPARANDO: 'bg-yellow-100 text-yellow-800',
  DESPACHADO: 'bg-blue-100 text-blue-800',
  EN_RUTA: 'bg-amber-100 text-amber-800',
  COMPLETADO: 'bg-green-100 text-green-800',
};

const stateLabels: Record<string, string> = {
  PREPARANDO: 'Preparando',
  DESPACHADO: 'Despachado',
  EN_RUTA: 'En Ruta',
  COMPLETADO: 'Completado',
};

const deliveryStateColors: Record<string, string> = {
  PENDIENTE: 'bg-gray-100 text-gray-800',
  ENTREGADO: 'bg-green-100 text-green-800',
  NOVEDAD: 'bg-orange-100 text-orange-800',
  COBRADO: 'bg-purple-100 text-purple-800',
};

const deliveryStateLabels: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  ENTREGADO: 'Entregado',
  NOVEDAD: 'Novedad',
  COBRADO: 'Cobrado',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function nativeSelectClass(): string {
  return 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
}

// ─── StateBadge ───────────────────────────────────────────────────────────────

function StateBadge({ estado, map, colorMap }: {
  estado: string;
  map: Record<string, string>;
  colorMap: Record<string, string>;
}) {
  return (
    <Badge className={`${colorMap[estado] ?? 'bg-gray-100 text-gray-800'} border-0`}>
      {map[estado] ?? estado}
    </Badge>
  );
}

// ─── Create Dialog ────────────────────────────────────────────────────────────

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  routes: Route[];
  vehicles: Vehicle[];
  drivers: Driver[];
}

function CreateDialog({ open, onClose, onSuccess, routes, vehicles, drivers }: CreateDialogProps) {
  const [fecha, setFecha] = useState('');
  const [rutaId, setRutaId] = useState<number | ''>('');
  const [vehiculoId, setVehiculoId] = useState<number | ''>('');
  const [choferId, setChoferId] = useState<number | ''>('');
  const [routeGroups, setRouteGroups] = useState<RouteGroup[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedPedidoIds, setSelectedPedidoIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setFecha('');
      setRutaId('');
      setVehiculoId('');
      setChoferId('');
      setRouteGroups([]);
      setSelectedPedidoIds(new Set());
    }
  }, [open]);

  // Fetch orders by route when fecha changes
  useEffect(() => {
    if (!fecha) {
      setRouteGroups([]);
      setSelectedPedidoIds(new Set());
      return;
    }
    setLoadingOrders(true);
    apiGet<RouteGroup[]>(`/dispatch/orders-by-route/${fecha}`)
      .then(setRouteGroups)
      .catch(() => toast.error('Error al cargar pedidos por ruta'))
      .finally(() => setLoadingOrders(false));
  }, [fecha]);

  // Filter groups for selected route
  const filteredGroups = rutaId
    ? routeGroups.filter((g) => g.ruta.id === Number(rutaId))
    : routeGroups;

  const togglePedido = (id: number) => {
    setSelectedPedidoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (group: RouteGroup) => {
    const ids = group.pedidos.map((p) => p.id);
    const allSelected = ids.every((id) => selectedPedidoIds.has(id));
    setSelectedPedidoIds((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fecha || !rutaId || !vehiculoId || !choferId) {
      toast.error('Completá todos los campos requeridos');
      return;
    }
    if (selectedPedidoIds.size === 0) {
      toast.error('Seleccioná al menos un pedido');
      return;
    }
    setSaving(true);
    try {
      await apiPost('/dispatch', {
        fecha,
        rutaId: Number(rutaId),
        vehiculoId: Number(vehiculoId),
        choferId: Number(choferId),
        pedidoIds: Array.from(selectedPedidoIds),
      });
      toast.success('Hoja de carga creada correctamente');
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear hoja de carga');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="@sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Hoja de Carga</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Header fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dispatch-fecha">Fecha *</Label>
              <Input
                id="dispatch-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dispatch-ruta">Ruta *</Label>
              <select
                id="dispatch-ruta"
                className={nativeSelectClass()}
                value={rutaId}
                onChange={(e) => {
                  setRutaId(e.target.value === '' ? '' : Number(e.target.value));
                  setSelectedPedidoIds(new Set());
                }}
                required
              >
                <option value="">Seleccionar ruta</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre} — {r.zona}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dispatch-vehiculo">Vehículo *</Label>
              <select
                id="dispatch-vehiculo"
                className={nativeSelectClass()}
                value={vehiculoId}
                onChange={(e) =>
                  setVehiculoId(e.target.value === '' ? '' : Number(e.target.value))
                }
                required
              >
                <option value="">Seleccionar vehículo</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.placa} — {v.marca}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dispatch-chofer">Chofer *</Label>
              <select
                id="dispatch-chofer"
                className={nativeSelectClass()}
                value={choferId}
                onChange={(e) =>
                  setChoferId(e.target.value === '' ? '' : Number(e.target.value))
                }
                required
              >
                <option value="">Seleccionar chofer</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre} {d.apellido}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pedidos selector */}
          {fecha && (
            <div className="space-y-2">
              <Label>Pedidos confirmados</Label>
              {loadingOrders ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  Cargando pedidos…
                </div>
              ) : filteredGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No hay pedidos confirmados para la fecha y ruta seleccionadas.
                </p>
              ) : (
                <div className="space-y-3 rounded-md border p-3">
                  {filteredGroups.map((group) => {
                    const allSelected = group.pedidos.every((p) =>
                      selectedPedidoIds.has(p.id)
                    );
                    return (
                      <div key={group.ruta.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`group-${group.ruta.id}`}
                            checked={allSelected}
                            onChange={() => toggleGroup(group)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <label
                            htmlFor={`group-${group.ruta.id}`}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {group.ruta.nombre} — {group.ruta.zona}{' '}
                            <span className="text-muted-foreground font-normal">
                              ({group.pedidos.length} pedidos · S/{' '}
                              {group.totalMonto.toFixed(2)})
                            </span>
                          </label>
                        </div>
                        <div className="ml-6 space-y-1">
                          {group.pedidos.map((pedido) => (
                            <div key={pedido.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`pedido-${pedido.id}`}
                                checked={selectedPedidoIds.has(pedido.id)}
                                onChange={() => togglePedido(pedido.id)}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                              <label
                                htmlFor={`pedido-${pedido.id}`}
                                className="text-sm cursor-pointer"
                              >
                                #{pedido.id} — {pedido.cliente.razonSocial}
                                <span className="text-muted-foreground ml-2">
                                  S/ {Number(pedido.total).toFixed(2)}
                                </span>
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {selectedPedidoIds.size > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedPedidoIds.size} pedido{selectedPedidoIds.size !== 1 ? 's' : ''} seleccionado{selectedPedidoIds.size !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
              Crear Hoja de Carga
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

interface ConfirmDispatchDialogProps {
  sheet: LoadSheetFull | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function ConfirmDispatchDialog({ sheet, open, onClose, onSuccess }: ConfirmDispatchDialogProps) {
  const [numeroGre, setNumeroGre] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setNumeroGre('');
  }, [open]);

  const handleConfirm = async () => {
    if (!sheet) return;
    setSaving(true);
    try {
      await apiPost(`/dispatch/${sheet.id}/confirm`, {
        numeroGre: numeroGre.trim() || undefined,
      });
      toast.success('Despacho confirmado');
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al confirmar despacho');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="@sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirmar Despacho</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Confirmás el despacho de la hoja de carga #{sheet?.id}. Podés ingresar el número de GRE (opcional).
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="gre-number">Número GRE</Label>
            <Input
              id="gre-number"
              placeholder="Opcional"
              value={numeroGre}
              onChange={(e) => setNumeroGre(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
            Confirmar Despacho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delivery Form Dialog ─────────────────────────────────────────────────────

interface DeliveryFormDialogProps {
  pedidoId: number | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function DeliveryFormDialog({ pedidoId, open, onClose, onSuccess }: DeliveryFormDialogProps) {
  const [estado, setEstado] = useState<'ENTREGADO' | 'NOVEDAD'>('ENTREGADO');
  const [montoCobrado, setMontoCobrado] = useState('');
  const [metodoPago, setMetodoPago] = useState('');
  const [numeroComprobante, setNumeroComprobante] = useState('');
  const [observacion, setObservacion] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEstado('ENTREGADO');
      setMontoCobrado('');
      setMetodoPago('');
      setNumeroComprobante('');
      setObservacion('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pedidoId) return;
    setSaving(true);
    try {
      await apiPost(`/dispatch/delivery/${pedidoId}`, {
        estado,
        montoCobrado: montoCobrado ? Number(montoCobrado) : undefined,
        metodoPago: metodoPago || undefined,
        numeroComprobante: numeroComprobante || undefined,
        observacion: observacion || undefined,
      });
      toast.success('Entrega registrada');
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar entrega');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="@sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Entrega — Pedido #{pedidoId}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="entrega-estado">Estado *</Label>
            <select
              id="entrega-estado"
              className={nativeSelectClass()}
              value={estado}
              onChange={(e) => setEstado(e.target.value as 'ENTREGADO' | 'NOVEDAD')}
              required
            >
              <option value="ENTREGADO">Entregado</option>
              <option value="NOVEDAD">Novedad</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entrega-monto">Monto Cobrado</Label>
            <Input
              id="entrega-monto"
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={montoCobrado}
              onChange={(e) => setMontoCobrado(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entrega-metodo">Método de Pago</Label>
            <select
              id="entrega-metodo"
              className={nativeSelectClass()}
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
            >
              <option value="">Sin especificar</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="YAPE">Yape</option>
              <option value="PLIN">Plin</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entrega-observacion">Observación</Label>
            <Input
              id="entrega-observacion"
              placeholder="Opcional"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Collection Form Dialog ───────────────────────────────────────────────────

interface CollectionFormDialogProps {
  pedidoId: number | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function CollectionFormDialog({ pedidoId, open, onClose, onSuccess }: CollectionFormDialogProps) {
  const [montoCobrado, setMontoCobrado] = useState('');
  const [metodoPago, setMetodoPago] = useState('');
  const [numeroComprobante, setNumeroComprobante] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setMontoCobrado('');
      setMetodoPago('');
      setNumeroComprobante('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pedidoId) return;
    if (!montoCobrado) {
      toast.error('Ingresá el monto cobrado');
      return;
    }
    setSaving(true);
    try {
      await apiPost(`/dispatch/collection/${pedidoId}`, {
        montoCobrado: Number(montoCobrado),
        metodoPago: metodoPago || undefined,
        numeroComprobante: numeroComprobante || undefined,
      });
      toast.success('Cobro registrado');
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar cobro');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="@sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Cobro — Pedido #{pedidoId}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cobro-monto">Monto Cobrado *</Label>
            <Input
              id="cobro-monto"
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={montoCobrado}
              onChange={(e) => setMontoCobrado(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cobro-metodo">Método de Pago</Label>
            <select
              id="cobro-metodo"
              className={nativeSelectClass()}
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
            >
              <option value="">Sin especificar</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="YAPE">Yape</option>
              <option value="PLIN">Plin</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cobro-comprobante">N° Comprobante</Label>
            <Input
              id="cobro-comprobante"
              placeholder="Opcional"
              value={numeroComprobante}
              onChange={(e) => setNumeroComprobante(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
              Registrar Cobro
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Detail Dialog ────────────────────────────────────────────────────────────

interface DetailDialogProps {
  sheetId: number | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function DetailDialog({ sheetId, open, onClose, onSuccess }: DetailDialogProps) {
  const [sheet, setSheet] = useState<LoadSheetFull | null>(null);
  const [deliveryEntries, setDeliveryEntries] = useState<DeliveryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [routeSaving, setRouteSaving] = useState(false);

  // Sub-dialogs
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deliveryPedidoId, setDeliveryPedidoId] = useState<number | null>(null);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [collectionPedidoId, setCollectionPedidoId] = useState<number | null>(null);
  const [collectionOpen, setCollectionOpen] = useState(false);

  const fetchDetail = useCallback(() => {
    if (!sheetId) return;
    setLoading(true);
    Promise.all([
      apiGet<LoadSheetFull>(`/dispatch/${sheetId}`),
      apiGet<DeliveryEntry[]>(`/dispatch/${sheetId}/delivery-status`),
    ])
      .then(([s, d]) => {
        setSheet(s);
        setDeliveryEntries(d);
      })
      .catch(() => toast.error('Error al cargar el despacho'))
      .finally(() => setLoading(false));
  }, [sheetId]);

  useEffect(() => {
    if (open && sheetId) fetchDetail();
  }, [open, sheetId, fetchDetail]);

  const handleStartRoute = async () => {
    if (!sheet) return;
    setRouteSaving(true);
    try {
      await apiPost(`/dispatch/${sheet.id}/start-route`, {});
      toast.success('Ruta iniciada');
      fetchDetail();
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al iniciar ruta');
    } finally {
      setRouteSaving(false);
    }
  };

  const openDelivery = (pedidoId: number) => {
    setDeliveryPedidoId(pedidoId);
    setDeliveryOpen(true);
  };

  const openCollection = (pedidoId: number) => {
    setCollectionPedidoId(pedidoId);
    setCollectionOpen(true);
  };

  const handleSubSuccess = () => {
    fetchDetail();
    onSuccess();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="@sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {sheet ? `Hoja de Carga #${sheet.id}` : 'Cargando…'}
            </DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && sheet && (
            <div className="space-y-6">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Estado</p>
                  <StateBadge estado={sheet.estado} map={stateLabels} colorMap={stateColors} />
                </div>
                <div>
                  <p className="text-muted-foreground">Fecha</p>
                  <p>{formatDate(sheet.fecha)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ruta</p>
                  <p>{sheet.ruta.nombre} — {sheet.ruta.zona}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vehículo</p>
                  <p>{sheet.vehiculo.placa} ({sheet.vehiculo.marca})</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Chofer</p>
                  <p>{sheet.chofer.nombre} {sheet.chofer.apellido}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-semibold">S/ {Number(sheet.totalMonto).toFixed(2)}</p>
                </div>
                {sheet.numeroGre && (
                  <div>
                    <p className="text-muted-foreground">N° GRE</p>
                    <p>{sheet.numeroGre}</p>
                  </div>
                )}
              </div>

              {/* Pedidos table — for PREPARANDO and DESPACHADO */}
              {(sheet.estado === 'PREPARANDO' || sheet.estado === 'DESPACHADO') && (
                <div>
                  <p className="text-sm font-medium mb-2">Pedidos incluidos</p>
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-2">ID</th>
                          <th className="text-left px-3 py-2">Cliente</th>
                          <th className="text-left px-3 py-2">Dirección</th>
                          <th className="text-right px-3 py-2">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {sheet.pedidos.map((p) => (
                          <tr key={p.id}>
                            <td className="px-3 py-2 text-muted-foreground">#{p.id}</td>
                            <td className="px-3 py-2">{p.cliente.razonSocial}</td>
                            <td className="px-3 py-2 text-muted-foreground">{p.cliente.direccion}</td>
                            <td className="px-3 py-2 text-right">S/ {Number(p.total).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Delivery status table — for EN_RUTA and COMPLETADO */}
              {(sheet.estado === 'EN_RUTA' || sheet.estado === 'COMPLETADO') && (
                <div>
                  <p className="text-sm font-medium mb-2">Estado de entregas</p>
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-2">Pedido</th>
                          <th className="text-left px-3 py-2">Cliente</th>
                          <th className="text-right px-3 py-2">Total</th>
                          <th className="text-left px-3 py-2">Estado</th>
                          <th className="text-right px-3 py-2">Cobrado</th>
                          {sheet.estado === 'EN_RUTA' && (
                            <th className="text-center px-3 py-2">Acciones</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {deliveryEntries.map((entry) => (
                          <tr key={entry.pedidoId}>
                            <td className="px-3 py-2 text-muted-foreground">
                              #{entry.pedidoId}
                            </td>
                            <td className="px-3 py-2">{entry.cliente.razonSocial}</td>
                            <td className="px-3 py-2 text-right">
                              S/ {Number(entry.totalPedido).toFixed(2)}
                            </td>
                            <td className="px-3 py-2">
                              {entry.entrega ? (
                                <StateBadge
                                  estado={entry.entrega.estado}
                                  map={deliveryStateLabels}
                                  colorMap={deliveryStateColors}
                                />
                              ) : (
                                <StateBadge
                                  estado="PENDIENTE"
                                  map={deliveryStateLabels}
                                  colorMap={deliveryStateColors}
                                />
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {entry.entrega?.montoCobrado != null
                                ? `S/ ${Number(entry.entrega.montoCobrado).toFixed(2)}`
                                : '—'}
                            </td>
                            {sheet.estado === 'EN_RUTA' && (
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {(!entry.entrega || entry.entrega.estado === 'PENDIENTE') && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openDelivery(entry.pedidoId)}
                                    >
                                      Registrar Entrega
                                    </Button>
                                  )}
                                  {entry.entrega?.estado === 'ENTREGADO' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openCollection(entry.pedidoId)}
                                    >
                                      Registrar Cobro
                                    </Button>
                                  )}
                                  {entry.entrega?.observacion && (
                                    <span
                                      className="text-xs text-muted-foreground truncate max-w-[120px]"
                                      title={entry.entrega.observacion}
                                    >
                                      {entry.entrega.observacion}
                                    </span>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <DialogFooter className="gap-2">
                {sheet.estado === 'PREPARANDO' && (
                  <Button onClick={() => setConfirmOpen(true)}>
                    <TruckIcon className="h-4 w-4 mr-2" />
                    Confirmar Despacho
                  </Button>
                )}
                {sheet.estado === 'DESPACHADO' && (
                  <Button onClick={handleStartRoute} disabled={routeSaving}>
                    {routeSaving ? (
                      <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <TruckIcon className="h-4 w-4 mr-2" />
                    )}
                    Iniciar Ruta
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sub-dialogs */}
      <ConfirmDispatchDialog
        sheet={sheet}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onSuccess={() => { fetchDetail(); onSuccess(); }}
      />
      <DeliveryFormDialog
        pedidoId={deliveryPedidoId}
        open={deliveryOpen}
        onClose={() => setDeliveryOpen(false)}
        onSuccess={handleSubSuccess}
      />
      <CollectionFormDialog
        pedidoId={collectionPedidoId}
        open={collectionOpen}
        onClose={() => setCollectionOpen(false)}
        onSuccess={handleSubSuccess}
      />
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DespachoPage() {
  const [sheets, setSheets] = useState<LoadSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [fechaFilter, setFechaFilter] = useState('');

  // Catalogs
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [detailSheetId, setDetailSheetId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchSheets = useCallback(
    (targetPage: number) => {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      });
      if (fechaFilter) params.set('fecha', fechaFilter);
      apiGet<{ data: LoadSheet[]; total: number; page: number; pageSize: number }>(
        `/dispatch?${params.toString()}`
      )
        .then((res) => {
          setSheets(res.data);
          setTotal(res.total);
        })
        .catch(() => toast.error('Error al cargar hojas de carga'))
        .finally(() => setLoading(false));
    },
    [fechaFilter]
  );

  useEffect(() => {
    setPage(1); // eslint-disable-line react-hooks/set-state-in-effect
    fetchSheets(1);
  }, [fechaFilter, fetchSheets]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSheets(page);
  }, [page, fetchSheets]);

  useEffect(() => {
    Promise.all([
      apiGet<Route[]>('/catalogs/routes'),
      apiGet<Vehicle[]>('/catalogs/vehicles'),
      apiGet<Driver[]>('/catalogs/drivers'),
    ])
      .then(([r, v, d]) => {
        setRoutes(r);
        setVehicles(v);
        setDrivers(d);
      })
      .catch(() => toast.error('Error al cargar catálogos'));
  }, []);

  // ── Open detail ───────────────────────────────────────────────────────────

  const openDetail = (sheet: LoadSheet) => {
    setDetailSheetId(sheet.id);
    setDetailOpen(true);
  };

  // ── Table columns ─────────────────────────────────────────────────────────

  const columns: Column<LoadSheet>[] = [
    { key: 'id', label: 'ID', className: 'w-14' },
    {
      key: 'fecha',
      label: 'Fecha',
      className: 'w-28',
      render: (row) => formatDate(row.fecha),
    },
    {
      key: 'ruta',
      label: 'Ruta',
      render: (row) => `${row.ruta.nombre} — ${row.ruta.zona}`,
    },
    {
      key: 'vehiculo',
      label: 'Vehículo',
      className: 'w-36',
      render: (row) => `${row.vehiculo.placa} (${row.vehiculo.marca})`,
    },
    {
      key: 'chofer',
      label: 'Chofer',
      className: 'w-40',
      render: (row) => `${row.chofer.nombre} ${row.chofer.apellido}`,
    },
    {
      key: 'estado',
      label: 'Estado',
      className: 'w-32',
      render: (row) => (
        <StateBadge estado={row.estado} map={stateLabels} colorMap={stateColors} />
      ),
    },
    {
      key: 'pedidos',
      label: 'Pedidos',
      className: 'w-20 text-center',
      render: (row) => row._count?.pedidos ?? 0,
    },
    {
      key: 'totalMonto',
      label: 'Total (S/)',
      className: 'w-28 text-right',
      render: (row) => `S/ ${Number(row.totalMonto).toFixed(2)}`,
    },
    {
      key: 'acciones',
      label: 'Acciones',
      className: 'w-20',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); openDetail(row); }}
        >
          Ver
        </Button>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Despacho"
        description="Gestión de hojas de carga y entregas"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Nueva Hoja de Carga
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="filter-fecha">Filtrar por fecha</Label>
          <Input
            id="filter-fecha"
            type="date"
            value={fechaFilter}
            onChange={(e) => setFechaFilter(e.target.value)}
            className="w-40"
          />
        </div>
        {fechaFilter && (
          <Button variant="ghost" size="sm" onClick={() => setFechaFilter('')}>
            Limpiar
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={sheets}
        loading={loading}
        pagination={{ page, pageSize: PAGE_SIZE, total }}
        onPageChange={(p) => setPage(p)}
        onRowClick={openDetail}
        emptyMessage="No hay hojas de carga registradas"
      />

      {/* Dialogs */}
      <CreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => fetchSheets(page)}
        routes={routes}
        vehicles={vehicles}
        drivers={drivers}
      />
      <DetailDialog
        sheetId={detailSheetId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onSuccess={() => fetchSheets(page)}
      />
    </div>
  );
}
