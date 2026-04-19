import { Genre } from './genre';

export interface MovieListItem {
  id: number;
  title: string;
  release_year: number;
  poster_url: string;
  genres: Genre[];
}