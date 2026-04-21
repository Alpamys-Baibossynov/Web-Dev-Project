import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, Observable, forkJoin, of } from 'rxjs';
import { catchError, map, shareReplay, startWith, switchMap } from 'rxjs/operators';

import { MovieCardComponent } from '../../layout/movie-card/movie-card.component';
import { MovieListItem } from '../../models/movie-list-item.interface';
import { PaginatedResponse } from '../../models/paginated-response.interface';
import { UserMovie, UserMovieMood } from '../../models/user-movie.interface';
import { MoviesService } from '../../services/movies.service';
import { WatchlistService } from '../../services/watchlist.service';

type RecommendationMediaType = 'movie' | 'tv' | 'anime';

interface RecommendationItem {
  movie: MovieListItem;
  score: number;
  reason: string;
}

interface RecommendationsViewModel {
  recommendations: RecommendationItem[];
  isLoading: boolean;
  error: string | null;
  profileSummary: string | null;
  emptyState: string | null;
}

@Component({
  selector: 'app-recommendations',
  imports: [CommonModule, FormsModule, AsyncPipe, MovieCardComponent],
  templateUrl: './recommendations.component.html',
  styleUrl: './recommendations.component.css',
})
export class RecommendationsComponent {
  private static readonly candidatePages = [1, 2, 3];
  private moviesService = inject(MoviesService);
  private watchlistService = inject(WatchlistService);

  readonly mediaTypeOptions: Array<{ value: RecommendationMediaType; label: string }> = [
    { value: 'movie', label: 'Movies' },
    { value: 'tv', label: 'TV shows' },
    { value: 'anime', label: 'Anime' },
  ];

  selectedMediaType: RecommendationMediaType = 'movie';
  private readonly selectedMediaType$ = new BehaviorSubject<RecommendationMediaType>(this.selectedMediaType);

  readonly viewModel$: Observable<RecommendationsViewModel> = this.selectedMediaType$.pipe(
    switchMap((mediaType) =>
      this.watchlistService.getLibrary().pipe(
        switchMap((response) => this.buildRecommendations(response.results, mediaType)),
        startWith({
          recommendations: [] as RecommendationItem[],
          isLoading: true,
          error: null,
          profileSummary: null,
          emptyState: null,
        }),
        catchError(() =>
          of({
            recommendations: [] as RecommendationItem[],
            isLoading: false,
            error: 'Failed to build recommendations right now',
            profileSummary: null,
            emptyState: null,
          }),
        ),
      ),
    ),
    shareReplay(1),
  );

  onMediaTypeChange(value: RecommendationMediaType): void {
    this.selectedMediaType = value;
    this.selectedMediaType$.next(value);
  }

  private buildRecommendations(
    libraryItems: UserMovie[],
    mediaType: RecommendationMediaType,
  ): Observable<RecommendationsViewModel> {
    const relevantLibraryItems = libraryItems.filter((item) => item.movie.media_type === mediaType);

    if (!relevantLibraryItems.length) {
      return of({
        recommendations: [],
        isLoading: false,
        error: null,
        profileSummary: null,
        emptyState: `Save a few ${this.getMediaTypeLabel(mediaType).toLowerCase()} first :)`,
      });
    }

    const profile = this.buildProfile(relevantLibraryItems);

    if (!profile.referenceItems.length) {
      return of({
        recommendations: [],
        isLoading: false,
        error: null,
        profileSummary: null,
        emptyState: `Save a few more rated ${this.getMediaTypeLabel(mediaType).toLowerCase()} and I’ll sharpen the recommendations :)`,
      });
    }

    return forkJoin(
      RecommendationsComponent.candidatePages.map((page) =>
        this.moviesService
          .getMovies(page, '', [], [], 'desc', mediaType)
          .pipe(
            catchError(() =>
              of({
                count: 0,
                next: null,
                previous: null,
                results: [] as MovieListItem[],
              } satisfies PaginatedResponse<MovieListItem>),
            ),
          ),
      ),
    ).pipe(
      map((responses) => {
        const libraryKeys = new Set(relevantLibraryItems.map((item) => this.getMovieKey(item.movie)));
        const seenKeys = new Set<string>();
        const candidates = responses
          .flatMap((response) => response.results ?? [])
          .filter((movie) => {
            const key = this.getMovieKey(movie);
            if (libraryKeys.has(key) || seenKeys.has(key)) {
              return false;
            }
            seenKeys.add(key);
            return true;
          });

        const recommendations = candidates
          .map((movie) => this.scoreRecommendation(movie, profile))
          .filter((item) => item.score > 0)
          .sort((left, right) => right.score - left.score)
          .slice(0, 20);

        return {
          recommendations,
          isLoading: false,
          error: null,
          profileSummary: null,
          emptyState: recommendations.length
            ? null
            : `I couldn’t find a strong match yet. Try another media block or save a few more rated titles.`,
        };
      }),
    );
  }

