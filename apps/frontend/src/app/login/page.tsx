'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/auth';
import { useEmpresaStore } from '@/lib/empresa';
import { apiPost } from '@/lib/api';
import { resolverHomePorPermisos } from '@/lib/home-route';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogInIcon, Loader2Icon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

const getBackendUrl = (path: string | null | undefined): string => {
  if (!path) return '/LogoLaCosecha.png';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4020/api';
  const baseUrl = apiUrl.replace(/\/api$/, '');
  return `${baseUrl}${path}`;
};

interface LoginResponse {
  accessToken: string;
  usuario: {
    id: number;
    correo: string;
    nombre: string;
    permisos: string[];
    debeCambiarContrasena: boolean;
  };
}

export default function LoginPage() {
  const router = useRouter();
  const { setUser, isAuthenticated, hydrate, user } = useAuthStore();
  const { empresa, fetchEmpresaPublic } = useEmpresaStore();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorInline, setErrorInline] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
    fetchEmpresaPublic();
  }, [hydrate, fetchEmpresaPublic]);

  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace(resolverHomePorPermisos(user.permisos));
    }
  }, [isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorInline(null);
    try {
      const res = await apiPost<LoginResponse>('/auth/login', { correo, contrasena });
      setUser(res.usuario, res.accessToken);
      if (res.usuario.debeCambiarContrasena) {
        toast.info('Debes cambiar tu contraseña antes de continuar');
        router.replace('/cambiar-contrasena');
        return;
      }
      toast.success(`Bienvenido, ${res.usuario.nombre}`);
      router.replace(resolverHomePorPermisos(res.usuario.permisos));
    } catch (err) {
      const statusCode =
        err && typeof err === 'object' && 'statusCode' in err
          ? (err as { statusCode: number }).statusCode
          : null;
      let mensaje: string;
      if (statusCode === 429) {
        mensaje = 'Demasiados intentos. Espera un minuto antes de volver a intentar.';
      } else if (statusCode === 401) {
        mensaje = 'Correo o contraseña incorrectos.';
      } else {
        mensaje = err instanceof Error ? err.message : 'Error al iniciar sesión';
      }
      setErrorInline(mensaje);
      toast.error(mensaje);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="@container flex min-h-screen items-center justify-center bg-[#1a3a0e] px-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 30px, white 30px, white 60px)' }} />
      <Card className="w-full max-w-sm relative z-10 shadow-2xl">
        <CardHeader className="text-center items-center">
          <Image
            src={getBackendUrl(empresa?.logoUrl)}
            alt={empresa?.razonSocial ?? 'La Cosecha S.A.C.'}
            width={160}
            height={160}
            sizes="160px"
            className="mx-auto"
            priority
            fetchPriority="high"
            unoptimized={!!empresa?.logoUrl}
          />
          <CardTitle className="text-2xl font-bold text-[#33691e]">SIADLP</CardTitle>
          <CardDescription>Sistema Integral — {empresa?.razonSocial ?? 'La Cosecha S.A.C.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {errorInline && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                <span>{errorInline}</span>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="correo">Correo electrónico</Label>
              <Input
                id="correo"
                type="email"
                placeholder="admin@lacosecha.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                autoComplete="username"
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contrasena">Contraseña</Label>
              <PasswordInput
                id="contrasena"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : (
                <LogInIcon className="h-4 w-4" />
              )}
              <span className="ml-2">{loading ? 'Ingresando...' : 'Ingresar'}</span>
            </Button>
            <Link
              href="/solicitar-reset"
              className="text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
