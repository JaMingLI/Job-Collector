import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { MainLayoutViewModel } from './MainLayout.view-model';

export function MainLayoutViewController(_props: MainLayoutViewModel) {
  const { t } = useTranslation();

  return (
    <div>
      <header>
        <h1>{t('app.title')}</h1>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
