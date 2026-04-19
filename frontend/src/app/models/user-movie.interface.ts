import { MovieListItem } from './movie-list-item.interface';

export type UserMovieStatus = 'planned' | 'watched' | 'abandoned';
export type UserMovieMood =
  | 'excited'
  | 'thoughtful'
  | 'comforted'
  | 'tense'
  | 'sad'
  | 'inspired';

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
