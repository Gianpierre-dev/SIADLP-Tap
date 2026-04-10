'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/auth';
import { useEmpresaStore } from '@/lib/empresa';
import { apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogInIcon, Loader2Icon } from 'lucide-react';
import Image from 'next/image';

const getBackendUrl = (path: string | null | undefined): string => {
  if (!path) return '/LogoLaCosecha.png';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
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
  };
}

export default function LoginPage() {
  const router = useRouter();
  const { setUser, isAuthenticated, hydrate } = useAuthStore();
  const { empresa, fetchEmpresa } = useEmpresaStore();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    hydrate();
    fetchEmpresa();
  }, [hydrate, fetchEmpresa]);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiPost<LoginResponse>('/auth/login', { correo, contrasena });
      setUser(res.usuario, res.accessToken);
      toast.success(`Bienvenido, ${res.usuario.nombre}`);
      router.replace('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al iniciar sesión');
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
            className="mx-auto"
            priority
            unoptimized={!!empresa?.logoUrl}
          />
          <CardTitle className="text-2xl font-bold text-[#33691e]">SIADLP</CardTitle>
          <CardDescription>Sistema Integral — {empresa?.razonSocial ?? 'La Cosecha S.A.C.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="correo">Correo electrónico</Label>
              <Input
                id="correo"
                type="email"
                placeholder="admin@lacosecha.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contrasena">Contraseña</Label>
              <Input
                id="contrasena"
                type="password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
