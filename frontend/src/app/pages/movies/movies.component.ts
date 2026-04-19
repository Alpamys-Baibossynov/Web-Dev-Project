import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, Observable, combineLatest, of } from 'rxjs';
import { catchError, map, shareReplay, startWith, switchMap } from 'rxjs/operators';
import { MovieCardComponent } from '../../layout/movie-card/movie-card.component';
import { MoviesService } from '../../services/movies.service';
import { MovieListItem } from '../../models/movie-list-item.interface';
import { PaginatedResponse } from '../../models/paginated-response.interface';
import { Genre } from '../../models/genre.interface';

interface MoviesViewModel {
  movies: MovieListItem[];
  genres: Genre[];
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  totalCount: number;
}

@Component({
  selector: 'app-movies',
  imports: [CommonModule, FormsModule, MovieCardComponent, AsyncPipe],
  templateUrl: './movies.component.html',
  styleUrl: './movies.component.css',
})
export class MoviesComponent {
  private moviesService = inject(MoviesService);
  private readonly page$ = new BehaviorSubject<number>(1);
  private readonly search$ = new BehaviorSubject<string>('');
  private readonly genreId$ = new BehaviorSubject<number | null>(null);

  search = '';
  selectedGenreId: number | null = null;

  readonly genres$ = this.moviesService.getGenres().pipe(
    catchError(() => of([] as Genre[])),
    shareReplay(1),
  );

  readonly viewModel$: Observable<MoviesViewModel> = combineLatest([
    this.page$,
    this.search$.pipe(startWith('')),
    this.genreId$.pipe(startWith(null)),
    this.genres$,
  ]).pipe(
    switchMap(([page, search, genreId, genres]) =>
      this.moviesService.getMovies(page, search, genreId).pipe(
        map((response: PaginatedResponse<MovieListItem>) => ({
          movies: response.results ?? [],
          genres,
          isLoading: false,
          error: null,
          currentPage: page,
          totalCount: response.count ?? 0,
        })),
        startWith({
          movies: [] as MovieListItem[],
          genres,
          isLoading: true,
          error: null,
          currentPage: page,
          totalCount: 0,
        }),
        catchError(() =>
          of({
            movies: [] as MovieListItem[],
            genres,
            isLoading: false,
            error: 'Failed to load movies',
            currentPage: page,
            totalCount: 0,
          }),
        ),
      ),
    ),
    shareReplay(1),
  );

  onSearchChange(value: string): void {
    this.search = value;
  }

  onGenreChange(value: number | null): void {
    this.selectedGenreId = value;
    this.page$.next(1);
    this.genreId$.next(value);
  }

  applyFilters(): void {
    this.page$.next(1);
    this.search$.next(this.search.trim());
    this.genreId$.next(this.selectedGenreId);
  }

  trackById(index: number, item: MovieListItem): number {
    return item.id;
  }

  goToPage(page: number): void {
    if (page < 1) {
      return;
    }
    this.page$.next(page);
  }

  hasNextPage(currentPage: number, totalCount: number): boolean {
    return currentPage * 10 < totalCount;
  }
}
