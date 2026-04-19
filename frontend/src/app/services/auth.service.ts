import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, of, tap } from 'rxjs';

import { AuthResponse } from '../models/auth-response.interface';
import { User } from '../models/user.interface';
import { API_BASE_URL } from './api-base';


interface LoginPayload {
  username: string;
  password: string;
}

interface RegisterPayload extends LoginPayload {
  email: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = `${API_BASE_URL}/auth`;
  private readonly tokenKey = 'watchlist.token';
  private readonly currentUserKey = 'watchlist.currentUser';
  private readonly usersKey = 'watchlist.users';

  readonly currentUser = signal<User | null>(null);
  readonly isAuthenticated = signal<boolean>(this.hasToken());

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login/`, payload).pipe(
      tap((response) => this.applyAuth(response)),
      catchError(() => {
        const response = this.loginLocal(payload);
        this.applyAuth(response);
        return of(response);
      }),
    );
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register/`, payload).pipe(
      tap((response) => this.applyAuth(response)),
      catchError(() => {
        const response = this.registerLocal(payload);
        this.applyAuth(response);
        return of(response);
      }),
    );
  }

  fetchCurrentUser(): Observable<User | null> {
    if (!this.getAccessToken()) {
      this.clearAuth();
      return of(null);
    }

    return this.http.get<User>(`${this.apiUrl}/me/`).pipe(
      tap((user) => {
        this.currentUser.set(user);
        this.isAuthenticated.set(true);
        localStorage.setItem(this.currentUserKey, JSON.stringify(user));
      }),
      catchError(() => {
        const localUser = this.getStoredCurrentUser();
        if (localUser) {
          this.currentUser.set(localUser);
          this.isAuthenticated.set(true);
          return of(localUser);
        }
        this.clearAuth();
        return of(null);
      }),
    );
  }

  initializeAuth(): void {
    if (!this.getAccessToken()) {
      this.clearAuth();
      return;
    }

    this.fetchCurrentUser().subscribe();
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  logout(): void {
    const hasToken = !!this.getAccessToken();
    if (!hasToken) {
      this.clearAuth();
      return;
    }

    this.http.post(`${this.apiUrl}/logout/`, {}).subscribe({
      next: () => this.clearAuth(),
      error: () => this.clearAuth(),
    });
  }

  private applyAuth(response: AuthResponse): void {
    localStorage.setItem(this.tokenKey, response.token);
    localStorage.setItem(this.currentUserKey, JSON.stringify(response.user));
    this.currentUser.set(response.user);
    this.isAuthenticated.set(true);
  }

  private clearAuth(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.currentUserKey);
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
  }

  private hasToken(): boolean {
    return typeof localStorage !== 'undefined' && !!localStorage.getItem(this.tokenKey);
  }

  private loginLocal(payload: LoginPayload): AuthResponse {
    const users = this.getStoredUsers();
    const existingUser =
      users.find((user) => user.username === payload.username) ??
      {
        id: users.length + 1,
        username: payload.username,
        email: `${payload.username}@watchlist.local`,
      };

    if (!users.some((user) => user.username === existingUser.username)) {
      users.push(existingUser);
      localStorage.setItem(this.usersKey, JSON.stringify(users));
    }

    return {
      token: `demo-token-${existingUser.id}`,
      user: existingUser,
    };
  }

  private registerLocal(payload: RegisterPayload): AuthResponse {
    const users = this.getStoredUsers();
    const existingUser = users.find((user) => user.username === payload.username);
    if (existingUser) {
      return {
        token: `demo-token-${existingUser.id}`,
        user: existingUser,
      };
    }

    const newUser: User = {
      id: users.length + 1,
      username: payload.username,
      email: payload.email,
    };
    users.push(newUser);
    localStorage.setItem(this.usersKey, JSON.stringify(users));

    return {
      token: `demo-token-${newUser.id}`,
      user: newUser,
    };
  }

  private getStoredCurrentUser(): User | null {
    const rawValue = localStorage.getItem(this.currentUserKey);
    return rawValue ? (JSON.parse(rawValue) as User) : null;
  }

  private getStoredUsers(): User[] {
    const rawValue = localStorage.getItem(this.usersKey);
    return rawValue ? (JSON.parse(rawValue) as User[]) : [];
  }
}
