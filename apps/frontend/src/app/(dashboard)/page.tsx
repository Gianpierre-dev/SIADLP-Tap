'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiGet } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShoppingCartIcon,
  TruckIcon,
  CircleCheckIcon,
  TriangleAlertIcon,
  ClipboardCheckIcon,
  PackageCheckIcon,
  CalendarClockIcon,
  UsersIcon,
  PackageIcon,
  MapIcon,
  UserCheckIcon,
} from 'lucide-react';

interface DashboardData {
  pedidos: { total: number; porEstado: Record<string, number> };
  despacho: {
    hojasDelDia: number;
    entregasCompletadas: number;
    entregasPendientes: number;
    entregasConNovedad: number;
  };
  recursos: {
    clientesActivos: number;
    productosActivos: number;
    rutasActivas: number;
    vehiculosActivos: number;
    choferesActivos: number;
  };
  pendientes: {
    porConfirmar: number;
    porDespachar: number;
    choferesPorRevalidar: number;
  };
  alertasChoferes: { nombre: string; fechaRevalidacion: string; dias: number }[];
  tendencia: { fecha: string; total: number }[];
}

type Periodo = 'dia' | 'semana' | 'mes';

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'dia', label: 'Hoy' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mes' },
];

const PERIODO_DESC: Record<Periodo, string> = {
  dia: 'Resumen operativo del día',
  semana: 'Resumen de los últimos 7 días',
  mes: 'Resumen de los últimos 30 días',
};

const ESTADO_ORDER = [
  'REGISTERED',
  'CONFIRMED',
  'DISPATCHED',
  'ON_ROUTE',
  'DELIVERED',
  'ISSUE',
  'CANCELLED',
];

const stateLabels: Record<string, string> = {
  REGISTERED: 'Registrado',
  CONFIRMED: 'Confirmado',
  DISPATCHED: 'Despachado',
  ON_ROUTE: 'En Ruta',
  DELIVERED: 'Entregado',
  ISSUE: 'Novedad',
  CANCELLED: 'Cancelado',
};

const stateBarColors: Record<string, string> = {
  REGISTERED: 'bg-[#1565c0]',
  CONFIRMED: 'bg-[#33691e]',
  DISPATCHED: 'bg-[#8a6914]',
  ON_ROUTE: 'bg-[#4338ca]',
  DELIVERED: 'bg-[#245216]',
  ISSUE: 'bg-[#d97706]',
  CANCELLED: 'bg-[#c62828]',
};

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
            value === o.key
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  accent = 'default',
  onClick,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
  accent?: 'default' | 'blue' | 'green' | 'gold' | 'amber' | 'red';
  onClick?: () => void;
}) {
  const accentStyles: Record<string, string> = {
    default: 'bg-muted text-muted-foreground',
    blue: 'bg-[#e3f2fd] text-[#1565c0]',
    green: 'bg-[#e8f5e9] text-[#33691e]',
    gold: 'bg-[#fff3c4] text-[#8a6914]',
    amber: 'bg-[#fef3c7] text-[#d97706]',
    red: 'bg-[#fee2e2] text-[#c62828]',
  };

  return (
    <Card
      onClick={onClick}
      className={onClick ? 'cursor-pointer transition-colors hover:bg-muted/30' : ''}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`rounded-md p-2 ${accentStyles[accent]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold tracking-tight">{value}</div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ActionCard({
  title,
  value,
  caption,
  icon: Icon,
  tone,
  onClick,
  children,
}: {
  title: string;
  value: number;
  caption: string;
  icon: React.ElementType;
  tone: 'blue' | 'gold' | 'red';
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const active = value > 0;
  const borders: Record<string, string> = {
    blue: 'border-l-[#1565c0]',
    gold: 'border-l-[#8a6914]',
    red: 'border-l-[#c62828]',
  };
  const iconStyles: Record<string, string> = {
    blue: 'bg-[#e3f2fd] text-[#1565c0]',
    gold: 'bg-[#fff3c4] text-[#8a6914]',
    red: 'bg-[#fee2e2] text-[#c62828]',
  };

  return (
    <Card
      onClick={onClick}
      className={`border-l-4 ${active ? borders[tone] : 'border-l-border'} ${
        onClick ? 'cursor-pointer transition-colors hover:bg-muted/30' : ''
      }`}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-3xl font-bold tracking-tight">{value}</div>
            <p className="mt-1 text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{caption}</p>
          </div>
          <div className={`rounded-md p-2 ${iconStyles[tone]}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function ResourceChip({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40"
    >
      <div className="rounded-md bg-muted p-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xl font-bold leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </button>
  );
}

function EstadoBarChart({
  porEstado,
  onSelect,
}: {
  porEstado: Record<string, number>;
  onSelect: (estado: string) => void;
}) {
  const entries = ESTADO_ORDER.map((estado) => ({
    estado,
    count: porEstado[estado] ?? 0,
  })).filter((e) => e.count > 0);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <ShoppingCartIcon className="h-8 w-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm font-medium">Sin pedidos en el período</p>
        <p className="text-xs text-muted-foreground">
          Los pedidos aparecerán aquí conforme se registren
        </p>
      </div>
    );
  }

  const max = Math.max(...entries.map((e) => e.count));

  return (
    <div className="space-y-3">
      {entries.map(({ estado, count }) => (
        <button
          key={estado}
          type="button"
          onClick={() => onSelect(estado)}
          className="flex w-full items-center gap-3 rounded p-1 text-left transition-colors hover:bg-muted/40"
        >
          <span className="w-24 shrink-0 text-xs font-medium">
            {stateLabels[estado] ?? estado}
          </span>
          <div className="h-6 flex-1 overflow-hidden rounded bg-muted">
            <div
              className={`h-full rounded ${stateBarColors[estado] ?? 'bg-primary'}`}
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="w-6 text-right text-sm font-semibold">{count}</span>
        </button>
      ))}
    </div>
  );
}

