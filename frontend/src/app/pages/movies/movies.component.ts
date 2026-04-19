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
  private readonly releaseDecade$ = new BehaviorSubject<string>('');
  private readonly popularity$ = new BehaviorSubject<string>('desc');

  search = '';
  selectedGenreId: number | null = null;
  selectedDecade = '';
  selectedPopularity = 'desc';
  isGenreMenuOpen = false;
  isDecadeMenuOpen = false;
  isPopularityMenuOpen = false;
  readonly decadeOptions = [
    { value: '', label: 'All decades' },
    { value: '2020', label: '2020s' },
    { value: '2010', label: '2010s' },
    { value: '2000', label: '2000s' },
    { value: '1990', label: '1990s' },
    { value: '1980', label: '1980s' },
    { value: '1970', label: '1970s' },
  ];
  readonly popularityOptions = [
    { value: 'desc', label: 'Most popular' },
    { value: 'asc', label: 'Least popular' },
  ];

  readonly genres$ = this.moviesService.getGenres().pipe(
    catchError(() => of([] as Genre[])),
    shareReplay(1),
  );

  readonly viewModel$: Observable<MoviesViewModel> = combineLatest([
    this.page$,
    this.search$.pipe(startWith('')),
    this.genreId$.pipe(startWith(null)),
    this.releaseDecade$.pipe(startWith('')),
    this.popularity$.pipe(startWith('desc')),
    this.genres$,
  ]).pipe(
    switchMap(([page, search, genreId, releaseDecade, popularity, genres]) =>
      this.moviesService.getMovies(page, search, genreId, releaseDecade, popularity).pipe(
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
    this.isGenreMenuOpen = false;
    this.page$.next(1);
    this.genreId$.next(value);
  }

  onDecadeChange(value: string): void {
    this.selectedDecade = value;
    this.isDecadeMenuOpen = false;
    this.page$.next(1);
    this.releaseDecade$.next(value);
  }

  onPopularityChange(value: string): void {
    this.selectedPopularity = value;
    this.isPopularityMenuOpen = false;
    this.page$.next(1);
    this.popularity$.next(value);
  }

  applyFilters(): void {
    this.page$.next(1);
    this.search$.next(this.search.trim());
    this.genreId$.next(this.selectedGenreId);
    this.releaseDecade$.next(this.selectedDecade);
    this.popularity$.next(this.selectedPopularity);
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

  toggleGenreMenu(): void {
    this.isGenreMenuOpen = !this.isGenreMenuOpen;
  }

  toggleDecadeMenu(): void {
    this.isDecadeMenuOpen = !this.isDecadeMenuOpen;
  }

  togglePopularityMenu(): void {
    this.isPopularityMenuOpen = !this.isPopularityMenuOpen;
  }

  getSelectedGenreName(genres: Genre[]): string {
    if (this.selectedGenreId === null) {
      return 'All genres';
    }

    return genres.find((genre) => genre.id === this.selectedGenreId)?.name ?? 'All genres';
  }

  getSelectedDecadeLabel(): string {
    return this.decadeOptions.find((option) => option.value === this.selectedDecade)?.label ?? 'All decades';
  }

  getSelectedPopularityLabel(): string {
    return this.popularityOptions.find((option) => option.value === this.selectedPopularity)?.label ?? 'Most popular';
  }
}
