import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { MoviesService } from '../../services/movies.service';
import { MovieDetail } from '../../models/movie-detail.interface';
import { AuthService } from '../../services/auth.service';
import { WatchlistService } from '../../services/watchlist.service';
import { UserMovie, UserMovieMood, UserMovieStatus } from '../../models/user-movie.interface';

interface MovieDetailViewModel {
  movie: MovieDetail | null;
  isLoading: boolean;
  error: string | null;
}

@Component({
  selector: 'app-movie-detail',
  imports: [CommonModule, ReactiveFormsModule, AsyncPipe],
  templateUrl: './movie-detail.component.html',
  styleUrl: './movie-detail.component.css',
})
export class MovieDetailComponent {
  readonly moodOptions: Array<{ value: UserMovieMood; label: string }> = [
    { value: 'bored', label: 'Bored' },
    { value: 'scared', label: 'Scared' },
    { value: 'excited', label: 'Excited' },
    { value: 'thoughtful', label: 'Thoughtful' },
    { value: 'calm', label: 'Calm' },
    { value: 'tense', label: 'Tense' },
    { value: 'sad', label: 'Sad' },
  ];
  readonly statusOptions = [
    { value: 'planned', label: 'Planned' },
    { value: 'currently_watching', label: 'Currently watching', mediaTypes: ['tv', 'anime'] as Array<'tv' | 'anime' | 'movie'> },
    { value: 'watched', label: 'Watched' },
    { value: 'abandoned', label: 'Abandoned' },
  ] as const;
  private route = inject(ActivatedRoute);
  private formBuilder = inject(FormBuilder);
  private moviesService = inject(MoviesService);
  private watchlistService = inject(WatchlistService);
  private titleService = inject(Title);
  readonly authService = inject(AuthService);

  movie: MovieDetail | null = null;
  mediaType: 'movie' | 'tv' | 'anime' = 'movie';
  userMovie: UserMovie | null = null;
  saveMessage: string | null = null;
  isSubmitting = false;

  readonly libraryForm = this.formBuilder.group({
    status: this.formBuilder.control<UserMovieStatus | null>(null),
    mood: this.formBuilder.nonNullable.control<UserMovieMood | ''>(''),
    rating: [null as number | null],
  });

  readonly viewModel$: Observable<MovieDetailViewModel> = this.route.paramMap.pipe(
    map((params) => ({
      id: Number(params.get('id')),
      mediaType: (params.get('mediaType') ?? 'movie') as 'movie' | 'tv' | 'anime',
    })),
    switchMap(({ id, mediaType }) => {
      if (!id) {
        return of({
          movie: null,
          isLoading: false,
          error: 'Incorrect movie ID',
        });
      }

      this.mediaType = mediaType;
      return this.moviesService.getMovieById(id, mediaType).pipe(
        map((movie) => {
          this.movie = movie;
          this.titleService.setTitle(movie.title);
          if (this.authService.isAuthenticated()) {
            this.loadUserMovie(movie.id, movie.media_type);
          }
          return {
            movie,
            isLoading: false,
            error: null,
          };
        }),
        catchError(() =>
          of((() => {
            this.titleService.setTitle('Title Details');
            return {
              movie: null,
              isLoading: false,
              error: 'Failed to load title',
            };
          })()),
        ),
      );
    }),
  );

  loadUserMovie(movieId: number, mediaType: 'movie' | 'tv' | 'anime'): void {
    this.watchlistService.getUserMovieForMovie(movieId, mediaType).subscribe({
      next: (userMovie) => {
        this.userMovie = userMovie;
        if (userMovie) {
          this.libraryForm.patchValue({
            status: userMovie.status,
            mood: userMovie.mood,
            rating: userMovie.rating,
          });
        } else {
          this.libraryForm.patchValue({
            status: null,
            mood: '',
            rating: null,
          });
        }
      },
    });
  }

  saveStatus(status: UserMovieStatus): void {
    if (this.userMovie?.status === status) {
      this.removeFromList();
      return;
    }

    this.libraryForm.patchValue({ status });
    this.persistSelection({ status });
  }

  saveRating(rating: number): void {
    if (!this.userMovie) {
      return;
    }

    const nextRating = this.libraryForm.get('rating')?.value === rating ? null : rating;
    this.libraryForm.patchValue({ rating: nextRating });
    this.persistSelection({ rating: nextRating });
  }

