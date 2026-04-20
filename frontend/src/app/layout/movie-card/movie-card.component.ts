import { ChangeDetectionStrategy, Component, ElementRef, HostListener, Input, OnChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MovieListItem } from '../../models/movie-list-item.interface';
import { AuthService } from '../../services/auth.service';
import { WatchlistService } from '../../services/watchlist.service';
import { UserMovie, UserMovieMood, UserMovieStatus } from '../../models/user-movie.interface';
import { MovieDetail } from '../../models/movie-detail.interface';

@Component({
  selector: 'app-movie-card',
  imports: [RouterModule, CommonModule],
  templateUrl: './movie-card.component.html',
  styleUrl: './movie-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovieCardComponent implements OnChanges {
  private static readonly posterFallbackUrl = 'https://via.placeholder.com/300x450?text=No+Image';
  private elementRef = inject(ElementRef<HTMLElement>);
  private watchlistService = inject(WatchlistService);
  readonly authService = inject(AuthService);

  readonly menuOpen = signal(false);
  readonly userMovie = signal<UserMovie | null>(null);
  readonly isSubmitting = signal(false);
  readonly statusOptions = [
    { value: 'planned', label: 'Planned' },
    { value: 'currently_watching', label: 'Currently watching', mediaTypes: ['tv', 'anime'] as Array<'movie' | 'tv' | 'anime'> },
    { value: 'watched', label: 'Watched' },
    { value: 'abandoned', label: 'Abandoned' },
  ] as const;
  readonly moodOptions: Array<{ value: UserMovieMood; label: string }> = [
    { value: 'bored', label: 'Bored' },
    { value: 'scared', label: 'Scared' },
    { value: 'excited', label: 'Excited' },
    { value: 'thoughtful', label: 'Thoughtful' },
    { value: 'calm', label: 'Calm' },
    { value: 'tense', label: 'Tense' },
    { value: 'sad', label: 'Sad' },
  ];
  readonly stars = [1, 2, 3, 4, 5];

  @Input({ required: true}) movie!: MovieListItem;

  ngOnChanges(): void {
    if (this.authService.isAuthenticated()) {
      this.refreshUserMovie();
      return;
    }

    this.userMovie.set(null);
    this.menuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (!this.elementRef.nativeElement.contains(target)) {
      this.menuOpen.set(false);
    }
  }

  toggleMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const nextOpen = !this.menuOpen();
    this.menuOpen.set(nextOpen);

    if (nextOpen && this.authService.isAuthenticated()) {
      this.refreshUserMovie();
    }
  }

  setStatus(status: UserMovieStatus, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.authService.isAuthenticated() || this.isSubmitting()) {
      return;
    }

    if (this.userMovie()?.status === status) {
      this.removeFromList();
      return;
    }

    this.isSubmitting.set(true);
    const existingItem = this.userMovie();
    const request$ = existingItem
      ? this.watchlistService.updateUserMovie(existingItem.id, { status })
      : this.watchlistService.addToLibrary(
          {
            movie_id: this.movie.id,
            media_type: this.movie.media_type,
            status,
          },
          this.createMovieSnapshot(),
        );

    request$.subscribe({
      next: (userMovie) => {
        this.userMovie.set(userMovie);
        this.isSubmitting.set(false);
      },
      error: () => {
        this.isSubmitting.set(false);
      },
    });
  }

  setRating(rating: number, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const existingItem = this.userMovie();
    if (!existingItem || this.isSubmitting()) {
      return;
    }

    const nextRating = existingItem.rating === rating ? null : rating;
    this.isSubmitting.set(true);
    this.watchlistService.updateUserMovie(existingItem.id, { rating: nextRating }).subscribe({
      next: (userMovie) => {
        this.userMovie.set(userMovie);
        this.isSubmitting.set(false);
      },
      error: () => {
        this.isSubmitting.set(false);
      },
    });
  }

  setMood(mood: UserMovieMood, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const existingItem = this.userMovie();
    if (!existingItem || this.isSubmitting()) {
      return;
    }

    const nextMood = existingItem.mood === mood ? '' : mood;
    this.isSubmitting.set(true);
    this.watchlistService.updateUserMovie(existingItem.id, { mood: nextMood }).subscribe({
      next: (userMovie) => {
        this.userMovie.set(userMovie);
        this.isSubmitting.set(false);
      },
      error: () => {
        this.isSubmitting.set(false);
      },
    });
  }

  isSelectedStatus(status: UserMovieStatus): boolean {
    return this.userMovie()?.status === status;
  }

  isSelectedMood(mood: UserMovieMood): boolean {
    return this.userMovie()?.mood === mood;
  }

  isActiveStar(star: number): boolean {
    return (this.userMovie()?.rating ?? 0) >= star;
  }

  canEditExtras(): boolean {
    return !!this.userMovie() && !this.isSubmitting();
  }

  get visibleStatusOptions(): ReadonlyArray<(typeof this.statusOptions)[number]> {
    return this.statusOptions.filter(
      (option) => !('mediaTypes' in option) || option.mediaTypes.includes(this.movie.media_type),
    );
  }

  private refreshUserMovie(): void {
    this.watchlistService.getUserMovieForMovie(this.movie.id, this.movie.media_type).subscribe({
      next: (userMovie) => this.userMovie.set(userMovie),
    });
  }

  private removeFromList(): void {
    const existingItem = this.userMovie();
    if (!existingItem) {
      return;
    }

    this.isSubmitting.set(true);
    this.watchlistService.deleteUserMovie(existingItem.id).subscribe({
      next: () => {
        this.userMovie.set(null);
        this.isSubmitting.set(false);
      },
      error: () => {
        this.isSubmitting.set(false);
      },
    });
  }

  private createMovieSnapshot(): MovieDetail {
    return {
      id: this.movie.id,
      media_type: this.movie.media_type,
      title: this.movie.title,
      original_title: this.movie.title,
      description: '',
      release_year: this.movie.release_year,
      duration_minutes: 0,
      total_episodes: this.movie.total_episodes ?? 0,
      poster_url: this.movie.poster_url,
      background_url: '',
      country: '',
      age_rating: '',
      genres: this.movie.genres,
      created_at: '',
      updated_at: '',
    };
  }

  onPosterError(event: Event): void {
    const image = event.target;

    if (!(image instanceof HTMLImageElement) || image.src === MovieCardComponent.posterFallbackUrl) {
      return;
    }

    image.src = MovieCardComponent.posterFallbackUrl;
  }
}
