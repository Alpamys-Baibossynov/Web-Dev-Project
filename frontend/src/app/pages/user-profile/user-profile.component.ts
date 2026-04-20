import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BehaviorSubject, Observable, combineLatest, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';

import { User } from '../../models/user.interface';
import { UserMovie, UserMovieStatus } from '../../models/user-movie.interface';
import { AuthService } from '../../services/auth.service';
import { WatchlistService } from '../../services/watchlist.service';

interface PublicProfileViewModel {
  profile: User | null;
  items: UserMovie[];
  isLoading: boolean;
  error: string | null;
}

@Component({
  selector: 'app-user-profile',
  imports: [CommonModule, FormsModule, AsyncPipe, RouterLink],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.css',
})
export class UserProfileComponent {
  readonly authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private watchlistService = inject(WatchlistService);
  private readonly selectedStatus$ = new BehaviorSubject<UserMovieStatus | ''>('');

  readonly statusOptions: Array<{ value: UserMovieStatus; label: string }> = [
    { value: 'planned', label: 'Planned' },
    { value: 'currently_watching', label: 'Currently watching' },
    { value: 'watched', label: 'Watched' },
    { value: 'abandoned', label: 'Abandoned' },
  ];

  selectedStatus: UserMovieStatus | '' = '';
  isSubmitting = false;

  private readonly username$ = this.route.paramMap.pipe(
    map((params) => params.get('username') ?? ''),
  );

  readonly viewModel$: Observable<PublicProfileViewModel> = combineLatest([
    this.username$,
    this.selectedStatus$,
  ]).pipe(
    switchMap(([username, status]) => {
      if (!username) {
        return of({
          profile: null,
          items: [] as UserMovie[],
          isLoading: false,
          error: 'User not found.',
        });
      }

      return combineLatest([
        this.authService.getPublicUser(username).pipe(
          catchError(() => of(null)),
        ),
        this.watchlistService.getUserLibraryByUsername(username, status || undefined).pipe(
          catchError(() =>
            of({
              count: 0,
              next: null,
              previous: null,
              results: [] as UserMovie[],
            }),
          ),
        ),
      ]).pipe(
        map(([profile, response]) => {
          if (!profile) {
            return {
              profile: null,
              items: [] as UserMovie[],
              isLoading: false,
              error: 'Failed to load this profile right now.',
            };
          }

          return {
            profile,
            items: response.results,
            isLoading: false,
            error: null,
          };
        }),
        startWith({
          profile: null,
          items: [] as UserMovie[],
          isLoading: true,
          error: null,
        }),
        catchError(() =>
          of({
            profile: null,
            items: [] as UserMovie[],
            isLoading: false,
            error: 'Failed to load this profile right now.',
          }),
        ),
      );
    }),
  );

  onStatusChange(value: UserMovieStatus | ''): void {
    this.selectedStatus = value;
    this.selectedStatus$.next(value);
  }

  toggleFollow(profile: User): void {
    if (this.isOwnProfile(profile) || this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
    const request$ = profile.is_following
      ? this.authService.unfollowUser(profile.username)
      : this.authService.followUser(profile.username);

    request$.subscribe({
      next: () => {
        this.selectedStatus$.next(this.selectedStatus);
        this.isSubmitting = false;
      },
      error: () => {
        this.isSubmitting = false;
      },
    });
  }

  getUserInitials(username: string): string {
    return username.slice(0, 2).toUpperCase();
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

  isOwnProfile(profile: User): boolean {
    return this.authService.currentUser()?.id === profile.id;
  }
}
