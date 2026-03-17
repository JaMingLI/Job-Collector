import { Outlet } from 'react-router-dom';
import type { MainLayoutViewModel } from './MainLayout.view-model';

export function MainLayoutViewController(_props: MainLayoutViewModel) {
  return (
    <main>
      <Outlet />
    </main>
  );
}
