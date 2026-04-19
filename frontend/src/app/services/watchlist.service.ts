import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';

import { MovieDetail } from '../models/movie-detail.interface';
import { PaginatedResponse } from '../models/paginated-response.interface';
import { UserMovie, UserMovieMood, UserMovieStatus } from '../models/user-movie.interface';
import { AuthService } from './auth.service';
import { API_BASE_URL } from './api-base';


interface SaveUserMoviePayload {
  movie_id: number;
  status: UserMovieStatus;
  mood?: UserMovieMood | '';
  rating?: number | null;
  review?: string;
}

interface UpdateUserMoviePayload {
  status?: UserMovieStatus;
  mood?: UserMovieMood | '';
  rating?: number | null;
  review?: string;
}

@Injectable({
  providedIn: 'root',
})
export class WatchlistService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = `${API_BASE_URL}/watchlist/`;
  private readonly storageKey = 'watchlist.library';

  getLibrary(status?: UserMovieStatus): Observable<PaginatedResponse<UserMovie>> {
    return of(this.getLocalLibrary(status));
  }

  getUserMovieForMovie(movieId: number): Observable<UserMovie | null> {
    return of(this.getLocalLibraryItemByMovieId(movieId));
  }

  addToLibrary(payload: SaveUserMoviePayload, movieSnapshot?: MovieDetail): Observable<UserMovie> {
    const userMovie = this.addLocalToLibrary(payload, movieSnapshot);

    this.http.post<UserMovie>(this.apiUrl, payload).subscribe({
      next: (savedUserMovie) => this.upsertLocalLibraryItem(savedUserMovie),
    });

    return of(userMovie);
  }

  updateUserMovie(id: number, payload: UpdateUserMoviePayload): Observable<UserMovie> {
    const userMovie = this.updateLocalUserMovie(id, payload);

    this.http.patch<UserMovie>(`${this.apiUrl}${id}/`, payload).subscribe({
      next: (savedUserMovie) => this.upsertLocalLibraryItem(savedUserMovie),
    });

    return of(userMovie);
  }

  deleteUserMovie(id: number): Observable<void> {
    this.removeLocalLibraryItem(id);

    this.http.delete<void>(`${this.apiUrl}${id}/`).subscribe({
      next: () => undefined,
    });

    return of(void 0);
  }

  private getLocalLibrary(status?: UserMovieStatus): PaginatedResponse<UserMovie> {
    const items = this.readLocalLibrary().filter((item) => !status || item.status === status);
    return {
      count: items.length,
      next: null,
      previous: null,
      results: items,
    };
  }

  private getLocalLibraryItemByMovieId(movieId: number): UserMovie | null {
    return this.readLocalLibrary().find((item) => item.movie.id === movieId) ?? null;
  }

  private addLocalToLibrary(payload: SaveUserMoviePayload, movieSnapshot?: MovieDetail): UserMovie {
    const library = this.readLocalLibrary();
    const existingItem = library.find((item) => item.movie.id === payload.movie_id);
    if (existingItem) {
      return this.updateLocalUserMovie(existingItem.id, payload);
    }

    const movie = movieSnapshot ?? {
      id: payload.movie_id,
      title: `Movie #${payload.movie_id}`,
      original_title: '',
      description: '',
      release_year: new Date().getFullYear(),
      duration_minutes: 0,
      poster_url: '',
      background_url: '',
      country: '',
      age_rating: '',
      genres: [],
      created_at: '',
      updated_at: '',
    };
    const now = new Date().toISOString();
    const userMovie: UserMovie = {
      id: library.length ? Math.max(...library.map((item) => item.id)) + 1 : 1,
      movie: {
        id: movie.id,
        title: movie.title,
        release_year: movie.release_year,
        poster_url: movie.poster_url,
        genres: movie.genres,
      },
      status: payload.status,
      mood: payload.mood ?? '',
      rating: payload.rating ?? null,
      review: payload.review ?? '',
      watched_at: payload.status === 'watched' ? now : null,
      created_at: now,
      updated_at: now,
    };
    library.unshift(userMovie);
    this.writeLocalLibrary(library);
    return userMovie;
  }

  private updateLocalUserMovie(id: number, payload: UpdateUserMoviePayload | SaveUserMoviePayload): UserMovie {
    const library = this.readLocalLibrary();
    const itemIndex = library.findIndex((item) => item.id === id);
    if (itemIndex < 0) {
      throw new Error('Library item not found');
    }

    const currentItem = library[itemIndex];
    const updatedItem: UserMovie = {
      ...currentItem,
      status: payload.status ?? currentItem.status,
      mood: payload.mood ?? currentItem.mood,
      rating: payload.rating ?? currentItem.rating,
      review: payload.review ?? currentItem.review,
      watched_at: (payload.status ?? currentItem.status) === 'watched'
        ? currentItem.watched_at ?? new Date().toISOString()
        : null,
      updated_at: new Date().toISOString(),
    };

    if (itemIndex >= 0) {
      library[itemIndex] = updatedItem;
      this.writeLocalLibrary(library);
    }

    return updatedItem;
  }

  private readLocalLibrary(): UserMovie[] {
    const rawValue = localStorage.getItem(this.getLibraryStorageKey());
    return rawValue ? (JSON.parse(rawValue) as UserMovie[]) : [];
  }

  private writeLocalLibrary(items: UserMovie[]): void {
    localStorage.setItem(this.getLibraryStorageKey(), JSON.stringify(items));
  }

  private upsertLocalLibraryItem(userMovie: UserMovie): void {
    const library = this.readLocalLibrary();
    const itemIndex = library.findIndex((item) => item.id === userMovie.id || item.movie.id === userMovie.movie.id);

    if (itemIndex >= 0) {
      library[itemIndex] = userMovie;
    } else {
      library.unshift(userMovie);
    }

    this.writeLocalLibrary(library);
  }

  private removeLocalLibraryItem(id: number): void {
    const library = this.readLocalLibrary().filter((item) => item.id !== id);
    this.writeLocalLibrary(library);
  }

  private getLibraryStorageKey(): string {
    const currentUser = this.authService.currentUser();
    if (currentUser) {
      return `${this.storageKey}.${currentUser.id}`;
    }

    const storedUser = localStorage.getItem('watchlist.currentUser');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as { id?: number };
        if (parsedUser.id) {
          return `${this.storageKey}.${parsedUser.id}`;
        }
      } catch {}
    }

    const token = this.authService.getAccessToken();
    if (token) {
      return `${this.storageKey}.${token}`;
    }

    return `${this.storageKey}.guest`;
  }
}
