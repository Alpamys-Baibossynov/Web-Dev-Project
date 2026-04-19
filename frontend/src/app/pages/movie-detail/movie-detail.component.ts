import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
  private route = inject(ActivatedRoute);
  private formBuilder = inject(FormBuilder);
  private moviesService = inject(MoviesService);
  private watchlistService = inject(WatchlistService);
  readonly authService = inject(AuthService);

  movie: MovieDetail | null = null;
  userMovie: UserMovie | null = null;
  saveMessage: string | null = null;
  isSubmitting = false;

  readonly libraryForm = this.formBuilder.group({
    status: this.formBuilder.nonNullable.control<UserMovieStatus>('planned', Validators.required),
    mood: this.formBuilder.nonNullable.control<UserMovieMood | ''>(''),
    rating: [null as number | null],
  });

  readonly viewModel$: Observable<MovieDetailViewModel> = this.route.paramMap.pipe(
    map((params) => Number(params.get('id'))),
    switchMap((id) => {
      if (!id) {
        return of({
          movie: null,
          isLoading: false,
          error: 'Incorrect movie ID',
        });
      }

      return this.moviesService.getMovieById(id).pipe(
        map((movie) => {
          this.movie = movie;
          if (this.authService.isAuthenticated()) {
            this.loadUserMovie(movie.id);
          }
          return {
            movie,
            isLoading: false,
            error: null,
          };
        }),
        catchError(() =>
          of({
            movie: null,
            isLoading: false,
            error: 'Failed to load movie',
          }),
        ),
      );
    }),
  );

  loadUserMovie(movieId: number): void {
    this.watchlistService.getUserMovieForMovie(movieId).subscribe({
      next: (userMovie) => {
        this.userMovie = userMovie;
        if (userMovie) {
          this.libraryForm.patchValue({
            status: userMovie.status,
            mood: userMovie.mood,
            rating: userMovie.rating,
          });
        }
      },
    });
  }

  saveToLibrary(): void {
    if (!this.movie || this.libraryForm.invalid) {
      this.libraryForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.saveMessage = null;

    const formValue = this.libraryForm.getRawValue();
    const payload = {
      status: formValue.status,
      mood: formValue.mood,
      rating: formValue.rating ? Number(formValue.rating) : null,
    };

    const request$ = this.userMovie
      ? this.watchlistService.updateUserMovie(this.userMovie.id, payload)
      : this.watchlistService.addToLibrary({
          movie_id: this.movie.id,
          ...payload,
        }, this.movie);

    request$.subscribe({
      next: (userMovie) => {
        this.userMovie = userMovie;
        this.saveMessage = 'Library updated.';
        this.isSubmitting = false;
      },
      error: () => {
        this.saveMessage = 'Could not save this movie right now.';
        this.isSubmitting = false;
      },
    });
  }

  setStatus(status: UserMovieStatus): void {
    this.libraryForm.patchValue({ status });
  }

  setRating(rating: number): void {
    const currentRating = this.libraryForm.get('rating')?.value;
    this.libraryForm.patchValue({
      rating: currentRating === rating ? null : rating,
    });
  }

  isSelectedStatus(status: UserMovieStatus): boolean {
    return this.libraryForm.get('status')?.value === status;
  }

  setMood(mood: UserMovieMood): void {
    const currentMood = this.libraryForm.get('mood')?.value;
    this.libraryForm.patchValue({
      mood: currentMood === mood ? '' : mood,
    });
  }

  isSelectedMood(mood: UserMovieMood): boolean {
    return this.libraryForm.get('mood')?.value === mood;
  }

  getMoodLabel(mood: UserMovieMood): string {
    const moodLabels: Record<UserMovieMood, string> = {
      excited: 'Excited',
      thoughtful: 'Thoughtful',
      comforted: 'Calm',
      tense: 'Tense',
      sad: 'Sad',
      inspired: 'Inspired',
    };

    return moodLabels[mood];
  }

  isActiveStar(star: number): boolean {
    return (this.libraryForm.get('rating')?.value ?? 0) >= star;
  }
}