  private buildProfile(libraryItems: UserMovie[]): {
    referenceItems: UserMovie[];
    genreWeights: Map<number, number>;
    averageReleaseYear: number | null;
    topGenres: Array<{ id: number; name: string; weight: number }>;
  } {
    const watchedMatches = libraryItems.filter((item) => item.status === 'watched');
    const fallbackItems = watchedMatches.length
      ? watchedMatches
      : libraryItems.filter((item) => item.status !== 'abandoned');

    const genreWeights = new Map<number, number>();
    let weightedReleaseYearTotal = 0;
    let releaseYearWeightTotal = 0;

    fallbackItems.forEach((item) => {
      const weight = this.getItemWeight(item);
      item.movie.genres.forEach((genre) => {
        genreWeights.set(genre.id, (genreWeights.get(genre.id) ?? 0) + weight);
      });
      weightedReleaseYearTotal += item.movie.release_year * weight;
      releaseYearWeightTotal += weight;
    });

    const topGenres = [...genreWeights.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4)
      .map(([id, weight]) => ({
        id,
        weight,
        name: fallbackItems
          .flatMap((item) => item.movie.genres)
          .find((genre) => genre.id === id)?.name ?? 'Genre',
      }));

    return {
      referenceItems: fallbackItems,
      genreWeights,
      averageReleaseYear: releaseYearWeightTotal ? weightedReleaseYearTotal / releaseYearWeightTotal : null,
      topGenres,
    };
  }

  private scoreRecommendation(
    movie: MovieListItem,
    profile: {
      referenceItems: UserMovie[];
      genreWeights: Map<number, number>;
      averageReleaseYear: number | null;
      topGenres: Array<{ id: number; name: string; weight: number }>;
    },
  ): RecommendationItem {
    const genreScore = movie.genres.reduce(
      (total, genre) => total + (profile.genreWeights.get(genre.id) ?? 0),
      0,
    );
    const matchedTopGenres = movie.genres
      .filter((genre) => profile.topGenres.some((topGenre) => topGenre.id === genre.id))
      .map((genre) => genre.name)
      .slice(0, 2);

    let yearScore = 0;
    if (profile.averageReleaseYear) {
      const yearDistance = Math.abs(movie.release_year - profile.averageReleaseYear);
      yearScore = Math.max(0, 2.4 - yearDistance / 7);
    }

    const score = genreScore + yearScore;
    const reasonParts = [];

    if (matchedTopGenres.length) {
      reasonParts.push(`Matches your ${matchedTopGenres.join(' + ')} taste`);
    }

    if (!reasonParts.length && profile.topGenres.length) {
      reasonParts.push(`Built from your ${profile.topGenres[0].name.toLowerCase()} favorites`);
    }

    return {
      movie,
      score,
      reason: reasonParts.join(' • '),
    };
  }

  private getItemWeight(item: UserMovie): number {
    const ratingWeight = item.rating ? item.rating / 2 : item.status === 'watched' ? 2.2 : 1.4;
    const moodWeight = this.getMoodWeight(item.mood);

    if (item.status === 'abandoned') {
      return -1.4;
    }
    if (item.status === 'planned') {
      return ratingWeight * 0.55 + moodWeight;
    }
    if (item.status === 'currently_watching') {
      return ratingWeight * 0.8 + moodWeight + 0.3;
    }
    return ratingWeight + moodWeight + 0.55;
  }

  private getMoodWeight(mood: UserMovieMood | ''): number {
    const moodWeights: Record<UserMovieMood, number> = {
      bored: 0.3,
      scared: 0.78,
      excited: 0.95,
      thoughtful: 0.8,
      calm: 0.72,
      tense: 0.82,
      sad: 0.6,
    };

    return mood ? moodWeights[mood] ?? 0.45 : 0.35;
  }

  private getMovieKey(movie: MovieListItem): string {
    return `${movie.media_type}:${movie.id}`;
  }

  private getMediaTypeLabel(mediaType: RecommendationMediaType): string {
    return this.mediaTypeOptions.find((option) => option.value === mediaType)?.label ?? 'Titles';
  }
}
