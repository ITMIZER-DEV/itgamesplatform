'use client';

import { Toaster } from 'sonner';
import { useTheme } from './ThemeToggle';

// Avisos (toasts) acompanham o tema claro/escuro escolhido.
export function ThemedToaster() {
  const theme = useTheme();
  return <Toaster position="top-right" theme={theme} closeButton />;
}
