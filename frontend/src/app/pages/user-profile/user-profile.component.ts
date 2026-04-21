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
  tasteMatch: number | null;
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
          tasteMatch: null,
          isLoading: false,
          error: 'User not found',
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
        this.watchlistService.getUserLibraryByUsername(username).pipe(
          catchError(() =>
            of({
              count: 0,
              next: null,
              previous: null,
              results: [] as UserMovie[],
            }),
          ),
        ),
        this.watchlistService.getLibrary().pipe(
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
        map(([profile, response, fullTargetLibrary, currentUserLibrary]) => {
          if (!profile) {
            return {
              profile: null,
              items: [] as UserMovie[],
              tasteMatch: null,
              isLoading: false,
              error: 'Failed to load this profile right now',
            };
          }

          return {
            profile,
            items: response.results,
            tasteMatch: this.isOwnProfile(profile)
              ? null
              : this.calculateTasteMatch(currentUserLibrary.results, fullTargetLibrary.results),
            isLoading: false,
            error: null,
          };
        }),
        startWith({
          profile: null,
          items: [] as UserMovie[],
          tasteMatch: null,
          isLoading: true,
          error: null,
        }),
        catchError(() =>
          of({
            profile: null,
            items: [] as UserMovie[],
            tasteMatch: null,
            isLoading: false,
            error: 'Failed to load this profile right now',
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

  getFollowersLabel(count: number): string {
    return count === 1 ? 'follower' : 'followers';
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

  getLibraryStats(items: UserMovie[]): { watched: number; planned: number } {
    return {
      watched: items.filter((item) => item.status === 'watched').length,
      planned: items.filter((item) => item.status === 'planned' || item.status === 'currently_watching').length,
    };
  }

  getTasteMatchLabel(match: number | null): string {
    return match === null ? '' : `${match}% taste match`;
  }

  isOwnProfile(profile: User): boolean {
    return this.authService.currentUser()?.id === profile.id;
  }

  private calculateTasteMatch(currentItems: UserMovie[], otherItems: UserMovie[]): number | null {
    if (!currentItems.length || !otherItems.length) {
      return null;
    }

    const sharedTitlesScore = this.calculateSharedTitlesScore(currentItems, otherItems);
    const genreScore = this.calculateProfileOverlap(
      this.buildWeightedMap(currentItems, (item) => item.movie.genres.map((genre) => genre.name), 1.6),
      this.buildWeightedMap(otherItems, (item) => item.movie.genres.map((genre) => genre.name), 1.6),
    );
    const moodScore = this.calculateProfileOverlap(
      this.buildWeightedMap(currentItems, (item) => item.mood ? [item.mood] : [], 1.1),
      this.buildWeightedMap(otherItems, (item) => item.mood ? [item.mood] : [], 1.1),
    );
    const mediaTypeScore = this.calculateProfileOverlap(
      this.buildWeightedMap(currentItems, (item) => [item.movie.media_type], 1),
      this.buildWeightedMap(otherItems, (item) => [item.movie.media_type], 1),
    );

    const blendedScore = (
      sharedTitlesScore * 0.42
      + genreScore * 0.33
      + moodScore * 0.15
      + mediaTypeScore * 0.10
    );

    return Math.max(12, Math.min(98, Math.round(blendedScore * 100)));
  }

  private calculateSharedTitlesScore(currentItems: UserMovie[], otherItems: UserMovie[]): number {
    const currentMap = new Map(currentItems.map((item) => [`${item.movie.media_type}:${item.movie.id}`, item]));
    const otherMap = new Map(otherItems.map((item) => [`${item.movie.media_type}:${item.movie.id}`, item]));
    const sharedKeys = [...currentMap.keys()].filter((key) => otherMap.has(key));

    if (!sharedKeys.length) {
      return 0.45;
    }

    const titleScores = sharedKeys.map((key) => {
      const currentItem = currentMap.get(key)!;
      const otherItem = otherMap.get(key)!;
      let score = 0.5;

      if (currentItem.status === otherItem.status) {
        score += 0.18;
      }

      if (currentItem.mood && otherItem.mood && currentItem.mood === otherItem.mood) {
        score += 0.14;
      }

      if (currentItem.rating !== null && otherItem.rating !== null) {
        score += Math.max(0, 0.18 - Math.abs(currentItem.rating - otherItem.rating) * 0.045);
      }

      const genreOverlap = this.calculateSetOverlap(
        new Set(currentItem.movie.genres.map((genre) => genre.name)),
        new Set(otherItem.movie.genres.map((genre) => genre.name)),
      );
      score += genreOverlap * 0.2;

      return Math.min(score, 1);
    });

    const sharedAverage = titleScores.reduce((total, score) => total + score, 0) / titleScores.length;
    const coverage = sharedKeys.length / Math.max(currentItems.length, otherItems.length);
    return Math.min(1, sharedAverage * 0.78 + coverage * 0.22);
  }

  private buildWeightedMap(
    items: UserMovie[],
    selector: (item: UserMovie) => string[],
    baseWeight: number,
  ): Map<string, number> {
    const weights = new Map<string, number>();

    items.forEach((item) => {
      const itemWeight = baseWeight + (item.rating ?? (item.status === 'watched' ? 3.2 : 2.3));
      selector(item).forEach((key) => {
        weights.set(key, (weights.get(key) ?? 0) + itemWeight);
      });
    });

    return weights;
  }

  private calculateProfileOverlap(left: Map<string, number>, right: Map<string, number>): number {
    if (!left.size || !right.size) {
      return 0.45;
    }

    const keys = new Set([...left.keys(), ...right.keys()]);
    let dot = 0;
    let leftMagnitude = 0;
    let rightMagnitude = 0;

    keys.forEach((key) => {
      const leftValue = left.get(key) ?? 0;
      const rightValue = right.get(key) ?? 0;
      dot += leftValue * rightValue;
      leftMagnitude += leftValue ** 2;
      rightMagnitude += rightValue ** 2;
    });

    if (!leftMagnitude || !rightMagnitude) {
      return 0.45;
    }

    return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
  }

  private calculateSetOverlap(left: Set<string>, right: Set<string>): number {
    const union = new Set([...left, ...right]);
    if (!union.size) {
      return 0;
    }

    const intersection = [...left].filter((value) => right.has(value)).length;
    return intersection / union.size;
  }
}
