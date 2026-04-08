'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { DataTable, Column } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  EyeIcon,
  PackageCheckIcon,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Purchase {
  id: number;
  proveedorId: number;
  estado: string;
  observacion: string | null;
  total: string;
  fechaCreacion: string;
  proveedor: { id: number; razonSocial: string };
  _count: { detalles: number };
}

interface PurchaseDetail {
  id: number;
  descripcion: string;
  unidadMedida: string;
  cantidad: string;
  cantidadRecibida: string | null;
  precioUnitario: string;
  subtotal: string;
}

interface PurchaseFull extends Omit<Purchase, '_count'> {
  detalles: PurchaseDetail[];
}

interface Supplier {
  id: number;
  razonSocial: string;
  activo: boolean;
}

interface PaginatedResponse {
  data: Purchase[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const stateColors: Record<string, string> = {
  EMITIDA: 'bg-blue-100 text-blue-800',
  CONFIRMADA: 'bg-green-100 text-green-800',
  EN_CAMINO: 'bg-yellow-100 text-yellow-800',
  RECIBIDA: 'bg-emerald-100 text-emerald-800',
  CANCELADA: 'bg-red-100 text-red-800',
};

const stateLabels: Record<string, string> = {
  EMITIDA: 'Emitida',
  CONFIRMADA: 'Confirmada',
  EN_CAMINO: 'En Camino',
  RECIBIDA: 'Recibida',
  CANCELADA: 'Cancelada',
};

interface LineItem {
  descripcion: string;
  unidadMedida: string;
  cantidad: number;
  precioUnitario: number;
}

const EMPTY_LINE: LineItem = {
  descripcion: '',
  unidadMedida: 'kg',
  cantidad: 0,
  precioUnitario: 0,
};

const fmt = (val: string | number) => `S/ ${Number(val).toFixed(2)}`;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ComprasPage() {
  // List state
  const [items, setItems] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Suppliers for create form
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [proveedorId, setProveedorId] = useState<string>('');
  const [observacion, setObservacion] = useState('');
  const [lines, setLines] = useState<LineItem[]>([{ ...EMPTY_LINE }]);

  // Detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedOC, setSelectedOC] = useState<PurchaseFull | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Receive mode (inside detail dialog)
  const [receiveMode, setReceiveMode] = useState(false);
  const [receiveQtys, setReceiveQtys] = useState<Record<number, string>>({});

  // ── Fetch list ──────────────────────────────────────────────────────────────

  const fetchItems = useCallback((p: number) => {
    setLoading(true);
    apiGet<PaginatedResponse>(`/purchases?page=${p}&pageSize=${PAGE_SIZE}`)
      .then((res) => {
        setItems(res.data);
        setTotal(res.total);
      })
      .catch(() => toast.error('Error al cargar órdenes de compra'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchItems(page);
  }, [fetchItems, page]);

  useEffect(() => {
    apiGet<Supplier[]>('/catalogs/suppliers')
      .then((data) => setSuppliers(data.filter((s) => s.activo)))
      .catch(() => toast.error('Error al cargar proveedores'));
  }, []);

  // ── Create OC ───────────────────────────────────────────────────────────────

  const openCreate = () => {
    setProveedorId(suppliers[0]?.id.toString() ?? '');
    setObservacion('');
    setLines([{ ...EMPTY_LINE }]);
    setCreateDialogOpen(true);
  };

  const addLine = () => setLines((prev) => [...prev, { ...EMPTY_LINE }]);

  const removeLine = (idx: number) =>
    setLines((prev) => prev.filter((_, i) => i !== idx));

  const updateLine = <K extends keyof LineItem>(
    idx: number,
    field: K,
    value: LineItem[K],
  ) =>
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)),
    );

  const lineSubtotal = (l: LineItem) => l.cantidad * l.precioUnitario;

  const createTotal = lines.reduce((acc, l) => acc + lineSubtotal(l), 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proveedorId) {
      toast.error('Seleccioná un proveedor');
      return;
    }
    if (lines.some((l) => !l.descripcion.trim())) {
      toast.error('Completá la descripción de todas las líneas');
      return;
    }
    if (lines.some((l) => l.cantidad <= 0)) {
      toast.error('La cantidad de cada línea debe ser mayor a 0');
      return;
    }
    if (lines.some((l) => l.precioUnitario <= 0)) {
      toast.error('El precio unitario de cada línea debe ser mayor a 0');
      return;
    }
    setSaving(true);
    try {
      await apiPost('/purchases', {
        proveedorId: Number(proveedorId),
        observacion: observacion.trim() || undefined,
        detalles: lines.map((l) => ({
          descripcion: l.descripcion,
          unidadMedida: l.unidadMedida,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
        })),
      });
      toast.success('Orden de compra creada correctamente');
      setCreateDialogOpen(false);
      fetchItems(1);
      setPage(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear OC');
    } finally {
      setSaving(false);
    }
  };

  // ── Detail OC ───────────────────────────────────────────────────────────────

  const openDetail = (row: Purchase) => {
    setDetailDialogOpen(true);
    setReceiveMode(false);
    setSelectedOC(null);
    setDetailLoading(true);
    apiGet<PurchaseFull>(`/purchases/${row.id}`)
      .then((data) => {
        setSelectedOC(data);
        // Pre-fill receive quantities with original cantidad
        const initial: Record<number, string> = {};
        data.detalles.forEach((d) => {
          initial[d.id] = d.cantidad;
        });
        setReceiveQtys(initial);
      })
      .catch(() => toast.error('Error al cargar detalle'))
      .finally(() => setDetailLoading(false));
  };

  // ── Status change ────────────────────────────────────────────────────────────

  const changeStatus = async (nuevoEstado: string) => {
    if (!selectedOC) return;
    setActionLoading(true);
    try {
      await apiPatch(`/purchases/${selectedOC.id}/status`, { nuevoEstado });
      toast.success(`Estado actualizado a ${stateLabels[nuevoEstado] ?? nuevoEstado}`);
      setDetailDialogOpen(false);
      fetchItems(page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cambiar estado');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Receive ──────────────────────────────────────────────────────────────────

  const handleReceive = async () => {
    if (!selectedOC) return;
    setActionLoading(true);
    try {
      const lineas = selectedOC.detalles.map((d) => ({
        detalleId: d.id,
        cantidadRecibida: Number(receiveQtys[d.id] ?? d.cantidad),
      }));
      await apiPost(`/purchases/${selectedOC.id}/receive`, { lineas });
      toast.success('Recepción registrada correctamente');
      setDetailDialogOpen(false);
      fetchItems(page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar recepción');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Columns ──────────────────────────────────────────────────────────────────

  const columns: Column<Purchase>[] = [
    { key: 'id', label: 'ID', className: 'w-16' },
    {
      key: 'proveedor',
      label: 'Proveedor',
      render: (row) => row.proveedor.razonSocial,
    },
    {
      key: 'estado',
      label: 'Estado',
      className: 'w-32',
      render: (row) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${stateColors[row.estado] ?? 'bg-gray-100 text-gray-800'}`}
        >
          {stateLabels[row.estado] ?? row.estado}
        </span>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      className: 'w-28 text-right',
      render: (row) => fmt(row.total),
    },
    {
      key: 'fechaCreacion',
      label: 'Fecha',
      className: 'w-36',
      render: (row) =>
        new Date(row.fechaCreacion).toLocaleDateString('es-PE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      className: 'w-20',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            openDetail(row);
          }}
        >
          <EyeIcon className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Órdenes de Compra"
        description="Gestión de compras a proveedores"
        action={
          <Button onClick={openCreate}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Nueva OC
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        pagination={{ page, pageSize: PAGE_SIZE, total }}
        onPageChange={(p) => {
          setPage(p);
          fetchItems(p);
        }}
        onRowClick={openDetail}
        emptyMessage="No hay órdenes de compra registradas"
      />

      {/* ── Create Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Orden de Compra</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-5">
            {/* Proveedor */}
            <div className="space-y-1.5">
              <Label htmlFor="proveedorId">Proveedor *</Label>
              <select
                id="proveedorId"
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="" disabled>
                  Seleccionar proveedor…
                </option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.razonSocial}
                  </option>
                ))}
              </select>
            </div>

            {/* Observación */}
            <div className="space-y-1.5">
              <Label htmlFor="observacion">Observación</Label>
              <Input
                id="observacion"
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Opcional"
              />
            </div>

            {/* Líneas */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Líneas de detalle</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Agregar línea
                </Button>
              </div>

              {/* Header row */}
              <div className="grid grid-cols-[1fr_80px_80px_100px_80px_24px] gap-2 text-xs font-medium text-muted-foreground px-1">
                <span>Descripción</span>
                <span>Unidad</span>
                <span>Cantidad</span>
                <span>P. Unit.</span>
                <span className="text-right">Subtotal</span>
                <span />
              </div>

              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_80px_80px_100px_80px_24px] gap-2 items-center"
                >
                  <Input
                    placeholder="Descripción"
                    value={line.descripcion}
                    onChange={(e) => updateLine(idx, 'descripcion', e.target.value)}
                    required
                  />
                  <Input
                    placeholder="kg"
                    value={line.unidadMedida}
                    onChange={(e) => updateLine(idx, 'unidadMedida', e.target.value)}
                  />
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={line.cantidad}
                    onChange={(e) =>
                      updateLine(idx, 'cantidad', Number(e.target.value))
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={line.precioUnitario}
                    onChange={(e) =>
                      updateLine(idx, 'precioUnitario', Number(e.target.value))
                    }
                  />
                  <span className="text-sm text-right text-muted-foreground">
                    {fmt(lineSubtotal(line))}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={lines.length === 1}
                    onClick={() => removeLine(idx)}
                  >
                    <Trash2Icon className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}

              <div className="flex justify-end pt-1 border-t">
                <span className="text-sm font-semibold">
                  Total: {fmt(createTotal)}
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
                Crear OC
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedOC
                ? `OC #${selectedOC.id} — ${selectedOC.proveedor.razonSocial}`
                : 'Detalle de OC'}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : selectedOC ? (
            <div className="space-y-5">
              {/* Meta */}
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Estado: </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${stateColors[selectedOC.estado] ?? 'bg-gray-100 text-gray-800'}`}
                  >
                    {stateLabels[selectedOC.estado] ?? selectedOC.estado}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total: </span>
                  <span className="font-semibold">{fmt(selectedOC.total)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fecha: </span>
                  {new Date(selectedOC.fechaCreacion).toLocaleDateString('es-PE')}
                </div>
                {selectedOC.observacion && (
                  <div>
                    <span className="text-muted-foreground">Observación: </span>
                    {selectedOC.observacion}
                  </div>
                )}
              </div>

              {/* Detalles table */}
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Descripción</th>
                      <th className="text-left px-3 py-2 font-medium w-20">Unidad</th>
                      <th className="text-right px-3 py-2 font-medium w-24">Cantidad</th>
                      <th className="text-right px-3 py-2 font-medium w-28">Cant. Recibida</th>
                      <th className="text-right px-3 py-2 font-medium w-28">P. Unit.</th>
                      <th className="text-right px-3 py-2 font-medium w-28">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedOC.detalles.map((d) => (
                      <tr key={d.id}>
                        <td className="px-3 py-2">{d.descripcion}</td>
                        <td className="px-3 py-2">{d.unidadMedida}</td>
                        <td className="px-3 py-2 text-right">{d.cantidad}</td>
                        <td className="px-3 py-2 text-right">
                          {receiveMode ? (
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              className="h-7 w-24 text-right ml-auto"
                              value={receiveQtys[d.id] ?? d.cantidad}
                              onChange={(e) =>
                                setReceiveQtys((prev) => ({
                                  ...prev,
                                  [d.id]: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            d.cantidadRecibida ?? '—'
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">{fmt(d.precioUnitario)}</td>
                        <td className="px-3 py-2 text-right">{fmt(d.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/30 border-t">
                    <tr>
                      <td colSpan={5} className="px-3 py-2 text-right font-semibold">
                        Total
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {fmt(selectedOC.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 pt-1 border-t">
                {/* Status progression */}
                {selectedOC.estado === 'EMITIDA' && (
                  <Button
                    onClick={() => changeStatus('CONFIRMADA')}
                    disabled={actionLoading}
                  >
                    {actionLoading && (
                      <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                    )}
                    Confirmar
                  </Button>
                )}

                {selectedOC.estado === 'CONFIRMADA' && (
                  <Button
                    onClick={() => changeStatus('EN_CAMINO')}
                    disabled={actionLoading}
                  >
                    {actionLoading && (
                      <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                    )}
                    Marcar En Camino
                  </Button>
                )}

                {selectedOC.estado === 'EN_CAMINO' && !receiveMode && (
                  <Button
                    onClick={() => setReceiveMode(true)}
                    disabled={actionLoading}
                  >
                    <PackageCheckIcon className="h-4 w-4 mr-2" />
                    Registrar Recepción
                  </Button>
                )}

                {receiveMode && (
                  <>
                    <Button
                      onClick={handleReceive}
                      disabled={actionLoading}
                    >
                      {actionLoading && (
                        <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                      )}
                      Confirmar Recepción
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setReceiveMode(false)}
                      disabled={actionLoading}
                    >
                      Cancelar
                    </Button>
                  </>
                )}

                {/* Cancel button — available unless already RECIBIDA or CANCELADA */}
                {!['RECIBIDA', 'CANCELADA'].includes(selectedOC.estado) &&
                  !receiveMode && (
                    <Button
                      variant="destructive"
                      onClick={() => changeStatus('CANCELADA')}
                      disabled={actionLoading}
                    >
                      {actionLoading && (
                        <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                      )}
                      Cancelar OC
                    </Button>
                  )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
