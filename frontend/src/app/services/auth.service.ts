import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';

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

interface StoredUser extends User {
  password?: string;
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
  private readonly followsKey = 'watchlist.follows';

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
        const mergedUser = this.mergeStoredUserData(user);
        this.currentUser.set(mergedUser);
        this.isAuthenticated.set(true);
        localStorage.setItem(this.currentUserKey, JSON.stringify(mergedUser));
        this.persistKnownUser(mergedUser);
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

  updateProfileDetails(payload: { username: string; email: string }): Observable<User> {
    const currentUser = this.currentUser();
    if (!currentUser) {
      return throwError(() => new Error('You need to be logged in.'));
    }

    return this.http.patch<User>(`${this.apiUrl}/me/`, payload).pipe(
      map((user) => this.persistCurrentUser(this.mergeStoredUserData(user))),
      catchError(() => {
        const normalizedUser: User = {
          ...currentUser,
          username: payload.username.trim() || currentUser.username,
          email: payload.email.trim() || currentUser.email,
        };
        return of(this.persistCurrentUser(normalizedUser));
      }),
    );
  }

  updateProfilePicture(profilePictureUrl: string): Observable<User> {
    const currentUser = this.currentUser();
    if (!currentUser) {
      return throwError(() => new Error('You need to be logged in.'));
    }

    return this.http.patch<User>(`${this.apiUrl}/me/`, { profile_picture_url: profilePictureUrl.trim() }).pipe(
      map((user) => this.persistCurrentUser(this.mergeStoredUserData(user))),
      catchError(() => {
        const normalizedUser: User = {
          ...currentUser,
          profile_picture_url: profilePictureUrl.trim() || undefined,
        };
        return of(this.persistCurrentUser(normalizedUser));
      }),
    );
  }

  changePassword(payload: { currentPassword: string; newPassword: string }): Observable<{ success: boolean; error?: string }> {
    const currentUser = this.currentUser();
    if (!currentUser) {
      return of({ success: false, error: 'You need to be logged in.' });
    }

    return this.http.post<AuthResponse>(`${this.apiUrl}/change-password/`, payload).pipe(
      tap((response) => this.applyAuth(response)),
      map(() => ({ success: true })),
      catchError(() => of(this.changePasswordLocal(currentUser.id, payload))),
    );
  }

