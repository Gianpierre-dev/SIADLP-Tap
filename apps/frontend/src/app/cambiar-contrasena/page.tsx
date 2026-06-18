'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/auth';
import { apiPatch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { KeyIcon, Loader2Icon, ShieldAlertIcon } from 'lucide-react';

const REGLA_FORTALEZA = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export default function CambiarContrasenaPage() {
  const router = useRouter();
  const { user, isAuthenticated, hydrate, marcarContrasenaActualizada } =
    useAuthStore();
  const [ready, setReady] = useState(false);
  const [contrasenaActual, setContrasenaActual] = useState('');
  const [contrasenaNueva, setContrasenaNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    hydrate();
    setReady(true);
  }, [hydrate]);

  useEffect(() => {
    if (ready && !isAuthenticated) {
      router.replace('/login');
    }
  }, [ready, isAuthenticated, router]);

  if (!ready || !isAuthenticated || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const forzado = user.debeCambiarContrasena;

  const validar = (): string | null => {
    if (contrasenaNueva !== confirmacion) {
      return 'La confirmación no coincide con la nueva contraseña';
    }
    if (!REGLA_FORTALEZA.test(contrasenaNueva)) {
      return 'La nueva contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula y un número';
    }
    if (contrasenaActual === contrasenaNueva) {
      return 'La nueva contraseña debe ser distinta a la actual';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errorValidacion = validar();
    if (errorValidacion) {
      toast.error(errorValidacion);
      return;
    }
    setLoading(true);
    try {
      await apiPatch('/auth/change-password', {
        contrasenaActual,
        contrasenaNueva,
      });
      marcarContrasenaActualizada();
      toast.success('Contraseña actualizada correctamente');
      router.replace('/');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo actualizar la contraseña',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center items-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f5e9] text-[#33691e]">
            <KeyIcon className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl">Cambiar contraseña</CardTitle>
          <CardDescription>
            {forzado
              ? 'Tu contraseña fue restablecida. Configura una nueva para continuar.'
              : 'Actualiza tu contraseña por motivos de seguridad'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {forzado && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              <ShieldAlertIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>No podrás acceder al sistema hasta que cambies tu contraseña.</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="actual">Contraseña actual</Label>
              <PasswordInput
                id="actual"
                value={contrasenaActual}
                onChange={(e) => setContrasenaActual(e.target.value)}
                autoComplete="current-password"
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nueva">Nueva contraseña</Label>
              <PasswordInput
                id="nueva"
                value={contrasenaNueva}
                onChange={(e) => setContrasenaNueva(e.target.value)}
                autoComplete="new-password"
                required
              />
              <p className="text-xs text-muted-foreground">
                Mínimo 8 caracteres, con mayúscula, minúscula y número.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmacion">Confirmar nueva contraseña</Label>
              <PasswordInput
                id="confirmacion"
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="mt-2 w-full">
              {loading ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : (
                <KeyIcon className="h-4 w-4" />
              )}
              <span className="ml-2">
                {loading ? 'Actualizando...' : 'Actualizar contraseña'}
              </span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
