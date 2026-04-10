'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { apiPatch } from '@/lib/api';
import { useEmpresaStore, Empresa } from '@/lib/empresa';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2Icon, UploadIcon } from 'lucide-react';

const getBackendUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  const baseUrl = apiUrl.replace(/\/api$/, '');
  return `${baseUrl}${path}`;
};

interface FormState {
  razonSocial: string;
  nombreComercial: string;
  ruc: string;
  direccion: string;
  telefono: string;
  correo: string;
}

const EMPTY_FORM: FormState = {
  razonSocial: '',
  nombreComercial: '',
  ruc: '',
  direccion: '',
  telefono: '',
  correo: '',
};

export default function ConfiguracionPage() {
  const { empresa, setEmpresa, fetchEmpresa } = useEmpresaStore();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchEmpresa();
  }, [fetchEmpresa]);

  useEffect(() => {
    if (empresa) {
      setForm({
        razonSocial: empresa.razonSocial ?? '',
        nombreComercial: empresa.nombreComercial ?? '',
        ruc: empresa.ruc ?? '',
        direccion: empresa.direccion ?? '',
        telefono: empresa.telefono ?? '',
        correo: empresa.correo ?? '',
      });
    }
  }, [empresa]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        razonSocial: form.razonSocial,
        nombreComercial: form.nombreComercial || undefined,
        ruc: form.ruc || undefined,
        direccion: form.direccion || undefined,
        telefono: form.telefono || undefined,
        correo: form.correo || undefined,
      };
      const updated = await apiPatch<Empresa>('/empresa', payload);
      setEmpresa(updated);
      toast.success('Configuración actualizada correctamente');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);

      const token = localStorage.getItem('access_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
      const res = await fetch(`${apiUrl}/empresa/logo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Error al subir logo' }));
        throw new Error((error as { message?: string }).message ?? 'Error al subir logo');
      }

      const updated = (await res.json()) as Empresa;
      setEmpresa(updated);
      toast.success('Logo actualizado correctamente');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir logo');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Gestión de la información de la empresa"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Logo Card */}
        <Card>
          <CardHeader>
            <CardTitle>Logo de la empresa</CardTitle>
            <CardDescription>Formato PNG, JPG o WEBP. Máximo 2MB.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="relative h-40 w-40 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
              {empresa?.logoUrl ? (
                <Image
                  src={getBackendUrl(empresa.logoUrl)}
                  alt="Logo"
                  width={160}
                  height={160}
                  className="object-contain"
                  unoptimized
                />
              ) : (
                <Image
                  src="/LogoLaCosecha.png"
                  alt="Logo"
                  width={160}
                  height={160}
                  className="object-contain"
                />
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingLogo}
              className="w-full"
            >
              {uploadingLogo ? (
                <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UploadIcon className="h-4 w-4 mr-2" />
              )}
              {uploadingLogo ? 'Subiendo...' : 'Cambiar logo'}
            </Button>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Datos fiscales</CardTitle>
            <CardDescription>Información legal y de contacto</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="razonSocial">Razón Social *</Label>
                <Input
                  id="razonSocial"
                  value={form.razonSocial}
                  onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
                  required
                  maxLength={150}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nombreComercial">Nombre Comercial</Label>
                  <Input
                    id="nombreComercial"
                    value={form.nombreComercial}
                    onChange={(e) => setForm({ ...form, nombreComercial: e.target.value })}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ruc">RUC</Label>
                  <Input
                    id="ruc"
                    value={form.ruc}
                    onChange={(e) => setForm({ ...form, ruc: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                    inputMode="numeric"
                    pattern="[0-9]{11}"
                    maxLength={11}
                    placeholder="20123456789"
                  />
                  {form.ruc && form.ruc.length !== 11 && (
                    <p className="text-xs text-destructive">
                      El RUC debe tener 11 dígitos ({11 - form.ruc.length > 0 ? `faltan ${11 - form.ruc.length}` : `sobran ${form.ruc.length - 11}`})
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="direccion">Dirección fiscal</Label>
                <Input
                  id="direccion"
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                  maxLength={200}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                    inputMode="numeric"
                    pattern="9[0-9]{8}"
                    maxLength={9}
                    placeholder="987654321"
                  />
                  {form.telefono && (form.telefono.length !== 9 || !form.telefono.startsWith('9')) && (
                    <p className="text-xs text-destructive">
                      {!form.telefono.startsWith('9') && form.telefono.length > 0
                        ? 'El teléfono debe empezar con 9'
                        : `El teléfono debe tener 9 dígitos (faltan ${9 - form.telefono.length})`}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="correo">Correo</Label>
                  <Input
                    id="correo"
                    type="email"
                    value={form.correo}
                    onChange={(e) => setForm({ ...form, correo: e.target.value })}
                    maxLength={100}
                    placeholder="contacto@empresa.com"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
