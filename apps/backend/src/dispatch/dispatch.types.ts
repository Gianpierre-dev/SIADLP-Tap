export interface DeliveryStatusEntry {
  pedidoId: number;
  cliente: { razonSocial: string };
  entrega: {
    id: number;
    estado: string;
    montoCobrado: number | null;
    metodoPago: string | null;
    numeroComprobante: string | null;
    observacion: string | null;
    fechaEntrega: Date | null;
  } | null;
  totalPedido: number;
}

export interface DailyCollectionSummary {
  porChofer: Array<{
    chofer: { nombre: string; apellido: string };
    totalCobrado: number;
    cantidadEntregas: number;
  }>;
  porRuta: Array<{
    ruta: { nombre: string; zona: string };
    totalCobrado: number;
    cantidadEntregas: number;
  }>;
  totalGeneral: number;
  totalEntregas: number;
}

export interface RouteGroup {
  ruta: { id: number; nombre: string; zona: string };
  pedidos: Array<{
    id: number;
    total: number;
    cliente: {
      id: number;
      razonSocial: string;
      direccion: string;
      telefono: string | null;
    };
    detalles: Array<{
      productoId: number;
      cantidad: number;
      precioUnitario: number;
      subtotal: number;
      producto: { id: number; nombre: string };
    }>;
  }>;
  totalKg: number;
  totalMonto: number;
}

export interface Parada {
  orden: number;
  cliente: { razonSocial: string; direccion: string; telefono: string | null };
  pedido: { id: number; total: number };
  productos: Array<{
    nombre: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }>;
  montoACobrar: number;
}

export interface RouteSheetResult {
  hoja: { id: number; fecha: Date; numeroGre: string | null; estado: string };
  ruta: { nombre: string; zona: string };
  vehiculo: { placa: string; marca: string | null; modelo: string | null };
  chofer: {
    nombre: string;
    apellido: string;
    dni: string;
    licencia: string | null;
    telefono: string | null;
  };
  paradas: Parada[];
  totalKg: number;
  totalMonto: number;
}
