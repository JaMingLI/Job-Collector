import { type ComponentType } from 'react';

/**
 * MVVM Binder HOC — connects a ViewController (pure UI) to a ViewModel (hook).
 * The ViewModel hook returns props that are passed to the ViewController.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function bind<TProps extends Record<string, any>>(
  ViewController: ComponentType<TProps>,
  useViewModel: () => TProps,
): ComponentType {
  const BoundComponent = () => {
    const viewModel = useViewModel();
    return <ViewController {...viewModel} />;
  };

  BoundComponent.displayName = `Bound(${ViewController.displayName ?? ViewController.name ?? 'Component'})`;

  return BoundComponent;
}
