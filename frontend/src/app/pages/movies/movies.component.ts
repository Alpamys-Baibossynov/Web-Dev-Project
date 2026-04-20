import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, combineLatest, of } from 'rxjs';
import { catchError, distinctUntilChanged, map, shareReplay, startWith, switchMap } from 'rxjs/operators';
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
  totalPages: number;
}

@Component({
  selector: 'app-movies',
  imports: [CommonModule, FormsModule, MovieCardComponent, AsyncPipe],
  templateUrl: './movies.component.html',
  styleUrl: './movies.component.css',
})
export class MoviesComponent {
  private static readonly validMediaTypes = ['movie', 'tv', 'anime'] as const;
  private static readonly validPopularityValues = ['desc', 'asc', 'rating_desc', 'rating_asc'] as const;
  private destroyRef = inject(DestroyRef);
  private elementRef = inject(ElementRef<HTMLElement>);
  private moviesService = inject(MoviesService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private readonly initialFilters = this.getInitialFilters();
  private readonly page$ = new BehaviorSubject<number>(this.initialFilters.page);
  private readonly search$ = new BehaviorSubject<string>(this.initialFilters.search);
  private readonly mediaType$ = new BehaviorSubject<string>(this.initialFilters.mediaType);
  private readonly genreIds$ = new BehaviorSubject<number[]>(this.initialFilters.genreIds);
  private readonly releaseDecades$ = new BehaviorSubject<string[]>(this.initialFilters.decades);
  private readonly popularity$ = new BehaviorSubject<string>(this.initialFilters.popularity);

  search = this.initialFilters.search;
  selectedMediaType = this.initialFilters.mediaType;
  selectedGenreIds: number[] = this.initialFilters.genreIds;
  selectedDecades: string[] = this.initialFilters.decades;
  selectedPopularity = this.initialFilters.popularity;
  pageJumpValue = String(this.initialFilters.page);
  isMediaTypeMenuOpen = false;
  isGenreMenuOpen = false;
  isDecadeMenuOpen = false;
  isPopularityMenuOpen = false;
  readonly mediaTypeOptions = [
    { value: 'movie', label: 'Movies' },
    { value: 'tv', label: 'TV shows' },
    { value: 'anime', label: 'Anime' },
  ];
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
    { value: 'rating_desc', label: 'Most rated' },
    { value: 'rating_asc', label: 'Least rated' },
  ];

  readonly genres$ = this.mediaType$.pipe(
    distinctUntilChanged(),
    switchMap((mediaType) =>
      this.moviesService.getGenres(mediaType).pipe(catchError(() => of([] as Genre[]))),
    ),
    shareReplay(1),
  );

