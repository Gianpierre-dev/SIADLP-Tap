'use client';

import { create } from 'zustand';
import { apiGet } from './api';

export interface Empresa {
  id: number;
  razonSocial: string;
  nombreComercial: string | null;
  ruc: string | null;
  direccion: string | null;
  telefono: string | null;
  correo: string | null;
  logoUrl: string | null;
}

interface EmpresaState {
  empresa: Empresa | null;
  loading: boolean;
  fetchEmpresa: () => Promise<void>;
  setEmpresa: (empresa: Empresa) => void;
}

export const useEmpresaStore = create<EmpresaState>((set) => ({
  empresa: null,
  loading: false,

  fetchEmpresa: async () => {
    set({ loading: true });
    try {
      const data = await apiGet<Empresa>('/empresa');
      set({ empresa: data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setEmpresa: (empresa) => set({ empresa }),
}));
