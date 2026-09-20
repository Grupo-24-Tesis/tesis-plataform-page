import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  ViewTransitionInfo,
  withViewTransitions
} from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';

const navigationOrder: Record<string, number> = {
  monitor: 1,
  'unique-faces': 2,
  reports: 3,
  marked: 4
};

function getRoutePath(route: ActivatedRouteSnapshot): string {
  let currentRoute = route;

  while (currentRoute.firstChild) {
    currentRoute = currentRoute.firstChild;
  }

  return currentRoute.routeConfig?.path ?? '';
}

function setTransitionDirection(info: ViewTransitionInfo): void {
  const fromPath = getRoutePath(info.from);
  const toPath = getRoutePath(info.to);
  const documentElement = document.documentElement;

  let transitionClass = '';

  if (fromPath === 'guards' && toPath !== 'guards') {
    transitionClass = 'guard-exit-transition';
  } else if (fromPath !== 'guards' && toPath === 'guards') {
    transitionClass = 'guard-enter-transition';
  } else {
    const fromPosition = navigationOrder[fromPath];
    const toPosition = navigationOrder[toPath];

    if (fromPosition && toPosition && fromPosition !== toPosition) {
      transitionClass =
        toPosition > fromPosition
          ? 'route-forward-transition'
          : 'route-backward-transition';
    }
  }

  if (!transitionClass) {
    return;
  }

  documentElement.classList.add(transitionClass);

  info.transition.finished.finally(() => {
    documentElement.classList.remove(transitionClass);
  });
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(
      routes,
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: setTransitionDirection
      })
    )
  ]
};
