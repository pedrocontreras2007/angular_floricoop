import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

interface AuthState {
  readonly isAuthenticated: boolean;
  readonly email: string | null;
}

const DEMO_EMAIL = 'innovacode1857@gmail.com';
const DEMO_PASSWORD = 'innovacode';
const STORAGE_KEY = 'cooperativa-auth-state';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly stateSubject = new BehaviorSubject<AuthState>(this.restoreSession());

  readonly state$ = this.stateSubject.asObservable();

  get isAuthenticated(): boolean {
    return this.stateSubject.value.isAuthenticated;
  }

  get email(): string | null {
    return this.stateSubject.value.email;
  }

  async login(email: string, password: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 750));

    const success = email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD;

    if (success) {
      this.updateState(true, DEMO_EMAIL);
    } else {
      this.updateState(false, null);
    }

    return success;
  }

  logout(): void {
    this.updateState(false, null);
  }

  private updateState(isAuthenticated: boolean, email: string | null): void {
    const nextState: AuthState = { isAuthenticated, email };
    this.stateSubject.next(nextState);
    this.persistSession(nextState);
  }

  private restoreSession(): AuthState {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return { isAuthenticated: false, email: null };
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { isAuthenticated: false, email: null };
      }
      const parsed = JSON.parse(raw) as AuthState;
      if (parsed && typeof parsed.isAuthenticated === 'boolean') {
        return parsed;
      }
      return { isAuthenticated: false, email: null };
    } catch {
      return { isAuthenticated: false, email: null };
    }
  }

  private persistSession(state: AuthState): void {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return;
    }

    if (state.isAuthenticated) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }
}
