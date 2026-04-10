import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { AuthGuard } from '@/components/auth-guard';
import { Separator } from '@/components/ui/separator';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-6">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="-ml-1 text-muted-foreground" />
              <Separator orientation="vertical" className="h-4" />
              <span className="text-sm font-semibold text-[#33691e]">
                Sistema de Distribución
              </span>
            </div>
          </header>
          <main className="flex-1 p-6 @container">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  );
}
