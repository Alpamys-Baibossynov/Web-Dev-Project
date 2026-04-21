import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, forkJoin, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';

import { MovieDetail } from '../../models/movie-detail.interface';
import { User } from '../../models/user.interface';
import { AuthService } from '../../services/auth.service';
import { MoviesService } from '../../services/movies.service';
import { WatchlistService } from '../../services/watchlist.service';
import { UserMovie } from '../../models/user-movie.interface';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AsyncPipe],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit {
  private readonly moodLabels: Record<string, string> = {
    bored: 'Bored',
    scared: 'Scared',
    excited: 'Excited',
    thoughtful: 'Thoughtful',
    calm: 'Calm',
    comforted: 'Calm',
    tense: 'Tense',
    sad: 'Sad',
  };
  readonly authService = inject(AuthService);
  private formBuilder = inject(FormBuilder);
  private moviesService = inject(MoviesService);
  private watchlistService = inject(WatchlistService);
  imageLoadFailed = false;
  uploadError: string | null = null;
  profileMessage: string | null = null;
  passwordMessage: string | null = null;
  userSearch = '';
  isUserSearchOpen = false;
  isFollowSubmitting = false;
  private readonly userSearch$ = new BehaviorSubject<string>('');
  private readonly relationshipsTab$ = new BehaviorSubject<'followers' | 'following'>('followers');
  isProfileFormOpen = false;
  isPasswordFormOpen = false;
  followersCount = 0;
  followingCount = 0;
  libraryStats = {
    total: 0,
    watched: 0,
    planned: 0,
  };
  analytics = {
    timeSpent: '0 h',
    averageRating: 'No ratings',
    favoriteGenre: 'Mysterious',
    dominantMood: 'Mysterious',
    mediaCitizenship: 'No signal',
    psychologicalAge: 'Unclear',
    emotionalPortrait: 'Mysterious',
  };
  private static isEnrichedDetail(
    detail: { key: string; movie: MovieDetail } | null,
  ): detail is { key: string; movie: MovieDetail } {
    return detail !== null;
  }

  readonly userSearchViewModel$ = this.userSearch$.pipe(
    switchMap((search) => {
      const trimmedSearch = search.trim();
      if (!trimmedSearch) {
        return of({
          users: [] as User[],
          isLoading: false,
          message: null as string | null,
        });
      }

      return this.authService.searchUsers(trimmedSearch).pipe(
        map((users) => {
          const filteredUsers = users.filter((user) => user.id !== this.authService.currentUser()?.id);
          return {
            users: filteredUsers,
            isLoading: false,
            message: filteredUsers.length ? null : 'No users found',
          };
        }),
        startWith({
          users: [] as User[],
          isLoading: true,
          message: null as string | null,
        }),
        catchError(() =>
          of({
            users: [] as User[],
            isLoading: false,
            message: 'Could not search users right now',
          }),
        ),
      );
    }),
  );

  readonly relationshipsViewModel$ = this.relationshipsTab$.pipe(
    switchMap((tab) => {
      const request$ = tab === 'followers'
        ? this.authService.getFollowers()
        : this.authService.getFollowing();

      return request$.pipe(
        map((users) => ({
          tab,
          users,
          isLoading: false,
          message: users.length
            ? null
            : tab === 'followers'
              ? 'No followers yet'
              : 'No following yet',
        })),
        startWith({
          tab,
          users: [] as User[],
          isLoading: true,
          message: null as string | null,
        }),
        catchError(() =>
          of({
            tab,
            users: [] as User[],
            isLoading: false,
            message: 'Could not load this list right now',
          }),
        ),
      );
    }),
  );

  readonly profileForm = this.formBuilder.nonNullable.group({
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
  });

  readonly passwordForm = this.formBuilder.nonNullable.group({
    currentPassword: [''],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  ngOnInit(): void {
    this.refreshCurrentUserProfile();
    this.refreshRelationshipCounts();

    this.watchlistService.getLibrary().subscribe({
      next: (response) => {
        const items = response.results;
        this.libraryStats = {
          total: items.length,
          watched: items.filter((item) => item.status === 'watched').length,
          planned: items.filter((item) => item.status === 'planned' || item.status === 'currently_watching').length,
        };
        this.enrichItemsForAnalytics(items).subscribe({
          next: (enrichedItems) => {
            this.analytics = this.buildAnalytics(enrichedItems);
          },
        });
      },
    });
  }

  resetProfilePictureState(): void {
    this.imageLoadFailed = false;
    this.uploadError = null;
  }

  onImageError(): void {
    this.imageLoadFailed = true;
  }

  onProfilePictureSelected(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.uploadError = 'Choose an image file';
      input.value = '';
      return;
    }

    const maxSizeBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      this.uploadError = 'Image should be smaller than 2 MB';
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        this.uploadError = 'Could not read that image';
        return;
      }

      this.authService.updateProfilePicture(result).subscribe({
        next: () => {
          this.imageLoadFailed = false;
          this.uploadError = null;
          this.profileMessage = 'Profile picture updated';
          input.value = '';
        },
        error: () => {
          this.uploadError = 'Could not save that image right now';
          input.value = '';
        },
      });
    };
    reader.onerror = () => {
      this.uploadError = 'Could not read that image';
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  getUserInitials(username: string): string {
    return username.slice(0, 2).toUpperCase();
  }

  getFollowersLabel(count: number): string {
    return count === 1 ? 'follower' : 'followers';
  }

  saveProfileDetails(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.authService.updateProfileDetails(this.profileForm.getRawValue()).subscribe({
      next: (user) => {
        this.profileForm.patchValue({
          username: user.username,
          email: user.email,
        });
        this.profileMessage = 'Profile updated';
      },
      error: () => {
        this.profileMessage = 'Could not update profile right now';
      },
    });
  }

  updateAvatarFromClick(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  toggleProfileForm(): void {
    this.isProfileFormOpen = !this.isProfileFormOpen;
  }

  togglePasswordForm(): void {
    this.isPasswordFormOpen = !this.isPasswordFormOpen;
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = this.passwordForm.getRawValue();
    if (newPassword !== confirmPassword) {
      this.passwordMessage = 'New passwords do not match';
      return;
    }

    this.authService.changePassword({ currentPassword, newPassword }).subscribe({
      next: (result) => {
        this.passwordMessage = result.success ? 'Password changed' : result.error ?? 'Could not change password';

        if (result.success) {
          this.passwordForm.reset({
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
          });
        }
      },
      error: () => {
        this.passwordMessage = 'Could not change password';
      },
    });
  }

  searchForUsers(): void {
    this.userSearch$.next(this.userSearch);
  }

  onUserSearchInput(value: string): void {
    this.userSearch = value;
    this.userSearch$.next(value);
  }

  toggleUserSearch(): void {
    this.isUserSearchOpen = !this.isUserSearchOpen;

    if (!this.isUserSearchOpen) {
      this.userSearch = '';
      this.userSearch$.next('');
    }
  }

  selectRelationshipsTab(tab: 'followers' | 'following'): void {
    this.relationshipsTab$.next(tab);
  }

  isRelationshipsTabActive(tab: 'followers' | 'following'): boolean {
    return this.relationshipsTab$.value === tab;
  }

  toggleFollowUser(user: User): void {
    if (this.isFollowSubmitting) {
      return;
    }

    this.isFollowSubmitting = true;
    const request$ = user.is_following
      ? this.authService.unfollowUser(user.username)
      : this.authService.followUser(user.username);

    request$.subscribe({
      next: () => {
        this.refreshCurrentUserProfile();
        this.refreshRelationshipCounts();
        this.userSearch$.next(this.userSearch);
        this.relationshipsTab$.next(this.relationshipsTab$.value);
        this.isFollowSubmitting = false;
      },
      error: () => {
        this.isFollowSubmitting = false;
      },
    });
  }

  getRelationshipLabel(user: User): string {
    if (user.is_friend) {
      return 'Friend';
    }
    return user.is_following ? 'Following' : 'Follow';
  }

  getRelationshipClass(user: User): string {
    if (user.is_friend) {
      return 'people-card__action people-card__action--friend';
    }
    if (user.is_following) {
      return 'people-card__action people-card__action--following';
    }
    return 'people-card__action people-card__action--follow';
  }

  private enrichItemsForAnalytics(items: UserMovie[]) {
    const missingMetadataItems = items.filter((item) => {
      if (item.status !== 'watched') {
        return false;
      }

      if ((item.movie.duration_minutes ?? 0) > 0) {
        return false;
      }

      return true;
    });

    if (!missingMetadataItems.length) {
      return of(items);
    }

    return forkJoin(
      missingMetadataItems.map((item) =>
        this.moviesService.getMovieById(item.movie.id, item.movie.media_type).pipe(
          map((movie) => ({ key: `${movie.media_type}:${movie.id}`, movie })),
          catchError(() => of(null)),
        ),
      ),
    ).pipe(
      map((details) => {
        const detailMap = new Map(
          details
            .filter(ProfileComponent.isEnrichedDetail)
            .map((detail) => [detail.key, detail.movie]),
        );

        return items.map((item) => {
          const key = `${item.movie.media_type}:${item.movie.id}`;
          const detail = detailMap.get(key);
          if (!detail) {
            return item;
          }

          this.watchlistService.updateLocalMovieMetadata(detail);

          return {
            ...item,
            movie: {
              ...item.movie,
              title: detail.title,
              release_year: detail.release_year,
              duration_minutes: detail.duration_minutes,
              total_episodes: detail.total_episodes ?? item.movie.total_episodes ?? 0,
              poster_url: detail.poster_url,
              country: detail.country,
              age_rating: detail.age_rating,
              genres: detail.genres,
            },
          };
        });
      }),
    );
  }

  private refreshCurrentUserProfile(): void {
    this.authService.fetchCurrentUser().subscribe({
      next: (user) => {
        if (!user) {
          return;
        }

        this.profileForm.patchValue({
          username: user.username,
          email: user.email,
        });
      },
    });
  }

  private refreshRelationshipCounts(): void {
    forkJoin({
      followers: this.authService.getFollowers().pipe(catchError(() => of([] as User[]))),
      following: this.authService.getFollowing().pipe(catchError(() => of([] as User[]))),
    }).subscribe({
      next: ({ followers, following }) => {
        this.followersCount = followers.length;
        this.followingCount = following.length;
      },
    });
  }

  private buildAnalytics(items: UserMovie[]): {
    timeSpent: string;
    averageRating: string;
    favoriteGenre: string;
    dominantMood: string;
    mediaCitizenship: string;
    psychologicalAge: string;
    emotionalPortrait: string;
  } {
    const watchedItems = items.filter((item) => item.status === 'watched');
    const ratedItems = items.filter((item) => item.rating !== null);
    const moodCounts = new Map<string, number>();
    const genreWeights = new Map<string, number>();
    const countryRatings = new Map<string, { total: number; count: number }>();

    items.forEach((item) => {
      if (!item.mood) {
      } else {
        const label = this.moodLabels[item.mood] ?? item.mood;
        moodCounts.set(label, (moodCounts.get(label) ?? 0) + 1);
      }

      const genreWeight = (item.rating ?? (item.status === 'watched' ? 3.5 : 2.2));
      item.movie.genres.forEach((genre) => {
        genreWeights.set(genre.name, (genreWeights.get(genre.name) ?? 0) + genreWeight);
      });

      if (item.movie.country && item.rating !== null) {
        const current = countryRatings.get(item.movie.country) ?? { total: 0, count: 0 };
        current.total += item.rating;
        current.count += 1;
        countryRatings.set(item.movie.country, current);
      }
    });

    const topMoodEntries = [...moodCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([label, count]) => ({ label, count }));
    const dominantMood = topMoodEntries[0]?.label ?? 'Mysterious';
    const secondaryMood = topMoodEntries[1]?.label;
    const favoriteGenre = [...genreWeights.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'Mysterious';

    const totalMinutes = watchedItems.reduce((total, item) => {
      const durationMinutes = item.movie.duration_minutes ?? 0;
      const isSeries = item.movie.media_type === 'tv' || item.movie.media_type === 'anime';
      const episodes = isSeries ? Math.max(item.movie.total_episodes ?? 0, 0) : 1;
      return total + durationMinutes * (isSeries ? episodes : 1);
    }, 0);
    const timeSpent = this.formatTimeSpent(totalMinutes);

    const averageRating = ratedItems.length
      ? `${(ratedItems.reduce((total, item) => total + (item.rating ?? 0), 0) / ratedItems.length).toFixed(1)}/5`
      : 'No ratings';

    const mediaCitizenship = [...countryRatings.entries()]
      .map(([country, stats]) => ({
        country,
        average: stats.total / stats.count,
        count: stats.count,
      }))
      .sort((left, right) => right.average - left.average || right.count - left.count)[0]?.country ?? 'No signal';

    const psychologicalAge = this.getPsychologicalAge(watchedItems);
    const emotionalPortrait = this.getEmotionalPortraitLabel(dominantMood, secondaryMood);

    return {
      timeSpent,
      averageRating,
      favoriteGenre,
      dominantMood,
      mediaCitizenship,
      psychologicalAge,
      emotionalPortrait,
    };
  }

  private getPsychologicalAge(items: UserMovie[]): string {
    if (!items.length) {
      return 'Unclear';
    }

    const currentYear = new Date().getFullYear();
    const ageScores = items.map((item) => this.getAgeRatingScore(item.movie.age_rating));
    const averageAgeScore = ageScores.reduce((total, score) => total + score, 0) / ageScores.length;
    const averageReleaseYear = items.reduce((total, item) => total + item.movie.release_year, 0) / items.length;
    const eraLift = Math.max(0, (currentYear - averageReleaseYear) / 5);
    const psychologicalAge = Math.round(Math.min(45, Math.max(10, averageAgeScore + eraLift)));

    return `${psychologicalAge}+`;
  }

  private getAgeRatingScore(ageRating?: string): number {
    const normalized = ageRating?.toUpperCase() ?? '';

    if (normalized.includes('TV-MA') || normalized.includes('NC-17') || normalized === '18') {
      return 23;
    }
    if (normalized.includes('R') || normalized.includes('16')) {
      return 19;
    }
    if (normalized.includes('PG-13') || normalized.includes('TV-14') || normalized.includes('15')) {
      return 15;
    }
    if (normalized.includes('PG') || normalized.includes('TV-PG') || normalized.includes('12')) {
      return 12;
    }
    if (normalized.includes('G') || normalized.includes('TV-G') || normalized.includes('TV-Y')) {
      return 9;
    }

    return 13;
  }

  private getEmotionalPortraitLabel(dominantMood: string, secondaryMood?: string): string {
    if (dominantMood === 'Scared' || dominantMood === 'Tense') {
      return secondaryMood === 'Excited' ? 'Thrill seeker' : 'Intensity chaser';
    }
    if (dominantMood === 'Calm' || dominantMood === 'Thoughtful') {
      return 'Reflective dreamer';
    }
    if (dominantMood === 'Excited') {
      return secondaryMood === 'Scared' ? 'Adrenaline hunter' : 'Energy seeker';
    }
    if (dominantMood === 'Sad') {
      return 'Sensitive observer';
    }
    if (dominantMood === 'Bored') {
      return 'Restless explorer';
    }
    return 'Mysterious';
  }

  private formatTimeSpent(totalMinutes: number): string {
    if (!totalMinutes) {
      return '0 h';
    }

    const minutesPerHour = 60;
    const minutesPerDay = 24 * minutesPerHour;
    const minutesPerMonth = 30 * minutesPerDay;

    if (totalMinutes >= minutesPerMonth) {
      const months = Math.floor(totalMinutes / minutesPerMonth);
      const remainingDays = Math.floor((totalMinutes % minutesPerMonth) / minutesPerDay);
      return `${months} m ${remainingDays} d`;
    }

    if (totalMinutes >= minutesPerDay) {
      const days = Math.floor(totalMinutes / minutesPerDay);
      const remainingHours = Math.floor((totalMinutes % minutesPerDay) / minutesPerHour);
      return `${days} d ${remainingHours} h`;
    }

    if (totalMinutes >= minutesPerHour) {
      const hours = Math.floor(totalMinutes / minutesPerHour);
      const remainingMinutes = totalMinutes % minutesPerHour;
      return remainingMinutes ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
    }

    return `${totalMinutes} min`;
  }
}
