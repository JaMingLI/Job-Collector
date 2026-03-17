import { createBrowserRouter } from 'react-router-dom';
import { MainLayout } from '@/layouts';
import { Home } from '@/pages';
import { PATHS } from './paths';

export const router = createBrowserRouter([
  {
    path: PATHS.HOME,
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
    ],
  },
]);
