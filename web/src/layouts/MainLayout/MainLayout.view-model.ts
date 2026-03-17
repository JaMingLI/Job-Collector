import { useAppStore } from '@/store';

export interface MainLayoutViewModel {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

export function useMainLayoutViewModel(): MainLayoutViewModel {
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  return { isSidebarOpen, toggleSidebar };
}
