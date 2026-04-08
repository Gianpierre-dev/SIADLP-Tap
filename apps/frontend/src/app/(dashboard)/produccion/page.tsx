'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { DataTable, Column } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  PlusIcon,
  Trash2Icon,
  Loader2Icon,
  PackageIcon,
  FlaskConicalIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProductionOrder {
  id: number;
  fecha: string;
  estado: string;
  observacion: string | null;
  fechaCreacion: string;
  creadoPor: { nombre: string };
  insumos: Array<{
    id: number;
    cantidad: string;
    costoUnitario: string;
    costoTotal: string;
    itemInventario: { id: number; nombre: string };
  }>;
  productos: Array<{
    id: number;
    cantidad: string;
    producto: { id: number; nombre: string };
  }>;
}

interface ProductionFull extends ProductionOrder {
  metrics?: {
    totalMpKg: number;
    totalPtKg: number;
    rendimiento: number;
    mermaKg: number;
    mermaPct: number;
    costoTotalMp: number;
    costoRealPorKg: number;
  };
}

interface MpItem {
  id: number;
  nombre: string;
  unidadMedida: string;
  stockActual: string;
}

interface Product {
  id: number;
  nombre: string;
  codigoSku: string;
  activo: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const stateColors: Record<string, string> = {
  PENDIENTE: 'bg-yellow-100 text-yellow-800',
  EN_PROCESO: 'bg-blue-100 text-blue-800',
  COMPLETADA: 'bg-green-100 text-green-800',
  CANCELADA: 'bg-red-100 text-red-800',
};

const stateLabels: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En Proceso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
};

const todayIso = () => new Date().toISOString().split('T')[0];

// ---------------------------------------------------------------------------
// Line-item types for forms
// ---------------------------------------------------------------------------

interface InsumoLine {
  itemInventarioId: number;
  cantidad: number;
  costoUnitario: number;
}

interface ProductoLine {
  productoId: number;
  cantidad: number;
}