  saveMood(mood: UserMovieMood): void {
    if (!this.userMovie) {
      return;
    }

    const nextMood = this.libraryForm.get('mood')?.value === mood ? '' : mood;
    this.libraryForm.patchValue({ mood: nextMood });
    this.persistSelection({ mood: nextMood });
  }

  private persistSelection(payload: {
    status?: UserMovieStatus;
    mood?: UserMovieMood | '';
    rating?: number | null;
  }): void {
    if (!this.movie) {
      return;
    }

    this.isSubmitting = true;
    this.saveMessage = null;

    let request$: ReturnType<WatchlistService['updateUserMovie']> | null = null;

    if (this.userMovie) {
      request$ = this.watchlistService.updateUserMovie(this.userMovie.id, payload);
    } else if (payload.status) {
      request$ = this.watchlistService.addToLibrary(
        {
          movie_id: this.movie.id,
          media_type: this.movie.media_type,
          status: payload.status,
          mood: payload.mood,
          rating: payload.rating,
        },
        this.movie,
      );
    }

    if (!request$) {
      this.isSubmitting = false;
      return;
    }

    request$.subscribe({
      next: (userMovie) => {
        this.userMovie = userMovie;
        this.libraryForm.patchValue({
          status: userMovie.status,
          mood: userMovie.mood,
          rating: userMovie.rating,
        });
        this.isSubmitting = false;
      },
      error: () => {
        this.saveMessage = 'Could not save this title right now.';
        this.isSubmitting = false;
      },
    });
  }

  private removeFromList(): void {
    if (!this.userMovie) {
      return;
    }

    this.isSubmitting = true;
    this.saveMessage = null;

    this.watchlistService.deleteUserMovie(this.userMovie.id).subscribe({
      next: () => {
        this.userMovie = null;
        this.libraryForm.patchValue({
          status: null,
          mood: '',
          rating: null,
        });
        this.isSubmitting = false;
      },
      error: () => {
        this.saveMessage = 'Could not save this title right now.';
        this.isSubmitting = false;
      },
    });
  }

  setStatus(status: UserMovieStatus): void {
    this.saveStatus(status);
  }

  setRating(rating: number): void {
    this.saveRating(rating);
  }

  isSelectedStatus(status: UserMovieStatus): boolean {
    return this.libraryForm.get('status')?.value === status;
  }

  setMood(mood: UserMovieMood): void {
    this.saveMood(mood);
  }

  get visibleStatusOptions(): ReadonlyArray<(typeof this.statusOptions)[number]> {
    return this.statusOptions.filter(
      (option) => !('mediaTypes' in option) || option.mediaTypes.includes(this.mediaType),
    );
  }

  isSelectedMood(mood: UserMovieMood): boolean {
    return this.libraryForm.get('mood')?.value === mood;
  }

  getMoodLabel(mood: UserMovieMood): string {
    const moodLabels: Record<UserMovieMood, string> = {
      bored: 'Bored',
      scared: 'Scared',
      excited: 'Excited',
      thoughtful: 'Thoughtful',
      calm: 'Calm',
      tense: 'Tense',
      sad: 'Sad',
    };

    return moodLabels[mood];
  }

  getStatusLabel(status: UserMovieStatus): string {
    return this.statusOptions.find((option) => option.value === status)?.label ?? status;
  }

  isActiveStar(star: number): boolean {
    return (this.libraryForm.get('rating')?.value ?? 0) >= star;
  }

  canEditExtras(): boolean {
    return !!this.userMovie && !this.isSubmitting;
  }

  get mediaLabel(): string {
    if (this.movie?.media_type === 'anime') {
      return 'Anime';
    }
    if (this.movie?.media_type === 'tv') {
      return 'TV Show';
    }
    return 'Movie';
  }

  get releaseYearLabel(): string {
    return this.movie?.media_type === 'movie' ? 'Release year' : 'First aired';
  }

  get durationLabel(): string {
    if (this.movie?.media_type === 'anime') {
      return 'Episode length';
    }
    if (this.movie?.media_type === 'tv') {
      return 'Episode runtime';
    }
    return 'Duration';
  }
}
