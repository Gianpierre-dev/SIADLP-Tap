'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiGet } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingCartIcon,
  TruckIcon,
} from 'lucide-react';

interface DashboardData {
  pedidos: { total: number; porEstado: Record<string, number> };
  despacho: { hojasDelDia: number; entregasCompletadas: number; entregasPendientes: number; entregasConNovedad: number };
}

function KpiCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function StateSummary({ porEstado }: { porEstado: Record<string, number> }) {
  const stateColors: Record<string, string> = {
    REGISTERED: 'bg-blue-100 text-blue-800',
    CONFIRMED: 'bg-green-100 text-green-800',
    DISPATCHED: 'bg-yellow-100 text-yellow-800',
    DELIVERED: 'bg-emerald-100 text-emerald-800',
    CANCELLED: 'bg-red-100 text-red-800',
    ISSUE: 'bg-orange-100 text-orange-800',
  };

  const stateLabels: Record<string, string> = {
    REGISTERED: 'Registrado',
    CONFIRMED: 'Confirmado',
    DISPATCHED: 'Despachado',
    DELIVERED: 'Entregado',
    CANCELLED: 'Cancelado',
    ISSUE: 'Novedad',
  };

  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(porEstado).map(([estado, count]) => (
        <Badge key={estado} variant="outline" className={stateColors[estado] ?? ''}>
          {stateLabels[estado] ?? estado}: {count}
        </Badge>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    apiGet<DashboardData>(`/reports/dashboard?fecha=${today}`)
      .then(setData)
      .catch(() => toast.error('Error al cargar el dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Resumen del día" />
        <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2 @lg:grid-cols-3 @xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Resumen del día" />
        <p className="text-muted-foreground">No se pudieron cargar los datos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Resumen operativo del día" />

      <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2 @lg:grid-cols-4">
        <KpiCard
          title="Pedidos del día"
          value={data.pedidos.total}
          icon={ShoppingCartIcon}
        />
        <KpiCard
          title="Despachos del día"
          value={data.despacho.hojasDelDia}
          icon={TruckIcon}
        />
        <KpiCard
          title="Entregas completadas"
          value={data.despacho.entregasCompletadas}
          description={`${data.despacho.entregasPendientes} pendientes`}
          icon={TruckIcon}
        />
        <KpiCard
          title="Entregas con novedad"
          value={data.despacho.entregasConNovedad}
          icon={TruckIcon}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pedidos por estado</CardTitle>
        </CardHeader>
        <CardContent>
          {data.pedidos.total === 0 ? (
            <p className="text-sm text-muted-foreground">Sin pedidos hoy</p>
          ) : (
            <StateSummary porEstado={data.pedidos.porEstado} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entregas del día</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Completadas</span>
            <span className="font-medium">{data.despacho.entregasCompletadas}</span>
          </div>
          <div className="flex justify-between">
            <span>Pendientes</span>
            <span className="font-medium">{data.despacho.entregasPendientes}</span>
          </div>
          <div className="flex justify-between">
            <span>Con novedad</span>
            <span className="font-medium text-orange-600">{data.despacho.entregasConNovedad}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
