'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

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
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
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

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 h-14 flex items-center">
        <div className="flex items-center gap-3">
          <Image
            src="/LogoLaCosecha.png"
            alt="La Cosecha"
            width={36}
            height={36}
            className="rounded-md"
          />
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-sidebar-primary-foreground">La Cosecha</span>
            <span className="text-xs text-[#c5a028]">SIADLP</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Principal" items={mainNav} />
        <NavGroup label="Catálogos" items={catalogNav} />
        <NavGroup label="Administración" items={adminNav} />
      </SidebarContent>
      <SidebarFooter className="border-t p-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col text-sm">
            <span className="font-medium truncate max-w-[140px]">{user?.nombre}</span>
            <span className="text-xs text-muted-foreground truncate max-w-[140px]">{user?.correo}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">
            <LogOutIcon className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
