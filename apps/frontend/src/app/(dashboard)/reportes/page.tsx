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
  TruckIcon,
  DownloadIcon,
  Loader2Icon,
  AlertTriangleIcon,
  UserIcon,
  RouteIcon,
  UsersIcon,
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
  const [dispatchRange, setDispatchRange] = useState<DateRange>({
    desde: defaultDesde(),
    hasta: defaultHasta(),
  });
  const [issuesRange, setIssuesRange] = useState<DateRange>({
    desde: defaultDesde(),
    hasta: defaultHasta(),
  });
  const [byDriverRange, setByDriverRange] = useState<DateRange>({
    desde: defaultDesde(),
    hasta: defaultHasta(),
  });
  const [byRouteRange, setByRouteRange] = useState<DateRange>({
    desde: defaultDesde(),
    hasta: defaultHasta(),
  });
  const [byClientRange, setByClientRange] = useState<DateRange>({
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

        {/* Novedades */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="h-5 w-5 text-muted-foreground" />
              Novedades
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exporta las entregas con novedad y su motivo en el rango de fechas seleccionado.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="issues-desde">Desde</Label>
                <Input
                  id="issues-desde"
                  type="date"
                  value={issuesRange.desde}
                  onChange={(e) =>
                    setIssuesRange((r) => ({ ...r, desde: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="issues-hasta">Hasta</Label>
                <Input
                  id="issues-hasta"
                  type="date"
                  value={issuesRange.hasta}
                  onChange={(e) =>
                    setIssuesRange((r) => ({ ...r, hasta: e.target.value }))
                  }
                />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={loading['issues']}
              onClick={() =>
                handleDownload(
                  'issues',
                  `/reports/export/issues?desde=${issuesRange.desde}&hasta=${issuesRange.hasta}`,
                  `novedades_${issuesRange.desde}_${issuesRange.hasta}.xlsx`,
                )
              }
            >
              {loading['issues'] ? (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <DownloadIcon className="mr-2 h-4 w-4" />
              )}
              Descargar Excel
            </Button>
          </CardContent>
        </Card>

        {/* Por Chofer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-muted-foreground" />
              Por Chofer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exporta un resumen de entregas por chofer en el rango de fechas seleccionado.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="by-driver-desde">Desde</Label>
                <Input
                  id="by-driver-desde"
                  type="date"
                  value={byDriverRange.desde}
                  onChange={(e) =>
                    setByDriverRange((r) => ({ ...r, desde: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="by-driver-hasta">Hasta</Label>
                <Input
                  id="by-driver-hasta"
                  type="date"
                  value={byDriverRange.hasta}
                  onChange={(e) =>
                    setByDriverRange((r) => ({ ...r, hasta: e.target.value }))
                  }
                />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={loading['byDriver']}
              onClick={() =>
                handleDownload(
                  'byDriver',
                  `/reports/export/by-driver?desde=${byDriverRange.desde}&hasta=${byDriverRange.hasta}`,
                  `por-chofer_${byDriverRange.desde}_${byDriverRange.hasta}.xlsx`,
                )
              }
            >
              {loading['byDriver'] ? (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <DownloadIcon className="mr-2 h-4 w-4" />
              )}
              Descargar Excel
            </Button>
          </CardContent>
        </Card>

        {/* Por Ruta */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RouteIcon className="h-5 w-5 text-muted-foreground" />
              Por Ruta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exporta un resumen agregado de pedidos, kilos y entregas por ruta en el rango de fechas seleccionado.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="by-route-desde">Desde</Label>
                <Input
                  id="by-route-desde"
                  type="date"
                  value={byRouteRange.desde}
                  onChange={(e) =>
                    setByRouteRange((r) => ({ ...r, desde: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="by-route-hasta">Hasta</Label>
                <Input
                  id="by-route-hasta"
                  type="date"
                  value={byRouteRange.hasta}
                  onChange={(e) =>
                    setByRouteRange((r) => ({ ...r, hasta: e.target.value }))
                  }
                />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={loading['byRoute']}
              onClick={() =>
                handleDownload(
                  'byRoute',
                  `/reports/export/by-route?desde=${byRouteRange.desde}&hasta=${byRouteRange.hasta}`,
                  `por-ruta_${byRouteRange.desde}_${byRouteRange.hasta}.xlsx`,
                )
              }
            >
              {loading['byRoute'] ? (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <DownloadIcon className="mr-2 h-4 w-4" />
              )}
              Descargar Excel
            </Button>
          </CardContent>
        </Card>

        {/* Por Cliente */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5 text-muted-foreground" />
              Por Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exporta un resumen agregado de pedidos y kilos por cliente en el rango de fechas seleccionado.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="by-client-desde">Desde</Label>
                <Input
                  id="by-client-desde"
                  type="date"
                  value={byClientRange.desde}
                  onChange={(e) =>
                    setByClientRange((r) => ({ ...r, desde: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="by-client-hasta">Hasta</Label>
                <Input
                  id="by-client-hasta"
                  type="date"
                  value={byClientRange.hasta}
                  onChange={(e) =>
                    setByClientRange((r) => ({ ...r, hasta: e.target.value }))
                  }
                />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={loading['byClient']}
              onClick={() =>
                handleDownload(
                  'byClient',
                  `/reports/export/by-client?desde=${byClientRange.desde}&hasta=${byClientRange.hasta}`,
                  `por-cliente_${byClientRange.desde}_${byClientRange.hasta}.xlsx`,
                )
              }
            >
              {loading['byClient'] ? (
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