  getPublicUser(username: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/${encodeURIComponent(username)}/`).pipe(
      map((user) => this.mergeStoredUserData(user)),
      catchError(() => {
        const localUser = this.getStoredUsers().find((candidate) => candidate.username === username);
        if (!localUser) {
          return throwError(() => new Error('User not found.'));
        }
        const isOwnProfile = this.currentUser()?.id === localUser.id;
        return of({
          ...localUser,
          email: isOwnProfile ? localUser.email : '',
          followers_count: this.getFollowerCount(localUser.id),
          following_count: this.getFollowingCount(localUser.id),
          is_following: this.isUserFollowed(localUser.id),
          is_friend: this.isUserFriend(localUser.id),
        });
      }),
    );
  }

  searchUsers(search: string): Observable<User[]> {
    const trimmedSearch = search.trim();
    if (!trimmedSearch) {
      return of([]);
    }

    return this.http.get<User[]>(`${this.apiUrl}/users/`, { params: { search: trimmedSearch } }).pipe(
      map((users) => users.map((user) => this.mergeStoredUserData(user))),
      catchError(() => {
        const normalizedSearch = trimmedSearch.toLowerCase();
        return of(
          this.getStoredUsers()
            .filter((user) => user.username.toLowerCase().includes(normalizedSearch))
            .slice(0, 20)
            .map((user) => ({
              ...user,
              email: this.currentUser()?.id === user.id ? user.email : '',
              followers_count: this.getFollowerCount(user.id),
              following_count: this.getFollowingCount(user.id),
              is_following: this.isUserFollowed(user.id),
              is_friend: this.isUserFriend(user.id),
            })),
        );
      }),
    );
  }

  followUser(username: string): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/users/${encodeURIComponent(username)}/follow/`, {}).pipe(
      map((user) => this.mergeStoredUserData(user)),
      catchError(() => {
        const targetUser = this.getStoredUsers().find((candidate) => candidate.username === username);
        const currentUser = this.currentUser();
        if (!targetUser || !currentUser) {
          return throwError(() => new Error('Could not follow this user.'));
        }
        this.setLocalFollowState(currentUser.id, targetUser.id, true);
        return of({
          ...targetUser,
          followers_count: this.getFollowerCount(targetUser.id),
          following_count: this.getFollowingCount(targetUser.id),
          is_following: true,
          is_friend: this.isUserFriend(targetUser.id),
        });
      }),
    );
  }

  unfollowUser(username: string): Observable<User> {
    return this.http.delete<User>(`${this.apiUrl}/users/${encodeURIComponent(username)}/follow/`).pipe(
      map((user) => this.mergeStoredUserData(user)),
      catchError(() => {
        const targetUser = this.getStoredUsers().find((candidate) => candidate.username === username);
        const currentUser = this.currentUser();
        if (!targetUser || !currentUser) {
          return throwError(() => new Error('Could not unfollow this user.'));
        }
        this.setLocalFollowState(currentUser.id, targetUser.id, false);
        return of({
          ...targetUser,
          followers_count: this.getFollowerCount(targetUser.id),
          following_count: this.getFollowingCount(targetUser.id),
          is_following: false,
          is_friend: this.isUserFriend(targetUser.id),
        });
      }),
    );
  }

  private applyAuth(response: AuthResponse): void {
    const mergedUser = this.mergeStoredUserData(response.user);
    localStorage.setItem(this.tokenKey, response.token);
    localStorage.setItem(this.currentUserKey, JSON.stringify(mergedUser));
    this.persistKnownUser(mergedUser);
    this.currentUser.set(mergedUser);
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
      } satisfies StoredUser;

    if (existingUser.password && existingUser.password !== payload.password) {
      throw new Error('Invalid password');
    }

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

    const newUser: StoredUser = {
      id: users.length + 1,
      username: payload.username,
      email: payload.email,
      password: payload.password,
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
    return rawValue ? this.normalizeUser(JSON.parse(rawValue) as User) : null;
  }

  private getStoredUsers(): StoredUser[] {
    const rawValue = localStorage.getItem(this.usersKey);
    return rawValue ? (JSON.parse(rawValue) as StoredUser[]).map((user) => this.normalizeStoredUser(user)) : [];
  }

  private normalizeUser(user: User): User {
    return {
      ...user,
      profile_picture_url: user.profile_picture_url?.trim() || undefined,
      followers_count: user.followers_count ?? 0,
      following_count: user.following_count ?? 0,
      is_following: user.is_following ?? false,
      is_friend: user.is_friend ?? false,
    };
  }

  private normalizeStoredUser(user: StoredUser): StoredUser {
    return {
      ...this.normalizeUser(user),
      password: user.password,
    };
  }

  private persistCurrentUser(user: User): User {
    this.currentUser.set(user);
    localStorage.setItem(this.currentUserKey, JSON.stringify(user));
    this.persistKnownUser(user);
    return user;
  }

  private changePasswordLocal(
    userId: number,
    payload: { currentPassword: string; newPassword: string },
  ): { success: boolean; error?: string } {
    const users = this.getStoredUsers();
    const userIndex = users.findIndex((user) => user.id === userId);
    if (userIndex < 0) {
      return { success: false, error: 'Could not update password right now.' };
    }

    const storedUser = users[userIndex];
    if (storedUser.password && storedUser.password !== payload.currentPassword) {
      return { success: false, error: 'Current password is incorrect.' };
    }

    users[userIndex] = {
      ...storedUser,
      password: payload.newPassword,
    };
    localStorage.setItem(this.usersKey, JSON.stringify(users));
    return { success: true };
  }

  private mergeStoredUserData(user: User): User {
    const normalizedUser = this.normalizeUser(user);
    const storedUser = this.getStoredUsers().find(
      (candidate) => candidate.id === normalizedUser.id || candidate.username === normalizedUser.username,
    );

    if (!storedUser) {
      return normalizedUser;
    }

    return {
      ...normalizedUser,
      profile_picture_url: normalizedUser.profile_picture_url ?? storedUser.profile_picture_url,
    };
  }

  private getStoredFollows(): Array<{ followerId: number; followingId: number }> {
    const rawValue = localStorage.getItem(this.followsKey);
    return rawValue ? JSON.parse(rawValue) as Array<{ followerId: number; followingId: number }> : [];
  }

  private setLocalFollowState(followerId: number, followingId: number, shouldFollow: boolean): void {
    const follows = this.getStoredFollows().filter(
      (follow) => !(follow.followerId === followerId && follow.followingId === followingId),
    );
    if (shouldFollow) {
      follows.push({ followerId, followingId });
    }
    localStorage.setItem(this.followsKey, JSON.stringify(follows));
  }

  private getFollowerCount(userId: number): number {
    return this.getStoredFollows().filter((follow) => follow.followingId === userId).length;
  }

  private getFollowingCount(userId: number): number {
    return this.getStoredFollows().filter((follow) => follow.followerId === userId).length;
  }

  private isUserFollowed(userId: number): boolean {
    const currentUser = this.currentUser();
    if (!currentUser) {
      return false;
    }
    return this.getStoredFollows().some(
      (follow) => follow.followerId === currentUser.id && follow.followingId === userId,
    );
  }

  private isUserFriend(userId: number): boolean {
    const currentUser = this.currentUser();
    if (!currentUser) {
      return false;
    }
    const follows = this.getStoredFollows();
    return (
      follows.some((follow) => follow.followerId === currentUser.id && follow.followingId === userId)
      && follows.some((follow) => follow.followerId === userId && follow.followingId === currentUser.id)
    );
  }

  private persistKnownUser(user: User): void {
    const users = this.getStoredUsers();
    const userIndex = users.findIndex(
      (storedUser) => storedUser.id === user.id || storedUser.username === user.username,
    );

    if (userIndex >= 0) {
      users[userIndex] = {
        ...users[userIndex],
        username: user.username,
        email: user.email,
        profile_picture_url: user.profile_picture_url,
        followers_count: user.followers_count,
        following_count: user.following_count,
        is_following: user.is_following,
        is_friend: user.is_friend,
      };
    } else {
      users.push(this.normalizeStoredUser(user));
    }

    localStorage.setItem(this.usersKey, JSON.stringify(users));
  }
}
