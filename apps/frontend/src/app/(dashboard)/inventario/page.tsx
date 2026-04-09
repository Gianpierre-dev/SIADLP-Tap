'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { AlertTriangleIcon, Loader2Icon } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: number;
  tipo: string;
  nombre: string;
  unidadMedida: string;
  stockActual: string;
  stockMinimo: string;
  activo: boolean;
}

interface Movement {
  id: number;
  tipo: string;
  cantidad: string;
  stockResultante: string;
  referencia: string | null;
  fechaCreacion: string;
  usuario: { id: number; nombre: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const movementLabels: Record<string, string> = {
  COMPRA_ENTRADA: 'Compra',
  PRODUCCION_SALIDA: 'Prod. Salida',
  PRODUCCION_ENTRADA: 'Prod. Entrada',
  DESPACHO_SALIDA: 'Despacho',
  AJUSTE_POSITIVO: 'Ajuste (+)',
  AJUSTE_NEGATIVO: 'Ajuste (-)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isLowStock(item: InventoryItem): boolean {
  const min = Number(item.stockMinimo);
  return min > 0 && Number(item.stockActual) <= min;
}

function formatDateTime(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StockBadge({ item }: { item: InventoryItem }) {
  if (isLowStock(item)) {
    return <Badge className="bg-orange-100 text-orange-800 border-0">Alerta</Badge>;
  }
  return <Badge className="bg-green-100 text-green-800 border-0">OK</Badge>;
}

// ─── Kardex Dialog ────────────────────────────────────────────────────────────

interface KardexDialogProps {
  item: InventoryItem | null;
  open: boolean;
  onClose: () => void;
}

function KardexDialog({ item, open, onClose }: KardexDialogProps) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const fetchKardex = useCallback(() => {
    if (!item) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    const qs = params.toString();
    apiGet<Movement[]>(`/inventory/${item.id}/kardex${qs ? `?${qs}` : ''}`)
      .then(setMovements)
      .catch(() => toast.error('Error al cargar kardex'))
      .finally(() => setLoading(false));
  }, [item, desde, hasta]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && item) fetchKardex();
  }, [open, item, fetchKardex]);

