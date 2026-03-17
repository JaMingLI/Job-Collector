import { create } from 'zustand';
import { createUiSlice, type UiSlice } from './slices/ui.slice';

type StoreState = UiSlice;

export const useAppStore = create<StoreState>()((...a) => ({
  ...createUiSlice(...a),
}));