function TendenciaChart({ data }: { data: { fecha: string; total: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  const total = data.reduce((acc, d) => acc + d.total, 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <TriangleAlertIcon className="h-8 w-8 text-muted-foreground/40" />
        <p className="mt-2 text-sm font-medium">Sin pedidos en el rango</p>
      </div>
    );
  }

  // With 30 days, drop the per-day weekday label (too dense) — show endpoints only.
  const showLabels = data.length <= 14;

  return (
    <div className="space-y-2">
      <div className="flex h-40 items-end gap-1">
        {data.map((d) => {
          const pct = (d.total / max) * 100;
          return (
            <div
              key={d.fecha}
              title={`${d.fecha}: ${d.total}`}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            >
              {showLabels && (
                <span className="text-xs font-medium text-muted-foreground">
                  {d.total}
                </span>
              )}
              <div
                className="w-full rounded-t-md bg-[#1565c0]/85"
                style={{ height: `${d.total > 0 ? Math.max(pct, 4) : 0}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1">
        {data.map((d, i) => (
          <span
            key={d.fecha}
            className={`flex-1 text-center text-xs capitalize ${
              i === data.length - 1
                ? 'font-bold text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            {showLabels
              ? new Date(`${d.fecha}T00:00:00`).toLocaleDateString('es-PE', {
                  weekday: 'short',
                })
              : i === 0 || i === data.length - 1
                ? new Date(`${d.fecha}T00:00:00`).toLocaleDateString('es-PE', {
                    day: '2-digit',
                    month: '2-digit',
                  })
                : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>('dia');
  const [tendenciaDias, setTendenciaDias] = useState<7 | 30>(7);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setLoading(true);
    apiGet<DashboardData>(
      `/reports/dashboard?fecha=${today}&periodo=${periodo}&tendenciaDias=${tendenciaDias}`,
    )
      .then(setData)
      .catch(() => toast.error('Error al cargar el dashboard'))
      .finally(() => setLoading(false));
  }, [periodo, tendenciaDias]);

  const periodSelector = (
    <Segmented value={periodo} onChange={setPeriodo} options={PERIODOS} />
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          description={PERIODO_DESC[periodo]}
          action={periodSelector}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          description={PERIODO_DESC[periodo]}
          action={periodSelector}
        />
        <p className="text-muted-foreground">No se pudieron cargar los datos.</p>
      </div>
    );
  }

  const { pedidos, despacho, recursos, pendientes, alertasChoferes, tendencia } =
    data;

  const go = (href: string) => router.push(href);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={PERIODO_DESC[periodo]}
        action={periodSelector}
      />

      {/* KPIs del período */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Pedidos"
          value={pedidos.total}
          icon={ShoppingCartIcon}
          accent="blue"
          onClick={() => go('/pedidos')}
        />
        <KpiCard
          title="Despachos"
          value={despacho.hojasDelDia}
          icon={TruckIcon}
          accent="gold"
          onClick={() => go('/despacho')}
        />
        <KpiCard
          title="Entregas completadas"
          value={despacho.entregasCompletadas}
          description={`${despacho.entregasPendientes} pendientes`}
          icon={CircleCheckIcon}
          accent="green"
          onClick={() => go('/despacho')}
        />
        <KpiCard
          title="Entregas con novedad"
          value={despacho.entregasConNovedad}
          icon={TriangleAlertIcon}
          accent="amber"
          onClick={() => go('/despacho')}
        />
      </div>

      {/* Acciones pendientes */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Requiere atención
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ActionCard
            title="Pedidos por confirmar"
            value={pendientes.porConfirmar}
            caption="Registrados esperando confirmación"
            icon={ClipboardCheckIcon}
            tone="blue"
            onClick={() => go('/pedidos?estado=REGISTERED')}
          />
          <ActionCard
            title="Listos para despacho"
            value={pendientes.porDespachar}
            caption="Confirmados a la espera de ruta"
            icon={PackageCheckIcon}
            tone="gold"
            onClick={() => go('/pedidos?estado=CONFIRMED')}
          />
          <ActionCard
            title="Licencias por revalidar"
            value={pendientes.choferesPorRevalidar}
            caption="Choferes con revalidación ≤ 30 días"
            icon={CalendarClockIcon}
            tone="red"
            onClick={() => go('/catalogos/choferes')}
          >
            {alertasChoferes.length > 0 && (
              <div className="mt-3 space-y-1 border-t pt-3">
                {alertasChoferes.map((c) => (
                  <div
                    key={c.nombre}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="truncate pr-2">{c.nombre}</span>
                    <span
                      className={
                        c.dias < 0
                          ? 'shrink-0 font-medium text-[#c62828]'
                          : c.dias <= 7
                            ? 'shrink-0 font-medium text-[#d97706]'
                            : 'shrink-0 text-muted-foreground'
                      }
                    >
                      {c.dias < 0
                        ? `Vencida hace ${Math.abs(c.dias)}d`
                        : c.dias === 0
                          ? 'Vence hoy'
                          : `Vence en ${c.dias}d`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ActionCard>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pedidos por estado</CardTitle>
          </CardHeader>
          <CardContent>
            <EstadoBarChart
              porEstado={pedidos.porEstado}
              onSelect={(estado) => go(`/pedidos?estado=${estado}`)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Tendencia de pedidos</CardTitle>
            <Segmented
              value={String(tendenciaDias)}
              onChange={(v) => setTendenciaDias(Number(v) as 7 | 30)}
              options={[
                { key: '7', label: '7 días' },
                { key: '30', label: '30 días' },
              ]}
            />
          </CardHeader>
          <CardContent>
            <TendenciaChart data={tendencia} />
          </CardContent>
        </Card>
      </div>

      {/* Recursos operativos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recursos operativos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <ResourceChip
              icon={UsersIcon}
              label="Clientes activos"
              value={recursos.clientesActivos}
              onClick={() => go('/catalogos/clientes')}
            />
            <ResourceChip
              icon={PackageIcon}
              label="Productos activos"
              value={recursos.productosActivos}
              onClick={() => go('/catalogos/productos')}
            />
            <ResourceChip
              icon={MapIcon}
              label="Rutas activas"
              value={recursos.rutasActivas}
              onClick={() => go('/catalogos/rutas')}
            />
            <ResourceChip
              icon={TruckIcon}
              label="Vehículos activos"
              value={recursos.vehiculosActivos}
              onClick={() => go('/catalogos/vehiculos')}
            />
            <ResourceChip
              icon={UserCheckIcon}
              label="Choferes activos"
              value={recursos.choferesActivos}
              onClick={() => go('/catalogos/choferes')}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
