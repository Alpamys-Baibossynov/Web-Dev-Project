import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';

import { UserMovieStatus, UserMovie } from '../../models/user-movie.interface';
import { WatchlistService } from '../../services/watchlist.service';

interface LibraryViewModel {
  items: UserMovie[];
  isLoading: boolean;
  error: string | null;
}

@Component({
  selector: 'app-my-library',
  imports: [CommonModule, FormsModule, AsyncPipe, RouterLink],
  templateUrl: './my-library.component.html',
  styleUrl: './my-library.component.css',
})
export class MyLibraryComponent {
  private watchlistService = inject(WatchlistService);
  private readonly selectedStatus$ = new BehaviorSubject<UserMovieStatus | ''>('');
  readonly statusOptions: Array<{ value: UserMovieStatus; label: string }> = [
    { value: 'planned', label: 'Planned' },
    { value: 'currently_watching', label: 'Currently watching' },
    { value: 'watched', label: 'Watched' },
    { value: 'abandoned', label: 'Abandoned' },
  ];

  selectedStatus: UserMovieStatus | '' = '';

  readonly viewModel$: Observable<LibraryViewModel> = this.selectedStatus$.pipe(
    switchMap((status) =>
      this.watchlistService.getLibrary(status || undefined).pipe(
        map((response) => ({
          items: response.results,
          isLoading: false,
          error: null,
        })),
        startWith({
          items: [] as UserMovie[],
          isLoading: true,
          error: null,
        }),
        catchError(() =>
          of({
            items: [] as UserMovie[],
            isLoading: false,
            error: 'Failed to load your list',
          }),
        ),
      ),
    ),
  );

  onStatusChange(value: UserMovieStatus | ''): void {
    this.selectedStatus = value;
    this.selectedStatus$.next(value);
  }

  removeFromLibrary(id: number): void {
    this.watchlistService.deleteUserMovie(id).subscribe({
      next: () => {
        this.selectedStatus$.next(this.selectedStatus);
      },
    });
  }

  getMoodLabel(mood: UserMovie['mood']): string {
    const moodLabels: Record<string, string> = {
      bored: 'Bored',
      scared: 'Scared',
      excited: 'Excited',
      thoughtful: 'Thoughtful',
      calm: 'Calm',
      comforted: 'Calm',
      tense: 'Tense',
      sad: 'Sad',
    };

    return mood ? moodLabels[mood] ?? mood : '';
  }

  getStatusLabel(status: UserMovieStatus): string {
    return this.statusOptions.find((option) => option.value === status)?.label ?? status;
  }
}
