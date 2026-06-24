'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { useEmpresaStore } from '@/lib/empresa';
import { PageHeader } from '@/components/page-header';
import { DataTable, Column } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/searchable-select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2Icon, PlusIcon, TruckIcon, PrinterIcon } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoadSheet {
  id: number;
  fecha: string;
  estado: string;
  totalKg: string;
  ruta: { id: number; nombre: string; zona: string };
  vehiculo: { id: number; placa: string; marca: string };
  chofer: { id: number; nombre: string; apellido: string };
  _count: { pedidos: number };
}

interface RouteGroup {
  ruta: { id: number; nombre: string; zona: string };
  pedidos: Array<{
    id: number;
    cliente: { id: number; razonSocial: string; direccion: string; telefono: string | null };
  }>;
  totalKg: number;
}

interface DeliveryEntry {
  pedidoId: number;
  cliente: { razonSocial: string };
  entrega: {
    id: number;
    estado: string;
    observacion: string | null;
    fechaEntrega: string | null;
  } | null;
}

interface LoadSheetFull extends LoadSheet {
  pedidos: Array<{
    id: number;
    cliente: { razonSocial: string; direccion: string };
    entrega: {
      id: number;
      estado: string;
      observacion: string | null;
      fechaEntrega: string | null;
    } | null;
  }>;
}

// Hoja de ruta imprimible que devuelve GET /dispatch/:id/route-sheet
interface RouteSheet {
  hoja: { id: number; fecha: string; estado: string };
  ruta: { nombre: string; zona: string };
  vehiculo: { placa: string; marca: string | null; modelo: string | null };
  chofer: {
    nombre: string;
    apellido: string;
    dni: string;
    licencia: string | null;
    telefono: string | null;
  };
  paradas: Array<{
    orden: number;
    cliente: { razonSocial: string; direccion: string; telefono: string | null };
    pedido: { id: number };
    productos: Array<{ nombre: string; cantidad: number }>;
  }>;
  totalKg: number;
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
  PREPARANDO: 'bg-[#fff3c4] text-[#8a6914]',
  DESPACHADO: 'bg-[#e3f2fd] text-[#1565c0]',
  EN_RUTA:    'bg-[#fef3c7] text-[#d97706]',
  COMPLETADO: 'bg-[#e8f5e9] text-[#33691e]',
};

const stateLabels: Record<string, string> = {
  PREPARANDO: 'Preparando',
  DESPACHADO: 'Despachado',
  EN_RUTA: 'En Ruta',
  COMPLETADO: 'Completado',
};

const deliveryStateColors: Record<string, string> = {
  PENDIENTE: 'bg-[#f5f5f5] text-[#525252]',
  ENTREGADO: 'bg-[#e8f5e9] text-[#33691e]',
  NOVEDAD:   'bg-[#fef3c7] text-[#d97706]',
};

