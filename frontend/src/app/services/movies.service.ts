import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MovieListItem } from '../models/movie-list-item.interface';
import { MovieDetail } from '../models/movie-detail.interface';
import { PaginatedResponse } from '../models/paginated-response.interface';
import { Genre } from '../models/genre.interface';
import { API_BASE_URL } from './api-base';

@Injectable({
  providedIn: 'root',
})
export class MoviesService {
  private http = inject(HttpClient);
  private apiUrl = `${API_BASE_URL}/movies/`;
  private genresApiUrl = `${API_BASE_URL}/genres/`;

  getMovies(page = 1, search = '', genreId?: number | null): Observable<PaginatedResponse<MovieListItem>> {
    let params = new HttpParams().set('page', page);

    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    if (genreId) {
      params = params.set('genres', genreId);
    }

    return this.http.get<PaginatedResponse<MovieListItem>>(this.apiUrl, { params });
  }

  getMovieById(id: number): Observable<MovieDetail> {
    return this.http.get<MovieDetail>(`${this.apiUrl}${id}/`);
  }

  getGenres(): Observable<Genre[]> {
    return this.http.get<Genre[]>(this.genresApiUrl);
  }
}
