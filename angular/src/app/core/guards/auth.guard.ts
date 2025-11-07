import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

function ensureAuthenticated(): boolean | UrlTree {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated ? true : router.parseUrl('/login');
}

export const authGuard: CanActivateFn = () => ensureAuthenticated();

export const authMatchGuard: CanMatchFn = () => ensureAuthenticated();

export const loginGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated ? router.parseUrl('/dashboard') : true;
};
