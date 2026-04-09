export interface DeliveryStatusEntry {
  pedidoId: number;
  cliente: { razonSocial: string };
  entrega: {
    id: number;
    estado: string;
    observacion: string | null;
    fechaEntrega: Date | null;
  } | null;
}

export interface RouteGroup {
  ruta: { id: number; nombre: string; zona: string };
  pedidos: Array<{
    id: number;
    cliente: {
      id: number;
      razonSocial: string;
      direccion: string;
      telefono: string | null;
    };
    detalles: Array<{
      productoId: number;
      cantidad: number;
      producto: { id: number; nombre: string };
    }>;
  }>;
  totalKg: number;
}

export interface Parada {
  orden: number;
  cliente: { razonSocial: string; direccion: string; telefono: string | null };
  pedido: { id: number };
  productos: Array<{
    nombre: string;
    cantidad: number;
  }>;
}

export interface RouteSheetResult {
  hoja: { id: number; fecha: Date; estado: string };
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
}
