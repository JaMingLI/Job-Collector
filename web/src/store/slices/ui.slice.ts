import type { StateCreator } from 'zustand';

export interface UiSlice {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const createUiSlice: StateCreator<UiSlice> = (set) => ({
  isSidebarOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
});
