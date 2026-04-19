import { Genre } from './genre';

export interface MovieDetail {
  id: number;
  title: string;
  original_title: string;
  description: string;
  release_year: number;
  duration_minutes: number;
  poster_url: string;
  background_url: string;
  country: string;
  age_rating: string;
  genres: Genre[];
  created_at: string;
  updated_at: string;
}