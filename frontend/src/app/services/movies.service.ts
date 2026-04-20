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

  getMovies(
    page = 1,
    search = '',
    genreIds: number[] = [],
    releaseDecades: string[] = [],
    popularity = 'desc',
    mediaType = 'movie',
  ): Observable<PaginatedResponse<MovieListItem>> {
    let params = new HttpParams().set('page', page);

    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    if (genreIds.length) {
      params = params.set('genres', genreIds.join(','));
    }

    if (releaseDecades.length) {
      params = params.set('release_decade', releaseDecades.join(','));
    }

    if (popularity) {
      params = params.set('popularity', popularity);
    }

    if (mediaType) {
      params = params.set('media_type', mediaType);
    }

    return this.http.get<PaginatedResponse<MovieListItem>>(this.apiUrl, { params });
  }

  getMovieById(id: number, mediaType = 'movie'): Observable<MovieDetail> {
    return this.http.get<MovieDetail>(`${this.apiUrl}${id}/`, {
      params: new HttpParams().set('media_type', mediaType),
    });
  }

  getGenres(mediaType = 'movie'): Observable<Genre[]> {
    return this.http.get<Genre[]>(this.genresApiUrl, {
      params: new HttpParams().set('media_type', mediaType),
    });
  }
}