const deliveryStateLabels: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  ENTREGADO: 'Entregado',
  NOVEDAD: 'Novedad',
};

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
    if (fecha < new Date().toLocaleDateString('en-CA')) {
      toast.error(
        'No se puede programar una hoja de carga para una fecha anterior a hoy',
      );
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
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
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
                min={new Date().toLocaleDateString('en-CA')}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dispatch-ruta">Ruta *</Label>
              <SearchableSelect
                options={routes.map((r) => ({
                  value: r.id,
                  label: `${r.nombre} — ${r.zona}`,
                }))}
                value={rutaId}
                onChange={(v) => {
                  setRutaId(v);
                  setSelectedPedidoIds(new Set());
                }}
                placeholder="Seleccionar ruta"
                searchPlaceholder="Buscar ruta..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dispatch-vehiculo">Vehículo *</Label>
              <SearchableSelect
                options={vehicles.map((v) => ({
                  value: v.id,
                  label: `${v.placa} — ${v.marca}`,
                }))}
                value={vehiculoId}
                onChange={setVehiculoId}
                placeholder="Seleccionar vehículo"
                searchPlaceholder="Buscar por placa..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dispatch-chofer">Chofer *</Label>
              <SearchableSelect
                options={drivers.map((d) => ({
                  value: d.id,
                  label: `${d.nombre} ${d.apellido}`,
                }))}
                value={choferId}
                onChange={setChoferId}
                placeholder="Seleccionar chofer"
                searchPlaceholder="Buscar chofer..."
              />
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
                              ({group.pedidos.length} pedidos)
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
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!sheet) return;
    setSaving(true);
    try {
      await apiPost(`/dispatch/${sheet.id}/confirm`, {});
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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirmar Despacho</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ¿Confirmar el despacho de la hoja de carga #{sheet?.id}?
          </p>
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
  const [observacion, setObservacion] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEstado('ENTREGADO');
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
      <DialogContent className="sm:max-w-md">
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

// ─── Route Sheet (printable) Dialog ───────────────────────────────────────────

interface RouteSheetDialogProps {
  sheetId: number | null;
  open: boolean;
  onClose: () => void;
}

// Genera el HTML de la hoja de ruta para imprimir en una ventana nueva.
function buildPrintHtml(
  rs: RouteSheet,
  brand: { logoUrl: string; nombre: string; ruc: string | null },
): string {
  const choferNombre = `${rs.chofer.nombre} ${rs.chofer.apellido}`;
  const vehiculo = `${rs.vehiculo.placa}${rs.vehiculo.marca ? ` — ${rs.vehiculo.marca}` : ''}${rs.vehiculo.modelo ? ` ${rs.vehiculo.modelo}` : ''}`;
  const paradas = rs.paradas
    .map((p) => {
      const productos = p.productos
        .map((pr) => `${pr.nombre} (${pr.cantidad})`)
        .join(', ');
      return `<tr>
        <td>${p.orden}</td>
        <td>${p.cliente.razonSocial}</td>
        <td>${p.cliente.direccion}</td>
        <td>${p.cliente.telefono ?? '—'}</td>
        <td>#${p.pedido.id}</td>
        <td>${productos}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Hoja de Ruta #${rs.hoja.id}</title>
  <style>
    * { font-family: Arial, Helvetica, sans-serif; }
    body { margin: 24px; color: #1a1a1a; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { font-size: 13px; margin-bottom: 16px; }
    .meta div { margin: 2px 0; }
    .meta b { display: inline-block; min-width: 90px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f0f0f0; }
    .total { margin-top: 12px; font-size: 13px; font-weight: bold; }
    .brand { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #1a3a0e; padding-bottom: 12px; margin-bottom: 16px; }
    .brand img { height: 56px; width: auto; }
    .brand-name { font-size: 18px; font-weight: bold; }
    .brand-ruc { font-size: 12px; color: #555; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body onload="window.print()">
  <div class="brand">
    <img src="${brand.logoUrl}" alt="" />
    <div>
      <div class="brand-name">${brand.nombre}</div>
      ${brand.ruc ? `<div class="brand-ruc">RUC: ${brand.ruc}</div>` : ''}
    </div>
  </div>
  <h1>Hoja de Ruta #${rs.hoja.id}</h1>
  <div class="meta">
    <div><b>Fecha:</b> ${rs.hoja.fecha.slice(0, 10)}</div>
    <div><b>Ruta:</b> ${rs.ruta.nombre} — ${rs.ruta.zona}</div>
    <div><b>Vehículo:</b> ${vehiculo}</div>
    <div><b>Chofer:</b> ${choferNombre} (DNI ${rs.chofer.dni}${rs.chofer.licencia ? `, Lic. ${rs.chofer.licencia}` : ''})</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Cliente</th>
        <th>Dirección</th>
        <th>Teléfono</th>
        <th>Pedido</th>
        <th>Productos</th>
      </tr>
    </thead>
    <tbody>${paradas}</tbody>
  </table>
  <div class="total">Total: ${rs.totalKg} kg — ${rs.paradas.length} parada(s)</div>
</body>
</html>`;
}

function RouteSheetDialog({ sheetId, open, onClose }: RouteSheetDialogProps) {
  const [routeSheet, setRouteSheet] = useState<RouteSheet | null>(null);
  const [loading, setLoading] = useState(false);
  const { empresa } = useEmpresaStore();

  useEffect(() => {
    if (!open || !sheetId) return;
    setLoading(true);
    setRouteSheet(null);
    apiGet<RouteSheet>(`/dispatch/${sheetId}/route-sheet`)
      .then(setRouteSheet)
      .catch(() => toast.error('Error al cargar la hoja de ruta'))
      .finally(() => setLoading(false));
  }, [open, sheetId]);

  // Abre una ventana con la vista imprimible y dispara window.print().
  const handlePrint = () => {
    if (!routeSheet) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      toast.error('No se pudo abrir la ventana de impresión');
      return;
    }
    // Logo en URL absoluta: el custom (backend /uploads) o el default del
    // frontend. La ventana nueva no resuelve rutas relativas.
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4020/api';
    const baseUrl = apiUrl.replace(/\/api$/, '');
    const logoUrl = empresa?.logoUrl
      ? `${baseUrl}${empresa.logoUrl}`
      : `${window.location.origin}/LogoLaCosecha.png`;
    const brand = {
      logoUrl,
      nombre:
        empresa?.nombreComercial ?? empresa?.razonSocial ?? 'La Cosecha S.A.C.',
      ruc: empresa?.ruc ?? null,
    };
    win.document.write(buildPrintHtml(routeSheet, brand));
    win.document.close();
    win.focus();
    // window.print() lo dispara el onload del <body>, para esperar a que cargue el logo.
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {routeSheet ? `Hoja de Ruta #${routeSheet.hoja.id}` : 'Hoja de Ruta'}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && routeSheet && (
          <div className="space-y-5">
            {/* Cabecera */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Fecha</p>
                <p>{formatDate(routeSheet.hoja.fecha)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Ruta</p>
                <p>{routeSheet.ruta.nombre} — {routeSheet.ruta.zona}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Vehículo</p>
                <p>
                  {routeSheet.vehiculo.placa}
                  {routeSheet.vehiculo.marca ? ` — ${routeSheet.vehiculo.marca}` : ''}
                  {routeSheet.vehiculo.modelo ? ` ${routeSheet.vehiculo.modelo}` : ''}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Chofer</p>
                <p>
                  {routeSheet.chofer.nombre} {routeSheet.chofer.apellido}{' '}
                  <span className="text-muted-foreground">(DNI {routeSheet.chofer.dni})</span>
                </p>
              </div>
            </div>

            {/* Paradas */}
            <div>
              <p className="text-sm font-medium mb-2">
                Paradas ({routeSheet.paradas.length})
              </p>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 w-10">#</th>
                      <th className="text-left px-3 py-2">Cliente</th>
                      <th className="text-left px-3 py-2">Dirección</th>
                      <th className="text-left px-3 py-2">Productos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {routeSheet.paradas.map((p) => (
                      <tr key={p.pedido.id}>
                        <td className="px-3 py-2 text-muted-foreground">{p.orden}</td>
                        <td className="px-3 py-2">{p.cliente.razonSocial}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {p.cliente.direccion}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {p.productos
                            .map((pr) => `${pr.nombre} (${pr.cantidad})`)
                            .join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm font-medium mt-2">Total: {routeSheet.totalKg} kg</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={handlePrint} disabled={!routeSheet}>
            <PrinterIcon className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </DialogFooter>
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
  const [routeSheetOpen, setRouteSheetOpen] = useState(false);
  const { hasPermission } = useAuthStore();

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

  const handleSubSuccess = () => {
    fetchDetail();
    onSuccess();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
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
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {sheet.pedidos.map((p) => (
                          <tr key={p.id}>
                            <td className="px-3 py-2 text-muted-foreground">#{p.id}</td>
                            <td className="px-3 py-2">{p.cliente.razonSocial}</td>
                            <td className="px-3 py-2 text-muted-foreground">{p.cliente.direccion}</td>
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
                          <th className="text-left px-3 py-2">Estado</th>
                          <th className="text-left px-3 py-2">Observación</th>
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
                              {entry.entrega?.fechaEntrega && (
                                <span className="block text-xs text-muted-foreground mt-1">
                                  {formatDateTime(entry.entrega.fechaEntrega)}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {entry.entrega?.observacion || '—'}
                            </td>
                            {sheet.estado === 'EN_RUTA' && (
                              <td className="px-3 py-2 text-center">
                                {(!entry.entrega ||
                                  entry.entrega.estado === 'PENDIENTE') &&
                                  hasPermission('despacho.registrar_entrega') && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => openDelivery(entry.pedidoId)}
                                  >
                                    <TruckIcon className="h-4 w-4 mr-1" />
                                    Registrar Entrega
                                  </Button>
                                )}
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
                {hasPermission('despacho.leer') && (
                  <Button variant="outline" onClick={() => setRouteSheetOpen(true)}>
                    <PrinterIcon className="h-4 w-4 mr-2" />
                    Imprimir hoja de ruta
                  </Button>
                )}
                {sheet.estado === 'PREPARANDO' &&
                  hasPermission('despacho.editar') && (
                  <Button onClick={() => setConfirmOpen(true)}>
                    <TruckIcon className="h-4 w-4 mr-2" />
                    Confirmar Despacho
                  </Button>
                )}
                {sheet.estado === 'DESPACHADO' &&
                  hasPermission('despacho.editar') && (
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
      <RouteSheetDialog
        sheetId={sheetId}
        open={routeSheetOpen}
        onClose={() => setRouteSheetOpen(false)}
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
  const [estadoFilter, setEstadoFilter] = useState('');

  // Catalogs
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const { hasPermission } = useAuthStore();
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
      if (estadoFilter) params.set('estado', estadoFilter);
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
    [fechaFilter, estadoFilter]
  );

  useEffect(() => {
    setPage(1); // eslint-disable-line react-hooks/set-state-in-effect
    fetchSheets(1);
  }, [fechaFilter, estadoFilter, fetchSheets]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSheets(page);
  }, [page, fetchSheets]);

  useEffect(() => {
    // Estos catálogos solo los necesita quien arma hojas de carga (Jefe de
    // Despacho). El Chofer solo registra entregas y no tiene permiso sobre
    // ellos, así que evitamos las llamadas que le devolverían 403.
    if (!hasPermission('rutas.leer')) return;
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
  }, [hasPermission]);

  // ── Open detail ───────────────────────────────────────────────────────────

  const openDetail = (sheet: LoadSheet) => {
    setDetailSheetId(sheet.id);
    setDetailOpen(true);
  };

  // ── Table columns ─────────────────────────────────────────────────────────

  const columns: Column<LoadSheet>[] = [
    { key: 'id', label: 'ID', className: 'w-12' },
    {
      key: 'fecha',
      label: 'Fecha',
      className: 'w-24',
      render: (row) => <span className="text-xs">{formatDate(row.fecha)}</span>,
    },
    {
      key: 'ruta',
      label: 'Ruta',
      className: 'max-w-[12rem]',
      render: (row) => {
        const txt = `${row.ruta.nombre} — ${row.ruta.zona}`;
        return (
          <span className="block truncate text-sm" title={txt}>
            {txt}
          </span>
        );
      },
    },
    {
      key: 'vehiculo',
      label: 'Vehículo',
      className: 'w-28',
      render: (row) => (
        <span className="block truncate text-xs" title={`${row.vehiculo.placa} (${row.vehiculo.marca})`}>
          {row.vehiculo.placa}
        </span>
      ),
    },
    {
      key: 'chofer',
      label: 'Chofer',
      className: 'max-w-[7rem]',
      render: (row) => {
        const txt = `${row.chofer.nombre} ${row.chofer.apellido}`;
        return (
          <span className="block truncate text-sm" title={txt}>
            {txt}
          </span>
        );
      },
    },
    {
      key: 'estado',
      label: 'Estado',
      className: 'w-24',
      render: (row) => (
        <StateBadge estado={row.estado} map={stateLabels} colorMap={stateColors} />
      ),
    },
    {
      key: 'pedidos',
      label: 'Pedidos',
      className: 'w-16 text-center',
      render: (row) => row._count?.pedidos ?? 0,
    },
    {
      key: 'acciones',
      label: 'Acciones',
      className: 'w-16',
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
          hasPermission('despacho.crear') ? (
            <Button onClick={() => setCreateOpen(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Nueva Hoja de Carga
            </Button>
          ) : undefined
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
        <div className="space-y-1.5">
          <Label htmlFor="filter-estado">Filtrar por estado</Label>
          <select
            id="filter-estado"
            className="flex h-9 w-44 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="PREPARANDO">Preparando</option>
            <option value="DESPACHADO">Despachado</option>
            <option value="EN_RUTA">En Ruta</option>
            <option value="COMPLETADO">Completado</option>
          </select>
        </div>
        {(fechaFilter || estadoFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFechaFilter('');
              setEstadoFilter('');
            }}
          >
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
