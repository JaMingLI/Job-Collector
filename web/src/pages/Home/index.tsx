import { bind } from '@/utils/bind';
import { HomeViewController } from './Home.view-controller';
import { useHomeViewModel } from './Home.view-model';

export const Home = bind(HomeViewController, useHomeViewModel);
