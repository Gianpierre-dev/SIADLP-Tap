'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ShoppingCartIcon,
  FactoryIcon,
  WarehouseIcon,
  TruckIcon,
  DownloadIcon,
  Loader2Icon,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4020/api';

const defaultDesde = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
};

const defaultHasta = () => new Date().toISOString().split('T')[0];

const downloadExcel = async (url: string, filename: string) => {
  const token = localStorage.getItem('access_token');
  const res = await fetch(`${API_URL}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Error al descargar');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

interface DateRange {
  desde: string;
  hasta: string;
}

export default function ReportesPage() {
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const [ordersRange, setOrdersRange] = useState<DateRange>({
    desde: defaultDesde(),
    hasta: defaultHasta(),
  });
  const [productionRange, setProductionRange] = useState<DateRange>({
    desde: defaultDesde(),
    hasta: defaultHasta(),
  });
  const [dispatchRange, setDispatchRange] = useState<DateRange>({
    desde: defaultDesde(),
    hasta: defaultHasta(),
  });

  const setLoadingKey = (key: string, value: boolean) =>
    setLoading((prev) => ({ ...prev, [key]: value }));

  const handleDownload = async (
    key: string,
    url: string,
    filename: string,
  ) => {
    setLoadingKey(key, true);
    try {
      await downloadExcel(url, filename);
      toast.success('Reporte descargado correctamente');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al descargar');
    } finally {
      setLoadingKey(key, false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        description="Exportación de reportes en formato Excel"
      />

      <div className="grid grid-cols-1 gap-6 @md:grid-cols-2">
        {/* Pedidos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCartIcon className="h-5 w-5 text-muted-foreground" />
              Pedidos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exporta el listado completo de pedidos en el rango de fechas seleccionado.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="orders-desde">Desde</Label>
                <Input
                  id="orders-desde"
                  type="date"
                  value={ordersRange.desde}
                  onChange={(e) =>
                    setOrdersRange((r) => ({ ...r, desde: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="orders-hasta">Hasta</Label>
                <Input
                  id="orders-hasta"
                  type="date"
                  value={ordersRange.hasta}
                  onChange={(e) =>
                    setOrdersRange((r) => ({ ...r, hasta: e.target.value }))
                  }
                />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={loading['orders']}
              onClick={() =>
                handleDownload(
                  'orders',
                  `/reports/export/orders?desde=${ordersRange.desde}&hasta=${ordersRange.hasta}`,
                  `pedidos_${ordersRange.desde}_${ordersRange.hasta}.xlsx`,
                )
              }
            >
              {loading['orders'] ? (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <DownloadIcon className="mr-2 h-4 w-4" />
              )}
              Descargar Excel
            </Button>
          </CardContent>
        </Card>

        {/* Producción */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FactoryIcon className="h-5 w-5 text-muted-foreground" />
              Producción
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exporta el registro de órdenes de producción en el rango de fechas seleccionado.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="production-desde">Desde</Label>
                <Input
                  id="production-desde"
                  type="date"
                  value={productionRange.desde}
                  onChange={(e) =>
                    setProductionRange((r) => ({ ...r, desde: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="production-hasta">Hasta</Label>
                <Input
                  id="production-hasta"
                  type="date"
                  value={productionRange.hasta}
                  onChange={(e) =>
                    setProductionRange((r) => ({ ...r, hasta: e.target.value }))
                  }
                />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={loading['production']}
              onClick={() =>
                handleDownload(
                  'production',
                  `/reports/export/production?desde=${productionRange.desde}&hasta=${productionRange.hasta}`,
                  `produccion_${productionRange.desde}_${productionRange.hasta}.xlsx`,
                )
              }
            >
              {loading['production'] ? (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <DownloadIcon className="mr-2 h-4 w-4" />
              )}
              Descargar Excel
            </Button>
          </CardContent>
        </Card>

        {/* Inventario */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WarehouseIcon className="h-5 w-5 text-muted-foreground" />
              Inventario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exporta el estado actual del inventario de productos.
            </p>
            <Button
              className="w-full"
              disabled={loading['inventory']}
              onClick={() =>
                handleDownload(
                  'inventory',
                  '/reports/export/inventory',
                  `inventario_${defaultHasta()}.xlsx`,
                )
              }
            >
              {loading['inventory'] ? (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <DownloadIcon className="mr-2 h-4 w-4" />
              )}
              Descargar Excel
            </Button>
          </CardContent>
        </Card>

        {/* Despacho */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TruckIcon className="h-5 w-5 text-muted-foreground" />
              Despacho
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exporta el registro de despachos realizados en el rango de fechas seleccionado.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="dispatch-desde">Desde</Label>
                <Input
                  id="dispatch-desde"
                  type="date"
                  value={dispatchRange.desde}
                  onChange={(e) =>
                    setDispatchRange((r) => ({ ...r, desde: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dispatch-hasta">Hasta</Label>
                <Input
                  id="dispatch-hasta"
                  type="date"
                  value={dispatchRange.hasta}
                  onChange={(e) =>
                    setDispatchRange((r) => ({ ...r, hasta: e.target.value }))
                  }
                />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={loading['dispatch']}
              onClick={() =>
                handleDownload(
                  'dispatch',
                  `/reports/export/dispatch?desde=${dispatchRange.desde}&hasta=${dispatchRange.hasta}`,
                  `despacho_${dispatchRange.desde}_${dispatchRange.hasta}.xlsx`,
                )
              }
            >
              {loading['dispatch'] ? (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <DownloadIcon className="mr-2 h-4 w-4" />
              )}
              Descargar Excel
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