  const columns: Column<Movement>[] = [
    {
      key: 'fechaCreacion',
      label: 'Fecha',
      className: 'w-36',
      render: (row) => formatDateTime(row.fechaCreacion),
    },
    {
      key: 'tipo',
      label: 'Tipo',
      className: 'w-36',
      render: (row) => movementLabels[row.tipo] ?? row.tipo,
    },
    {
      key: 'cantidad',
      label: 'Cantidad',
      className: 'w-24 text-right',
      render: (row) => row.cantidad,
    },
    {
      key: 'stockResultante',
      label: 'Stock Result.',
      className: 'w-28 text-right',
      render: (row) => row.stockResultante,
    },
    {
      key: 'referencia',
      label: 'Referencia',
      render: (row) => row.referencia ?? '—',
    },
    {
      key: 'usuario',
      label: 'Usuario',
      className: 'w-36',
      render: (row) => row.usuario.nombre,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Kardex — {item?.nombre ?? ''}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-end gap-3 mb-4">
          <div className="space-y-1.5">
            <Label htmlFor="kardex-desde">Desde</Label>
            <Input
              id="kardex-desde"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-36"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kardex-hasta">Hasta</Label>
            <Input
              id="kardex-hasta"
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="w-36"
            />
          </div>
          <Button variant="outline" onClick={fetchKardex} disabled={loading}>
            {loading && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
            Filtrar
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={movements}
          loading={loading}
          emptyMessage="Sin movimientos para el período seleccionado"
        />
      </DialogContent>
    </Dialog>
  );
}

// ─── Adjust Dialog ────────────────────────────────────────────────────────────

interface AdjustDialogProps {
  item: InventoryItem | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function AdjustDialog({ item, open, onClose, onSuccess }: AdjustDialogProps) {
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCantidad('');
      setMotivo('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    if (!cantidad || isNaN(Number(cantidad))) {
      toast.error('Ingresá una cantidad válida');
      return;
    }
    if (motivo.trim().length < 5) {
      toast.error('El motivo debe tener al menos 5 caracteres');
      return;
    }
    setSaving(true);
    try {
      await apiPost(`/inventory/${item.id}/adjust`, {
        cantidad: Number(cantidad),
        motivo: motivo.trim(),
      });
      toast.success('Ajuste registrado correctamente');
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar ajuste');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar Stock — {item?.nombre ?? ''}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="adjust-cantidad">
              Cantidad <span className="text-muted-foreground text-xs">(negativo = reducción)</span>
            </Label>
            <Input
              id="adjust-cantidad"
              type="number"
              placeholder="Ej: 10 o -5"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adjust-motivo">Motivo *</Label>
            <Input
              id="adjust-motivo"
              placeholder="Mínimo 5 caracteres"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              required
              minLength={5}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
              Registrar Ajuste
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Min Stock Dialog ─────────────────────────────────────────────────────────

interface MinStockDialogProps {
  item: InventoryItem | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function MinStockDialog({ item, open, onClose, onSuccess }: MinStockDialogProps) {
  const [stockMinimo, setStockMinimo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && item) {
      setStockMinimo(item.stockMinimo);
    }
  }, [open, item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    const val = Number(stockMinimo);
    if (isNaN(val) || val < 0) {
      toast.error('El stock mínimo debe ser un número mayor o igual a 0');
      return;
    }
    setSaving(true);
    try {
      await apiPatch(`/inventory/${item.id}/min-stock`, { stockMinimo: val });
      toast.success('Stock mínimo actualizado');
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar stock mínimo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Stock Mínimo — {item?.nombre ?? ''}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="min-stock">Stock Mínimo *</Label>
            <Input
              id="min-stock"
              type="number"
              min={0}
              placeholder="0"
              value={stockMinimo}
              onChange={(e) => setStockMinimo(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type TabType = 'mp' | 'pt';

export default function InventarioPage() {
  const [tab, setTab] = useState<TabType>('mp');
  const [mpItems, setMpItems] = useState<InventoryItem[]>([]);
  const [ptItems, setPtItems] = useState<InventoryItem[]>([]);
  const [alerts, setAlerts] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Kardex dialog
  const [kardexItem, setKardexItem] = useState<InventoryItem | null>(null);
  const [kardexOpen, setKardexOpen] = useState(false);

  // Adjust dialog
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);

  // Min stock dialog
  const [minStockItem, setMinStockItem] = useState<InventoryItem | null>(null);
  const [minStockOpen, setMinStockOpen] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiGet<InventoryItem[]>('/inventory/mp'),
      apiGet<InventoryItem[]>('/inventory/pt'),
      apiGet<InventoryItem[]>('/inventory/alerts'),
    ])
      .then(([mp, pt, al]) => {
        setMpItems(mp);
        setPtItems(pt);
        setAlerts(al);
      })
      .catch(() => toast.error('Error al cargar inventario'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
  }, [fetchAll]);

  // ── Dialog openers ────────────────────────────────────────────────────────

  const openKardex = (item: InventoryItem) => {
    setKardexItem(item);
    setKardexOpen(true);
  };

  const openAdjust = (item: InventoryItem) => {
    setAdjustItem(item);
    setAdjustOpen(true);
  };

  const openMinStock = (item: InventoryItem) => {
    setMinStockItem(item);
    setMinStockOpen(true);
  };

  // ── Table columns ─────────────────────────────────────────────────────────

  const buildColumns = (): Column<InventoryItem>[] => [
    { key: 'id', label: 'ID', className: 'w-14' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'unidadMedida', label: 'Unidad', className: 'w-24' },
    {
      key: 'stockActual',
      label: 'Stock Actual',
      className: 'w-28 text-right',
      render: (row) => (
        <span className={isLowStock(row) ? 'font-semibold text-orange-600' : undefined}>
          {row.stockActual}
        </span>
      ),
    },
    {
      key: 'stockMinimo',
      label: 'Stock Mín.',
      className: 'w-24 text-right',
      render: (row) => row.stockMinimo,
    },
    {
      key: 'estado',
      label: 'Estado',
      className: 'w-24',
      render: (row) => <StockBadge item={row} />,
    },
    {
      key: 'acciones',
      label: 'Acciones',
      className: 'w-52',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); openKardex(row); }}
          >
            Kardex
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); openAdjust(row); }}
          >
            Ajustar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); openMinStock(row); }}
          >
            Stock Mín.
          </Button>
        </div>
      ),
    },
  ];

  const currentItems = tab === 'mp' ? mpItems : ptItems;
  const columns = buildColumns();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventario"
        description="Control de stock de materias primas y productos terminados"
      />

      {/* Alerts banner */}
      {alerts.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <AlertTriangleIcon className="h-5 w-5 shrink-0" />
          <span>
            <strong>{alerts.length}</strong>{' '}
            {alerts.length === 1
              ? 'ítem tiene stock por debajo del mínimo'
              : 'ítems tienen stock por debajo del mínimo'}
            :{' '}
            {alerts
              .slice(0, 5)
              .map((a) => a.nombre)
              .join(', ')}
            {alerts.length > 5 ? ` y ${alerts.length - 5} más.` : '.'}
          </span>
        </div>
      )}

      {/* Tab toggle */}
      <div className="flex gap-2">
        <Button
          variant={tab === 'mp' ? 'default' : 'outline'}
          onClick={() => setTab('mp')}
        >
          Materia Prima
        </Button>
        <Button
          variant={tab === 'pt' ? 'default' : 'outline'}
          onClick={() => setTab('pt')}
        >
          Producto Terminado
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={currentItems}
        loading={loading}
        emptyMessage="Sin ítems registrados"
      />

      {/* Dialogs */}
      <KardexDialog
        item={kardexItem}
        open={kardexOpen}
        onClose={() => setKardexOpen(false)}
      />
      <AdjustDialog
        item={adjustItem}
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        onSuccess={fetchAll}
      />
      <MinStockDialog
        item={minStockItem}
        open={minStockOpen}
        onClose={() => setMinStockOpen(false)}
        onSuccess={fetchAll}
      />
    </div>
  );
}
