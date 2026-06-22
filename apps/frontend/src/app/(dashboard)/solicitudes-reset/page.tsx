'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { DataTable, Column } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  CheckIcon,
  XIcon,
  CopyIcon,
  KeyRoundIcon,
  Loader2Icon,
} from 'lucide-react';
import { useConfirm } from '@/components/confirm-dialog';

type EstadoSolicitud = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

interface Solicitud {
  id: number;
  usuarioId: number;
  motivo: string | null;
  estado: EstadoSolicitud;
  aprobadorId: number | null;
  motivoRechazo: string | null;
  fechaCreacion: string;
  fechaProcesamiento: string | null;
  usuario: { id: number; correo: string; nombre: string };
  aprobador: { id: number; correo: string; nombre: string } | null;
}

const ESTADO_LABELS: Record<EstadoSolicitud, string> = {
  PENDIENTE: 'Pendiente',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
};

const ESTADO_BADGE: Record<EstadoSolicitud, string> = {
  PENDIENTE: 'bg-[#fff3c4] text-[#8a6914]',
  APROBADA: 'bg-[#e8f5e9] text-[#33691e]',
  RECHAZADA: 'bg-[#fee2e2] text-[#c62828]',
};

const formatearFecha = (iso: string): string =>
  new Date(iso).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function SolicitudesResetPage() {
  const [items, setItems] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<EstadoSolicitud>('PENDIENTE');
  const [aprobando, setAprobando] = useState<number | null>(null);
  const [aprobacionDialog, setAprobacionDialog] = useState(false);
  const [contrasenaTemporal, setContrasenaTemporal] = useState<string | null>(null);
  const [usuarioAprobado, setUsuarioAprobado] = useState<string>('');
  const [copiado, setCopiado] = useState(false);
  const [rechazoDialog, setRechazoDialog] = useState(false);
  const [solicitudARechazar, setSolicitudARechazar] = useState<Solicitud | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [rechazando, setRechazando] = useState(false);
  const askConfirm = useConfirm();

  const fetchItems = (estado: EstadoSolicitud) => {
    setLoading(true);
    apiGet<Solicitud[]>(`/solicitudes-reset?estado=${estado}`)
      .then(setItems)
      .catch(() => toast.error('Error al cargar solicitudes'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems(filtroEstado);
  }, [filtroEstado]);

  const handleAprobar = async (solicitud: Solicitud) => {
    const confirmar = await askConfirm({
      title: 'Aprobar solicitud',
      description:
        `¿Aprobar la solicitud de ${solicitud.usuario.nombre}?\n\n` +
        'Se generará una contraseña temporal que debes transmitirle por canal seguro.',
      confirmText: 'Aprobar',
    });
    if (!confirmar) return;
    setAprobando(solicitud.id);
    try {
      const res = await apiPost<{ contrasenaTemporal: string }>(
        `/solicitudes-reset/${solicitud.id}/aprobar`,
        {},
      );
      setContrasenaTemporal(res.contrasenaTemporal);
      setUsuarioAprobado(solicitud.usuario.nombre);
      setCopiado(false);
      setAprobacionDialog(true);
      fetchItems(filtroEstado);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Error al aprobar la solicitud',
      );
    } finally {
      setAprobando(null);
    }
  };

  const abrirRechazo = (solicitud: Solicitud) => {
    setSolicitudARechazar(solicitud);
    setMotivoRechazo('');
    setRechazoDialog(true);
  };

  const handleRechazar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!solicitudARechazar) return;
    if (motivoRechazo.trim().length < 3) {
      toast.error('Debes indicar un motivo (mínimo 3 caracteres)');
      return;
    }
    setRechazando(true);
    try {
      await apiPost(`/solicitudes-reset/${solicitudARechazar.id}/rechazar`, {
        motivoRechazo: motivoRechazo.trim(),
      });
      toast.success('Solicitud rechazada');
      setRechazoDialog(false);
      setSolicitudARechazar(null);
      fetchItems(filtroEstado);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Error al rechazar la solicitud',
      );
    } finally {
      setRechazando(false);
    }
  };

  const handleCopiarTemporal = async () => {
    if (!contrasenaTemporal) return;
    try {
      await navigator.clipboard.writeText(contrasenaTemporal);
      setCopiado(true);
      toast.success('Contraseña copiada al portapapeles');
    } catch {
      toast.error('No se pudo copiar. Selecciona y copia manualmente.');
    }
  };

  const todasLasColumnas: Array<Column<Solicitud> & { mostrarEn: EstadoSolicitud[] }> = [
    { key: 'id', label: 'ID', className: 'w-12', mostrarEn: ['PENDIENTE', 'APROBADA', 'RECHAZADA'] },
    {
      key: 'usuario',
      label: 'Usuario',
      mostrarEn: ['PENDIENTE', 'APROBADA', 'RECHAZADA'],
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.usuario.nombre}</span>
          <span className="text-xs text-muted-foreground">{row.usuario.correo}</span>
        </div>
      ),
    },
    {
      key: 'motivo',
      label: 'Motivo',
      className: 'max-w-[14rem]',
      mostrarEn: ['PENDIENTE', 'APROBADA', 'RECHAZADA'],
      render: (row) =>
        row.motivo ? (
          <span className="line-clamp-2 text-sm" title={row.motivo}>
            {row.motivo}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'fechaCreacion',
      label: 'Solicitado',
      className: 'w-28',
      mostrarEn: ['PENDIENTE', 'APROBADA', 'RECHAZADA'],
      render: (row) => (
        <span className="text-xs">{formatearFecha(row.fechaCreacion)}</span>
      ),
    },
    {
      key: 'procesado',
      label: 'Procesado por',
      className: 'w-40',
      mostrarEn: ['APROBADA', 'RECHAZADA'],
      render: (row) => {
        if (!row.aprobador) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex flex-col">
            <span className="text-sm">{row.aprobador.nombre}</span>
            {row.motivoRechazo && (
              <span className="line-clamp-1 text-xs text-[#c62828]" title={row.motivoRechazo}>
                {row.motivoRechazo}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'acciones',
      label: 'Acciones',
      className: 'w-28',
      mostrarEn: ['PENDIENTE'],
      render: (row) =>
        row.estado === 'PENDIENTE' ? (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAprobar(row)}
              disabled={aprobando === row.id}
              aria-label="Aprobar"
              title="Aprobar y resetear"
            >
              {aprobando === row.id ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : (
                <CheckIcon className="h-4 w-4 text-[#33691e]" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => abrirRechazo(row)}
              aria-label="Rechazar"
              title="Rechazar"
            >
              <XIcon className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ];

  const columns: Column<Solicitud>[] = todasLasColumnas.filter((c) =>
    c.mostrarEn.includes(filtroEstado),
  );

  const filtros: EstadoSolicitud[] = ['PENDIENTE', 'APROBADA', 'RECHAZADA'];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Solicitudes de reset de contraseña"
        description="Gestiona las solicitudes enviadas por los usuarios"
      />

      <div className="flex gap-2">
        {filtros.map((estado) => (
          <Button
            key={estado}
            variant={filtroEstado === estado ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltroEstado(estado)}
          >
            {ESTADO_LABELS[estado]}
          </Button>
        ))}
      </div>

      <DataTable columns={columns} data={items} loading={loading} />

      <Dialog open={aprobacionDialog} onOpenChange={setAprobacionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitud aprobada</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Contraseña temporal generada para {usuarioAprobado}. Transmítela
              por canal seguro: el usuario deberá cambiarla al ingresar.
            </p>
            <div className="flex items-center gap-2 rounded-md border border-input bg-muted/50 px-3 py-2">
              <code className="flex-1 select-all font-mono text-sm">
                {contrasenaTemporal}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopiarTemporal}
                aria-label="Copiar contraseña"
              >
                {copiado ? (
                  <CheckIcon className="h-4 w-4 text-[#33691e]" />
                ) : (
                  <CopyIcon className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
            >
              <KeyRoundIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <p>
                Esta contraseña solo se muestra una vez. Una vez transmitida,
                cierra este aviso.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setAprobacionDialog(false)}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rechazoDialog} onOpenChange={setRechazoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar solicitud</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRechazar} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Indica el motivo del rechazo. Quedará registrado en la auditoría.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="motivo-rechazo">Motivo *</Label>
              <textarea
                id="motivo-rechazo"
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Ej: No se reconoce al solicitante"
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={rechazando} variant="destructive">
                {rechazando && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
                Rechazar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
