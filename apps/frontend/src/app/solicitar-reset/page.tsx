'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { KeyRoundIcon, Loader2Icon, CheckCircle2Icon } from 'lucide-react';

export default function SolicitarResetPage() {
  const [correo, setCorreo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiPost<{ message: string }>('/auth/solicitar-reset', {
        correo,
        motivo: motivo.trim() ? motivo.trim() : undefined,
      });
      setEnviado(true);
    } catch (err) {
      const statusCode =
        err && typeof err === 'object' && 'statusCode' in err
          ? (err as { statusCode: number }).statusCode
          : null;
      if (statusCode === 429) {
        toast.error('Demasiadas solicitudes. Espera un minuto antes de intentar de nuevo.');
      } else {
        toast.error(
          err instanceof Error
            ? err.message
            : 'No se pudo enviar la solicitud',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1a3a0e] px-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center items-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f5e9] text-[#33691e]">
            <KeyRoundIcon className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl">Recuperar contraseña</CardTitle>
          <CardDescription>
            {enviado
              ? 'Solicitud enviada al administrador'
              : 'Solicita al administrador que restablezca tu contraseña'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {enviado ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle2Icon className="h-10 w-10 text-[#33691e]" />
              <p className="text-sm text-muted-foreground">
                Si el correo está registrado, un administrador revisará tu
                solicitud y te entregará una contraseña temporal por el canal
                interno (WhatsApp, en persona).
              </p>
              <Link
                href="/login"
                className="text-sm font-medium text-[#33691e] underline-offset-4 hover:underline"
              >
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="correo">Correo electrónico</Label>
                <Input
                  id="correo"
                  type="email"
                  placeholder="usuario@lacosecha.com"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="motivo">
                  Motivo <span className="text-muted-foreground">(opcional)</span>
                </Label>
                <textarea
                  id="motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Ej: Olvidé mi contraseña tras las vacaciones"
                  className="rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
              <Button type="submit" disabled={loading} className="mt-2 w-full">
                {loading ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRoundIcon className="h-4 w-4" />
                )}
                <span className="ml-2">
                  {loading ? 'Enviando...' : 'Enviar solicitud'}
                </span>
              </Button>
              <Link
                href="/login"
                className="text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Volver al inicio de sesión
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
