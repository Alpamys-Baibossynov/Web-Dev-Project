import hashlib
import json
from datetime import datetime
import ssl
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ImproperlyConfigured

from .models import Genre, Movie


class TmdbClient:
    def __init__(self):
        self.base_url = settings.TMDB_API_BASE_URL.rstrip('/')
        self.read_access_token = settings.TMDB_API_READ_ACCESS_TOKEN
        self.api_key = settings.TMDB_API_KEY
        self.image_base_url = settings.TMDB_IMAGE_BASE_URL.rstrip('/')

    def _cache_key(self, path: str, params: dict | None = None) -> str:
        raw_key = json.dumps(
            {
                'path': path,
                'params': params or {},
            },
            sort_keys=True,
        )
        digest = hashlib.sha256(raw_key.encode('utf-8')).hexdigest()
        return f'tmdb:{digest}'

    def _build_url(self, path: str, params: dict | None = None) -> str:
        query_params = dict(params or {})
        if not self.read_access_token:
            if self.api_key:
                query_params['api_key'] = self.api_key
            else:
                raise ImproperlyConfigured(
                    'TMDB credentials are missing. Set TMDB_API_READ_ACCESS_TOKEN or TMDB_API_KEY.'
                )

        query_string = urlencode(query_params)
        return f'{self.base_url}{path}?{query_string}' if query_string else f'{self.base_url}{path}'

    def _request(self, path: str, params: dict | None = None) -> dict:
        cache_key = self._cache_key(path, params)
        cached_payload = cache.get(cache_key)
        if cached_payload is not None:
            return cached_payload

        headers = {'accept': 'application/json'}
        if self.read_access_token:
            headers['Authorization'] = f'Bearer {self.read_access_token}'

        request = Request(self._build_url(path, params), headers=headers)
        ssl_context = None
        if not settings.TMDB_VERIFY_SSL:
            ssl_context = ssl._create_unverified_context()

        with urlopen(request, timeout=settings.TMDB_REQUEST_TIMEOUT, context=ssl_context) as response:
            payload = json.loads(response.read().decode('utf-8'))

        cache.set(cache_key, payload, timeout=settings.TMDB_CACHE_TTL)
        return payload

    def get_genres(self) -> list[dict]:
        payload = self._request('/genre/movie/list', {'language': 'en-US'})
        return payload.get('genres', [])

    def get_movies(self, page: int = 1, search: str = '', genre_id: str = '') -> dict:
        params = {'page': page, 'language': 'en-US'}
        if search:
            params['query'] = search
            return self._request('/search/movie', params)

        params['sort_by'] = 'popularity.desc'
        if genre_id:
            params['with_genres'] = genre_id
        return self._request('/discover/movie', params)

    def get_movie_detail(self, movie_id: int) -> dict:
        return self._request(
            f'/movie/{movie_id}',
            {
                'language': 'en-US',
                'append_to_response': 'release_dates',
            },
        )

    def image_url(self, path: str | None) -> str:
        if not path:
            return ''
        return f'{self.image_base_url}{path}'


def extract_release_year(release_date: str | None) -> int:
    if not release_date:
        return 0
    try:
        return datetime.strptime(release_date, '%Y-%m-%d').year
    except ValueError:
        return 0


def extract_age_rating(movie_data: dict) -> str:
    release_dates = movie_data.get('release_dates', {}).get('results', [])
    for release_group in release_dates:
        if release_group.get('iso_3166_1') != 'US':
            continue
        for item in release_group.get('release_dates') or []:
            certification = item.get('certification', '')
            if certification:
                return certification
    return ''


def sync_movie_from_tmdb(movie_data: dict) -> Movie:
    client = TmdbClient()
    production_countries = movie_data.get('production_countries') or []
    country = production_countries[0]['name'] if production_countries else ''

    movie, _ = Movie.objects.update_or_create(
        tmdb_id=movie_data['id'],
        defaults={
            'title': movie_data.get('title', ''),
            'original_title': movie_data.get('original_title', ''),
            'description': movie_data.get('overview', ''),
            'release_year': extract_release_year(movie_data.get('release_date')),
            'duration_minutes': movie_data.get('runtime') or 0,
            'poster_url': client.image_url(movie_data.get('poster_path')),
            'background_url': client.image_url(movie_data.get('backdrop_path')),
            'country': country,
            'age_rating': extract_age_rating(movie_data),
        },
    )

    genre_ids = []
    for genre_data in movie_data.get('genres', []):
        genre, _ = Genre.objects.get_or_create(name=genre_data['name'])
        genre_ids.append(genre.id)
    if genre_ids:
        movie.genres.set(Genre.objects.filter(id__in=genre_ids))

    return movie