const EMPTY_INSUMO: InsumoLine = { itemInventarioId: 0, cantidad: 0, costoUnitario: 0 };
const EMPTY_PRODUCTO: ProductoLine = { productoId: 0, cantidad: 0 };

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProduccionPage() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Catalog data
  const [mpItems, setMpItems] = useState<MpItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createFecha, setCreateFecha] = useState(todayIso());
  const [createObservacion, setCreateObservacion] = useState('');
  const [insumoLines, setInsumoLines] = useState<InsumoLine[]>([{ ...EMPTY_INSUMO }]);

  // Detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOrder, setDetailOrder] = useState<ProductionFull | null>(null);
  const [completeMode, setCompleteMode] = useState(false);
  const [completeSaving, setCompleteSaving] = useState(false);
  const [productoLines, setProductoLines] = useState<ProductoLine[]>([{ ...EMPTY_PRODUCTO }]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchOrders = () => {
    setLoading(true);
    apiGet<ProductionOrder[]>('/production')
      .then(setOrders)
      .catch(() => toast.error('Error al cargar las órdenes de producción'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
    apiGet<MpItem[]>('/inventory/mp')
      .then(setMpItems)
      .catch(() => toast.error('Error al cargar insumos de inventario'));
    apiGet<Product[]>('/catalogs/products')
      .then((data) => setProducts(data.filter((p) => p.activo)))
      .catch(() => toast.error('Error al cargar catálogo de productos'));
  }, []);

  // ---------------------------------------------------------------------------
  // Create dialog handlers
  // ---------------------------------------------------------------------------

  const openCreate = () => {
    setCreateFecha(todayIso());
    setCreateObservacion('');
    setInsumoLines([{ ...EMPTY_INSUMO }]);
    setCreateDialogOpen(true);
  };

  const addInsumoLine = () =>
    setInsumoLines((prev) => [...prev, { ...EMPTY_INSUMO }]);

  const removeInsumoLine = (idx: number) =>
    setInsumoLines((prev) => prev.filter((_, i) => i !== idx));

  const updateInsumoLine = (idx: number, patch: Partial<InsumoLine>) =>
    setInsumoLines((prev) =>
      prev.map((line, i) => (i === idx ? { ...line, ...patch } : line)),
    );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (insumoLines.some((l) => l.itemInventarioId === 0)) {
      toast.error('Seleccioná un insumo en cada línea');
      return;
    }
    setCreateSaving(true);
    try {
      await apiPost('/production', {
        fecha: createFecha,
        observacion: createObservacion || undefined,
        insumos: insumoLines,
      });
      toast.success('Orden de producción creada correctamente');
      setCreateDialogOpen(false);
      fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear la orden');
    } finally {
      setCreateSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Detail dialog handlers
  // ---------------------------------------------------------------------------

  const openDetail = (order: ProductionOrder) => {
    setDetailOrder(null);
    setCompleteMode(false);
    setProductoLines([{ ...EMPTY_PRODUCTO }]);
    setDetailDialogOpen(true);
    setDetailLoading(true);
    apiGet<ProductionFull>(`/production/${order.id}`)
      .then(setDetailOrder)
      .catch(() => toast.error('Error al cargar el detalle de la orden'))
      .finally(() => setDetailLoading(false));
  };

  const addProductoLine = () =>
    setProductoLines((prev) => [...prev, { ...EMPTY_PRODUCTO }]);

  const removeProductoLine = (idx: number) =>
    setProductoLines((prev) => prev.filter((_, i) => i !== idx));

  const updateProductoLine = (idx: number, patch: Partial<ProductoLine>) =>
    setProductoLines((prev) =>
      prev.map((line, i) => (i === idx ? { ...line, ...patch } : line)),
    );

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailOrder) return;
    if (productoLines.some((l) => l.productoId === 0)) {
      toast.error('Seleccioná un producto en cada línea');
      return;
    }
    setCompleteSaving(true);
    try {
      await apiPost(`/production/${detailOrder.id}/complete`, {
        productos: productoLines,
      });
      toast.success('Producción completada correctamente');
      setDetailDialogOpen(false);
      fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al completar la producción');
    } finally {
      setCompleteSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------------------

  const columns: Column<ProductionOrder>[] = [
    { key: 'id', label: 'ID', className: 'w-16' },
    {
      key: 'fecha',
      label: 'Fecha',
      className: 'w-32',
      render: (row) => new Date(row.fecha + 'T00:00:00').toLocaleDateString('es-PE'),
    },
    {
      key: 'estado',
      label: 'Estado',
      className: 'w-36',
      render: (row) => (
        <Badge className={stateColors[row.estado] ?? ''}>
          {stateLabels[row.estado] ?? row.estado}
        </Badge>
      ),
    },
    {
      key: 'insumos',
      label: 'Insumos',
      className: 'w-24 text-center',
      render: (row) => row._count?.insumos ?? 0,
    },
    {
      key: 'productos',
      label: 'Productos',
      className: 'w-24 text-center',
      render: (row) => row._count?.productos ?? 0,
    },
    {
      key: 'creadoPor',
      label: 'Creado por',
      render: (row) => row.creadoPor?.nombre ?? '—',
    },
    {
      key: 'acciones',
      label: 'Acciones',
      className: 'w-28',
      render: (row) => (
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openDetail(row); }}>
          Ver detalle
        </Button>
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Producción"
        description="Gestión de órdenes de producción"
        action={
          <Button onClick={openCreate}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Nueva Orden
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={orders}
        loading={loading}
        onRowClick={openDetail}
        emptyMessage="No hay órdenes de producción registradas"
      />

      {/* ------------------------------------------------------------------ */}
      {/* CREATE DIALOG                                                        */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Orden de Producción</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-5">
            {/* Header fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="create-fecha">Fecha *</Label>
                <Input
                  id="create-fecha"
                  type="date"
                  value={createFecha}
                  onChange={(e) => setCreateFecha(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-observacion">Observación</Label>
                <Input
                  id="create-observacion"
                  value={createObservacion}
                  onChange={(e) => setCreateObservacion(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>

            {/* Insumos section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <FlaskConicalIcon className="h-4 w-4 text-muted-foreground" />
                  Insumos (MP)
                </p>
                <Button type="button" variant="outline" size="sm" onClick={addInsumoLine}>
                  <PlusIcon className="h-3.5 w-3.5 mr-1" />
                  Agregar insumo
                </Button>
              </div>

              <div className="rounded-md border divide-y">
                {insumoLines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_120px_120px_36px] gap-2 p-3 items-end">
                    <div className="space-y-1">
                      {idx === 0 && <p className="text-xs text-muted-foreground">Insumo *</p>}
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        value={line.itemInventarioId}
                        onChange={(e) =>
                          updateInsumoLine(idx, { itemInventarioId: Number(e.target.value) })
                        }
                        required
                      >
                        <option value={0} disabled>Seleccionar...</option>
                        {mpItems.map((mp) => (
                          <option key={mp.id} value={mp.id}>
                            {mp.nombre} ({mp.unidadMedida})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      {idx === 0 && <p className="text-xs text-muted-foreground">Cantidad *</p>}
                      <Input
                        type="number"
                        min="0"
                        step="0.001"
                        value={line.cantidad || ''}
                        onChange={(e) => updateInsumoLine(idx, { cantidad: Number(e.target.value) })}
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      {idx === 0 && <p className="text-xs text-muted-foreground">Costo unit. (S/) *</p>}
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.costoUnitario || ''}
                        onChange={(e) =>
                          updateInsumoLine(idx, { costoUnitario: Number(e.target.value) })
                        }
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive hover:text-destructive"
                      onClick={() => removeInsumoLine(idx)}
                      disabled={insumoLines.length === 1}
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createSaving}>
                {createSaving && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
                Crear Orden
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* DETAIL DIALOG                                                        */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailOrder
                ? `Orden #${detailOrder.id}`
                : 'Cargando orden...'}
            </DialogTitle>
          </DialogHeader>

          {detailLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!detailLoading && detailOrder && (
            <div className="space-y-5">
              {/* Order info card */}
              <Card>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Fecha</p>
                      <p className="font-medium">
                        {new Date(detailOrder.fecha + 'T00:00:00').toLocaleDateString('es-PE')}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Estado</p>
                      <Badge className={stateColors[detailOrder.estado] ?? ''}>
                        {stateLabels[detailOrder.estado] ?? detailOrder.estado}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Creado por</p>
                      <p className="font-medium">{detailOrder.creadoPor?.nombre ?? '—'}</p>
                    </div>
                    {detailOrder.observacion && (
                      <div className="col-span-3">
                        <p className="text-muted-foreground text-xs mb-0.5">Observación</p>
                        <p>{detailOrder.observacion}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Insumos table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <FlaskConicalIcon className="h-4 w-4 text-muted-foreground" />
                    Insumos utilizados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-left">
                        <th className="pb-2 font-medium">Item</th>
                        <th className="pb-2 font-medium text-right">Cantidad</th>
                        <th className="pb-2 font-medium text-right">Costo Unit.</th>
                        <th className="pb-2 font-medium text-right">Costo Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {detailOrder.insumos.map((ins) => (
                        <tr key={ins.id}>
                          <td className="py-2">{ins.itemInventario.nombre}</td>
                          <td className="py-2 text-right">{Number(ins.cantidad).toFixed(2)} kg</td>
                          <td className="py-2 text-right">S/ {Number(ins.costoUnitario).toFixed(2)}</td>
                          <td className="py-2 text-right">S/ {Number(ins.costoTotal).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Productos table — only when completed */}
              {detailOrder.estado === 'COMPLETADA' && detailOrder.productos.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      <PackageIcon className="h-4 w-4 text-muted-foreground" />
                      Productos obtenidos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-left">
                          <th className="pb-2 font-medium">Producto</th>
                          <th className="pb-2 font-medium text-right">Cantidad</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {detailOrder.productos.map((prod) => (
                          <tr key={prod.id}>
                            <td className="py-2">{prod.producto.nombre}</td>
                            <td className="py-2 text-right">{Number(prod.cantidad).toFixed(2)} kg</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {/* Metrics card — only when completed and metrics present */}
              {detailOrder.estado === 'COMPLETADA' && detailOrder.metrics && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Métricas de producción</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs mb-0.5">MP total</p>
                        <p className="font-semibold">{detailOrder.metrics.totalMpKg.toFixed(2)} kg</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs mb-0.5">PT total</p>
                        <p className="font-semibold">{detailOrder.metrics.totalPtKg.toFixed(2)} kg</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs mb-0.5">Rendimiento</p>
                        <p className="font-semibold text-green-700">
                          {detailOrder.metrics.rendimiento.toFixed(1)} %
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs mb-0.5">Merma</p>
                        <p className="font-semibold">
                          {detailOrder.metrics.mermaKg.toFixed(2)} kg
                          <span className="text-muted-foreground font-normal ml-1">
                            ({detailOrder.metrics.mermaPct.toFixed(1)} %)
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs mb-0.5">Costo total MP</p>
                        <p className="font-semibold">S/ {detailOrder.metrics.costoTotalMp.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs mb-0.5">Costo real / kg</p>
                        <p className="font-semibold">S/ {detailOrder.metrics.costoRealPorKg.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Complete production form — only for PENDIENTE */}
              {detailOrder.estado === 'PENDIENTE' && (
                <>
                  {!completeMode ? (
                    <div className="flex justify-end">
                      <Button onClick={() => setCompleteMode(true)}>
                        Completar Producción
                      </Button>
                    </div>
                  ) : (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-1.5">
                          <PackageIcon className="h-4 w-4 text-muted-foreground" />
                          Registrar productos obtenidos
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <form onSubmit={handleComplete} className="space-y-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">
                                Indicá los productos terminados y sus cantidades
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addProductoLine}
                              >
                                <PlusIcon className="h-3.5 w-3.5 mr-1" />
                                Agregar producto
                              </Button>
                            </div>

                            <div className="rounded-md border divide-y">
                              {productoLines.map((line, idx) => (
                                <div
                                  key={idx}
                                  className="grid grid-cols-[1fr_140px_36px] gap-2 p-3 items-end"
                                >
                                  <div className="space-y-1">
                                    {idx === 0 && (
                                      <p className="text-xs text-muted-foreground">Producto *</p>
                                    )}
                                    <select
                                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                      value={line.productoId}
                                      onChange={(e) =>
                                        updateProductoLine(idx, { productoId: Number(e.target.value) })
                                      }
                                      required
                                    >
                                      <option value={0} disabled>Seleccionar...</option>
                                      {products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.nombre} ({p.codigoSku})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="space-y-1">
                                    {idx === 0 && (
                                      <p className="text-xs text-muted-foreground">Cantidad (kg) *</p>
                                    )}
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.001"
                                      value={line.cantidad || ''}
                                      onChange={(e) =>
                                        updateProductoLine(idx, { cantidad: Number(e.target.value) })
                                      }
                                      placeholder="0.00"
                                      required
                                    />
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 text-destructive hover:text-destructive"
                                    onClick={() => removeProductoLine(idx)}
                                    disabled={productoLines.length === 1}
                                  >
                                    <Trash2Icon className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setCompleteMode(false)}
                            >
                              Cancelar
                            </Button>
                            <Button type="submit" disabled={completeSaving}>
                              {completeSaving && (
                                <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                              )}
                              Confirmar producción
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
