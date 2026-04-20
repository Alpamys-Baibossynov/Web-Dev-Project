import { MovieListItem } from './movie-list-item.interface';

export type UserMovieStatus = 'planned' | 'currently_watching' | 'watched' | 'abandoned';
export type UserMovieMood =
  | 'bored'
  | 'scared'
  | 'excited'
  | 'thoughtful'
  | 'calm'
  | 'tense'
  | 'sad';

export interface UserMovie {
  id: number;
  movie: MovieListItem;
  status: UserMovieStatus;
  mood: UserMovieMood | '';
  rating: number | null;
  review: string;
  watched_at: string | null;
  created_at: string;
  updated_at: string;
}
