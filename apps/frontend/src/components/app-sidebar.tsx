'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth';
import { useEmpresaStore } from '@/lib/empresa';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  LayoutDashboardIcon,
  ShoppingCartIcon,
  PackageIcon,
  TruckIcon,
  UsersIcon,
  ShieldIcon,
  FileTextIcon,
  ClipboardListIcon,
  BuildingIcon,
  MapPinIcon,
  CarIcon,
  UserIcon,
  LogOutIcon,
  SettingsIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

const getBackendUrl = (path: string | null | undefined): string => {
  if (!path) return '/LogoLaCosecha.png';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  const baseUrl = apiUrl.replace(/\/api$/, '');
  return `${baseUrl}${path}`;
};

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  permission?: string;
}

const mainNav: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboardIcon, permission: 'reportes.leer' },
  { label: 'Pedidos', href: '/pedidos', icon: ShoppingCartIcon, permission: 'pedidos.leer' },
  { label: 'Despacho', href: '/despacho', icon: TruckIcon, permission: 'despacho.leer' },
];

const catalogNav: NavItem[] = [
  { label: 'Clientes', href: '/catalogos/clientes', icon: BuildingIcon, permission: 'clientes.leer' },
  { label: 'Productos', href: '/catalogos/productos', icon: PackageIcon, permission: 'productos.leer' },
  { label: 'Rutas', href: '/catalogos/rutas', icon: MapPinIcon, permission: 'rutas.leer' },
  { label: 'Vehículos', href: '/catalogos/vehiculos', icon: CarIcon, permission: 'vehiculos.leer' },
  { label: 'Choferes', href: '/catalogos/choferes', icon: UserIcon, permission: 'choferes.leer' },
];

const adminNav: NavItem[] = [
  { label: 'Usuarios', href: '/usuarios', icon: UsersIcon, permission: 'usuarios.leer' },
  { label: 'Roles', href: '/roles', icon: ShieldIcon, permission: 'roles.leer' },
  { label: 'Reportes', href: '/reportes', icon: FileTextIcon, permission: 'reportes.exportar' },
  { label: 'Auditoría', href: '/auditoria', icon: ClipboardListIcon, permission: 'auditoria.leer' },
  { label: 'Configuración', href: '/configuracion', icon: SettingsIcon, permission: 'usuarios.editar' },
];

function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  const pathname = usePathname();
  const { hasPermission } = useAuthStore();

  const visibleItems = items.filter(
    (item) => !item.permission || hasPermission(item.permission),
  );

  if (visibleItems.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[#c5a028]/80">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {visibleItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                render={<Link href={item.href} />}
                isActive={pathname === item.href}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { user, logout } = useAuthStore();
  const { empresa } = useEmpresaStore();

  const logoSrc = getBackendUrl(empresa?.logoUrl);
  const empresaNombre = empresa?.nombreComercial ?? empresa?.razonSocial ?? 'Empresa';

  return (
    <Sidebar>
      <SidebarHeader className="h-16 border-b border-white/10 px-4 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Image
            src={logoSrc}
            alt={empresaNombre}
            width={56}
            height={56}
            className="rounded-md shrink-0"
            priority
            unoptimized={!!empresa?.logoUrl}
          />
          <span className="text-lg font-bold tracking-tight text-white">{empresaNombre}</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Principal" items={mainNav} />
        <NavGroup label="Catálogos" items={catalogNav} />
        <NavGroup label="Administración" items={adminNav} />
      </SidebarContent>
      <SidebarFooter className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
            style={{ backgroundColor: '#c5a028', color: '#1a3a0e' }}
          >
            {user?.nombre?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-sm font-semibold text-white">{user?.nombre}</span>
            <span className="truncate text-[0.7rem]" style={{ color: '#c5e1a5' }}>
              {user?.correo}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="h-8 w-8 shrink-0 p-0 hover:bg-white/10 hover:text-white"
            style={{ color: '#c5e1a5' }}
          >
            <LogOutIcon className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
