import { Genre } from '../models/genre.interface';
import { MovieDetail } from '../models/movie-detail.interface';


const actionGenre: Genre = { id: 1, name: 'Action' };
const sciFiGenre: Genre = { id: 2, name: 'Science Fiction' };
const dramaGenre: Genre = { id: 3, name: 'Drama' };
const crimeGenre: Genre = { id: 4, name: 'Crime' };
const adventureGenre: Genre = { id: 5, name: 'Adventure' };
const romanceGenre: Genre = { id: 6, name: 'Romance' };
const comedyGenre: Genre = { id: 7, name: 'Comedy' };
const thrillerGenre: Genre = { id: 8, name: 'Thriller' };

export const DEMO_GENRES: Genre[] = [
  actionGenre,
  sciFiGenre,
  dramaGenre,
  crimeGenre,
  adventureGenre,
  romanceGenre,
  comedyGenre,
  thrillerGenre,
];

export const DEMO_MOVIES: MovieDetail[] = [
  {
    id: 603,
    media_type: 'movie',
    title: 'The Matrix',
    original_title: 'The Matrix',
    description: 'A hacker discovers the world around him is a simulated reality.',
    release_year: 1999,
    duration_minutes: 136,
    poster_url: 'https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
    background_url: 'https://image.tmdb.org/t/p/w500/7u3pxc0K1wx32IleAkLv78MKgrw.jpg',
    country: 'United States of America',
    age_rating: 'R',
    genres: [actionGenre, sciFiGenre],
    created_at: '',
    updated_at: '',
  },
  {
    id: 155,
    media_type: 'movie',
    title: 'The Dark Knight',
    original_title: 'The Dark Knight',
    description: 'Batman faces the Joker, a criminal mastermind who pushes Gotham into chaos.',
    release_year: 2008,
    duration_minutes: 152,
    poster_url: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    background_url: 'https://image.tmdb.org/t/p/w500/hZkgoQYus5vegHoetLkCJzb17zJ.jpg',
    country: 'United States of America',
    age_rating: 'PG-13',
    genres: [dramaGenre, actionGenre, crimeGenre],
    created_at: '',
    updated_at: '',
  },
  {
    id: 13,
    media_type: 'movie',
    title: 'Forrest Gump',
    original_title: 'Forrest Gump',
    description: 'The life story of a kind man who keeps finding himself in extraordinary moments.',
    release_year: 1994,
    duration_minutes: 142,
    poster_url: 'https://image.tmdb.org/t/p/w500/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg',
    background_url: 'https://image.tmdb.org/t/p/w500/3h1JZGDhZ8nzxdgvkxha0qBqi05.jpg',
    country: 'United States of America',
    age_rating: 'PG-13',
    genres: [comedyGenre, dramaGenre, romanceGenre],
    created_at: '',
    updated_at: '',
  },
  {
    id: 27205,
    media_type: 'movie',
    title: 'Inception',
    original_title: 'Inception',
    description: 'A skilled thief enters dreams to steal secrets and is offered one last impossible job.',
    release_year: 2010,
    duration_minutes: 148,
    poster_url: 'https://image.tmdb.org/t/p/w500/8IB2e4r4oVhHnANbnm7O3Tj6tF8.jpg',
    background_url: 'https://image.tmdb.org/t/p/w500/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
    country: 'United States of America',
    age_rating: 'PG-13',
    genres: [actionGenre, sciFiGenre, adventureGenre],
    created_at: '',
    updated_at: '',
  },
  {
    id: 680,
    media_type: 'movie',
    title: 'Pulp Fiction',
    original_title: 'Pulp Fiction',
    description: 'Interwoven crime stories collide in a sharp, stylish Los Angeles underworld.',
    release_year: 1994,
    duration_minutes: 154,
    poster_url: 'https://image.tmdb.org/t/p/w500/vQWk5YBFWF4bZaofAbv0tShwBvQ.jpg',
    background_url: 'https://image.tmdb.org/t/p/w500/4cDFJr4HnXN5AdPw4AKrmLlMWdO.jpg',
    country: 'United States of America',
    age_rating: 'R',
    genres: [thrillerGenre, crimeGenre],
    created_at: '',
    updated_at: '',
  },
  {
    id: 157336,
    media_type: 'movie',
    title: 'Interstellar',
    original_title: 'Interstellar',
    description: 'Explorers travel through a wormhole in search of a new home for humanity.',
    release_year: 2014,
    duration_minutes: 169,
    poster_url: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    background_url: 'https://image.tmdb.org/t/p/w500/xJHokMbljvjADYdit5fK5VQsXEG.jpg',
    country: 'United States of America',
    age_rating: 'PG-13',
    genres: [adventureGenre, dramaGenre, sciFiGenre],
    created_at: '',
    updated_at: '',
  },
];
