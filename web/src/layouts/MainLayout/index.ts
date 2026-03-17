import { bind } from '@/utils/bind';
import { MainLayoutViewController } from './MainLayout.view-controller';
import { useMainLayoutViewModel } from './MainLayout.view-model';

export const MainLayout = bind(MainLayoutViewController, useMainLayoutViewModel);
