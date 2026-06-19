'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HomeIcon, SearchXIcon } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center items-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#fef3c7] text-[#d97706]">
            <SearchXIcon className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl">Página no encontrada</CardTitle>
          <CardDescription>
            La ruta que intentaste abrir no existe en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-center">
          <p className="text-sm text-muted-foreground">
            Si llegaste aquí desde un enlace antiguo o copiaste mal una URL,
            volvé al inicio y navegá desde el menú.
          </p>
          <Button asChild className="mt-2">
            <Link href="/">
              <HomeIcon className="mr-2 h-4 w-4" />
              Volver al inicio
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