  readonly viewModel$: Observable<MoviesViewModel> = combineLatest([
    this.page$,
    this.search$,
    this.mediaType$,
    this.genreIds$,
    this.releaseDecades$,
    this.popularity$,
    this.genres$,
  ]).pipe(
    switchMap(([page, search, mediaType, genreIds, releaseDecades, popularity, genres]) =>
      this.moviesService.getMovies(page, search, genreIds, releaseDecades, popularity, mediaType).pipe(
        map((response: PaginatedResponse<MovieListItem>) => ({
          movies: response.results ?? [],
          genres,
          isLoading: false,
          error: null,
          currentPage: page,
          totalCount: response.count ?? 0,
          totalPages: this.getTotalPages(response.count ?? 0),
        })),
        startWith({
          movies: [] as MovieListItem[],
          genres,
          isLoading: true,
          error: null,
          currentPage: page,
          totalCount: 0,
          totalPages: 0,
        }),
        catchError(() =>
          of({
            movies: [] as MovieListItem[],
            genres,
            isLoading: false,
            error: 'Failed to load movies',
            currentPage: page,
            totalCount: 0,
            totalPages: 0,
          }),
        ),
      ),
    ),
    shareReplay(1),
  );

  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const nextFilters = this.getInitialFilters();
        if (!this.hasSameFilters(nextFilters)) {
          this.applyFiltersFromQuery(nextFilters);
        }
      });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target;

    if (!(target instanceof Node)) {
      return;
    }

    if (!this.elementRef.nativeElement.contains(target)) {
      this.closeAllMenus();
    }
  }

  onSearchChange(value: string): void {
    this.search = value;
  }

  onMediaTypeChange(value: string): void {
    this.selectedMediaType = value;
    this.search = '';
    this.selectedGenreIds = [];
    this.isMediaTypeMenuOpen = false;
    this.search$.next('');
    this.genreIds$.next([]);
    this.mediaType$.next(value);
    this.syncFilters();
  }

  toggleGenre(value: number): void {
    this.selectedGenreIds = this.selectedGenreIds.includes(value)
      ? this.selectedGenreIds.filter((id) => id !== value)
      : [...this.selectedGenreIds, value];
    this.syncFilters();
  }

  clearGenres(): void {
    this.selectedGenreIds = [];
    this.syncFilters();
  }

  toggleDecade(value: string): void {
    this.selectedDecades = this.selectedDecades.includes(value)
      ? this.selectedDecades.filter((decade) => decade !== value)
      : [...this.selectedDecades, value];
    this.syncFilters();
  }

  clearDecades(): void {
    this.selectedDecades = [];
    this.syncFilters();
  }

  onPopularityChange(value: string): void {
    this.selectedPopularity = value;
    this.isPopularityMenuOpen = false;
    this.syncFilters();
  }

  applyFilters(): void {
    this.syncFilters();
  }

  private syncFilters(): void {
    const nextPage = 1;
    this.page$.next(nextPage);
    this.search$.next(this.search.trim());
    this.genreIds$.next([...this.selectedGenreIds]);
    this.releaseDecades$.next([...this.selectedDecades]);
    this.popularity$.next(this.selectedPopularity);
    this.persistFilters(nextPage);
  }

  trackById(index: number, item: MovieListItem): number {
    return item.id;
  }

  goToPage(page: number): void {
    const nextPage = Math.max(1, Math.trunc(page));
    if (nextPage === this.page$.value) {
      this.pageJumpValue = String(nextPage);
      return;
    }
    this.page$.next(nextPage);
    this.pageJumpValue = String(nextPage);
    this.persistFilters(nextPage);
  }

  onPageJumpChange(value: string): void {
    this.pageJumpValue = value;
  }

  jumpToPage(totalPages: number): void {
    const requestedPage = Number(this.pageJumpValue);
    if (!Number.isFinite(requestedPage)) {
      this.pageJumpValue = String(this.page$.value);
      return;
    }

    const nextPage = Math.min(Math.max(1, Math.trunc(requestedPage)), Math.max(totalPages, 1));
    this.goToPage(nextPage);
  }

  hasNextPage(currentPage: number, totalCount: number): boolean {
    return currentPage * 10 < totalCount;
  }

  toggleGenreMenu(): void {
    this.isGenreMenuOpen = !this.isGenreMenuOpen;
    if (this.isGenreMenuOpen) {
      this.isMediaTypeMenuOpen = false;
      this.isDecadeMenuOpen = false;
      this.isPopularityMenuOpen = false;
    }
  }

  toggleMediaTypeMenu(): void {
    this.isMediaTypeMenuOpen = !this.isMediaTypeMenuOpen;
    if (this.isMediaTypeMenuOpen) {
      this.isGenreMenuOpen = false;
      this.isDecadeMenuOpen = false;
      this.isPopularityMenuOpen = false;
    }
  }

  toggleDecadeMenu(): void {
    this.isDecadeMenuOpen = !this.isDecadeMenuOpen;
    if (this.isDecadeMenuOpen) {
      this.isMediaTypeMenuOpen = false;
      this.isGenreMenuOpen = false;
      this.isPopularityMenuOpen = false;
    }
  }

  togglePopularityMenu(): void {
    this.isPopularityMenuOpen = !this.isPopularityMenuOpen;
    if (this.isPopularityMenuOpen) {
      this.isMediaTypeMenuOpen = false;
      this.isGenreMenuOpen = false;
      this.isDecadeMenuOpen = false;
    }
  }

  private closeAllMenus(): void {
    this.isMediaTypeMenuOpen = false;
    this.isGenreMenuOpen = false;
    this.isDecadeMenuOpen = false;
    this.isPopularityMenuOpen = false;
  }

  getSelectedMediaTypeLabel(): string {
    return this.mediaTypeOptions.find((option) => option.value === this.selectedMediaType)?.label ?? 'Movies';
  }

  getSelectedGenreName(genres: Genre[]): string {
    if (!this.selectedGenreIds.length) {
      return 'All genres';
    }

    if (this.selectedGenreIds.length === 1) {
      return genres.find((genre) => genre.id === this.selectedGenreIds[0])?.name ?? 'All genres';
    }

    return `${this.selectedGenreIds.length} genres`;
  }

  getSelectedDecadeLabel(): string {
    if (!this.selectedDecades.length) {
      return 'All decades';
    }

    if (this.selectedDecades.length === 1) {
      return this.decadeOptions.find((option) => option.value === this.selectedDecades[0])?.label ?? 'All decades';
    }

    return `${this.selectedDecades.length} decades`;
  }

  getSelectedPopularityLabel(): string {
    return this.popularityOptions.find((option) => option.value === this.selectedPopularity)?.label ?? 'Most popular';
  }

  isGenreSelected(genreId: number): boolean {
    return this.selectedGenreIds.includes(genreId);
  }

  isDecadeSelected(value: string): boolean {
    return this.selectedDecades.includes(value);
  }

  private getInitialFilters(): {
    page: number;
    search: string;
    mediaType: string;
    genreIds: number[];
    decades: string[];
    popularity: string;
  } {
    const queryParams = this.route.snapshot.queryParamMap;
    const mediaType = queryParams.get('media');
    const popularity = queryParams.get('popularity');
    const pageValue = Number(queryParams.get('page') ?? '1');

    return {
      page: Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1,
      search: '',
      mediaType: MoviesComponent.validMediaTypes.includes((mediaType ?? 'movie') as (typeof MoviesComponent.validMediaTypes)[number])
        ? mediaType ?? 'movie'
        : 'movie',
      genreIds: this.parseNumberList(queryParams.get('genres')),
      decades: this.parseStringList(queryParams.get('decades')),
      popularity: MoviesComponent.validPopularityValues.includes((popularity ?? 'desc') as (typeof MoviesComponent.validPopularityValues)[number])
        ? popularity ?? 'desc'
        : 'desc',
    };
  }

  private applyFiltersFromQuery(filters: {
    page: number;
    search: string;
    mediaType: string;
    genreIds: number[];
    decades: string[];
    popularity: string;
  }): void {
    this.search = filters.search;
    this.selectedMediaType = filters.mediaType;
    this.selectedGenreIds = filters.genreIds;
    this.selectedDecades = filters.decades;
    this.selectedPopularity = filters.popularity;
    this.pageJumpValue = String(filters.page);

    this.page$.next(filters.page);
    this.search$.next(filters.search);
    this.mediaType$.next(filters.mediaType);
    this.genreIds$.next([...filters.genreIds]);
    this.releaseDecades$.next([...filters.decades]);
    this.popularity$.next(filters.popularity);
  }

  private hasSameFilters(filters: {
    page: number;
    search: string;
    mediaType: string;
    genreIds: number[];
    decades: string[];
    popularity: string;
  }): boolean {
    return (
      this.page$.value === filters.page &&
      this.search$.value === filters.search &&
      this.mediaType$.value === filters.mediaType &&
      this.popularity$.value === filters.popularity &&
      this.listEquals(this.genreIds$.value, filters.genreIds) &&
      this.listEquals(this.releaseDecades$.value, filters.decades)
    );
  }

  private persistFilters(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        media: this.selectedMediaType === 'movie' ? null : this.selectedMediaType,
        genres: this.selectedGenreIds.length ? this.selectedGenreIds.join(',') : null,
        decades: this.selectedDecades.length ? this.selectedDecades.join(',') : null,
        popularity: this.selectedPopularity === 'desc' ? null : this.selectedPopularity,
        page: page > 1 ? page : null,
      },
      replaceUrl: true,
    });
  }

  private parseNumberList(value: string | null): number[] {
    if (!value) {
      return [];
    }

    return value
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item) && item > 0);
  }

  private parseStringList(value: string | null): string[] {
    if (!value) {
      return [];
    }

    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private getTotalPages(totalCount: number): number {
    return totalCount > 0 ? Math.ceil(totalCount / 10) : 0;
  }

  private listEquals<T>(left: T[], right: T[]): boolean {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }
}
