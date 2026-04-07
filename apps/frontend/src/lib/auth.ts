import { create } from 'zustand';

interface User {
  id: number;
  email: string;
  name: string;
  permissions: string[];
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User, token: string) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,

  setUser: (user, token) => {
    localStorage.setItem('access_token', token);
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('access_token');
    set({ user: null, isAuthenticated: false });
  },

  hasPermission: (permission) => {
    const { user } = get();
    if (!user) return false;
    return user.permissions.includes(permission);
  },
}));
