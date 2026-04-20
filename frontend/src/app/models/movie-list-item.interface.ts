import { Genre } from './genre.interface';

export interface MovieListItem {
  id: number;
  media_type: 'movie' | 'tv' | 'anime';
  title: string;
  release_year: number;
  duration_minutes?: number;
  total_episodes?: number;
  poster_url: string;
  country?: string;
  age_rating?: string;
  genres: Genre[];
}
