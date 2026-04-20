import hashlib
import json
from difflib import SequenceMatcher
from datetime import datetime
import ssl
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ImproperlyConfigured

from .models import Genre, Movie


class TmdbClient:
    SHARED_BLOCKED_TERMS = [
        'porn',
        'porno',
        'erotic',
        'sex',
        'sexual',
        'sensual',
        'nude',
        'nudity',
        'explicit',
        'adult',
        'xxx',
        'fetish',
        'lewd',
        'nsfw',
        'bdsm',
        'submission',
        'dominant',
        'seduce',
        'seduction',
        'temptation',
        'lust',
        'uncensored',
        'orgy',
        'escort',
        'mistress',
        'slave',
        'rape',
        'molest',
        'incest',
        'voyeur',
        'prostitute',
        'brothel',
        'strip',
    ]
    MOVIE_BLOCKED_TERMS = [
        *SHARED_BLOCKED_TERMS,
    ]
    TV_BLOCKED_TERMS = [
        *SHARED_BLOCKED_TERMS,
    ]
    ANIME_BLOCKED_TERMS = [
        *SHARED_BLOCKED_TERMS,
        'hentai',
        'ecchi',
        'etti',
        'yaoi',
        'yuri',
        'boys love',
        'boy love',
        'girls love',
        'girl love',
        'shounen ai',
        'shoujo ai',
        'bl',
        'gl',
        'punishment',
        'guard',
        'personal',
        'overflow',
        'lover',
    ]

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

    def get_genres(self, media_type: str = 'movie') -> list[dict]:
        resolved_media_type = 'tv' if media_type in {'tv', 'anime'} else 'movie'
        payload = self._request(f'/genre/{resolved_media_type}/list', {'language': 'en-US'})
        return payload.get('genres', [])

    def get_movies(
        self,
        page: int = 1,
        search: str = '',
        genre_id: str = '',
        release_decade: str = '',
        popularity: str = 'desc',
        media_type: str = 'movie',
    ) -> dict:
        sort_key, sort_desc = self._resolve_sort(popularity)
        resolved_media_type = 'tv' if media_type in {'tv', 'anime'} else 'movie'
        genre_ids = [value for value in genre_id.split(',') if value]
        release_decades = [value for value in release_decade.split(',') if value]
        params = {'language': 'en-US', 'include_adult': 'false'}
        if search:
            params['query'] = search
            payload = self._get_filtered_page(
                path=f'/search/{resolved_media_type}',
                params=params,
                page=page,
                media_type=media_type,
                genre_ids=genre_ids,
                release_decades=release_decades,
                sort_key=sort_key,
                sort_desc=sort_desc,
                should_sort_results=True,
            )
            if page == 1 and not payload.get('results'):
                return self._get_fuzzy_search_page(
                    search=search,
                    media_type=media_type,
                    genre_ids=genre_ids,
                    release_decades=release_decades,
                    page=page,
                )
            return payload

        params['sort_by'] = f'{sort_key}.{"desc" if sort_desc else "asc"}'
        if genre_ids:
            params['with_genres'] = ','.join(genre_ids)
        if media_type == 'anime':
            params['with_genres'] = ','.join(dict.fromkeys([*genre_ids, '16']))
            params['with_original_language'] = 'ja'
        return self._get_filtered_page(
            path=f'/discover/{resolved_media_type}',
            params=params,
            page=page,
            media_type=media_type,
            genre_ids=genre_ids,
            release_decades=release_decades,
            sort_key=sort_key,
            sort_desc=sort_desc,
            should_sort_results=False,
        )

    def _resolve_sort(self, popularity: str) -> tuple[str, bool]:
        if popularity == 'asc':
            return 'popularity', False
        if popularity == 'rating_desc':
            return 'vote_average', True
        if popularity == 'rating_asc':
            return 'vote_average', False
        return 'popularity', True

    def get_movie_detail(self, movie_id: int, media_type: str = 'movie') -> dict:
        resolved_media_type = 'tv' if media_type in {'tv', 'anime'} else 'movie'
        payload = self._request(
            f'/{resolved_media_type}/{movie_id}',
            {
                'language': 'en-US',
                'append_to_response': 'content_ratings' if resolved_media_type == 'tv' else 'release_dates',
            },
        )
        return self._normalize_media_item(payload, media_type)

    def _get_filtered_page(
        self,
        path: str,
        params: dict,
        page: int,
        media_type: str,
        genre_ids: list[str],
        release_decades: list[str],
        sort_key: str,
        sort_desc: bool,
        should_sort_results: bool,
        ) -> dict:
        page_size = 20
        start_index = max(page - 1, 0) * page_size
        end_index = start_index + page_size
        collected_results: list[dict] = []
        current_page = 1
        total_pages = 1

        while current_page <= total_pages and len(collected_results) <= end_index:
            payload = self._request(path, {**params, 'page': current_page})
            total_pages = payload.get('total_pages', 1)
            page_results = self._apply_result_filters(
                payload.get('results', []),
                media_type=media_type,
                genre_ids=genre_ids,
                release_decades=release_decades,
            )
            collected_results.extend(page_results)
            collected_results = self._dedupe_results(collected_results)
            if should_sort_results:
                collected_results.sort(key=lambda item: item.get(sort_key, 0) or 0, reverse=sort_desc)
            current_page += 1

        visible_results = collected_results[start_index:end_index]
        has_more = len(collected_results) > end_index or current_page <= total_pages

        return {
            'page': page,
            'total_pages': page + 1 if has_more else page,
            'total_results': start_index + len(visible_results) + (1 if has_more else 0),
            'results': [self._normalize_media_item(result, media_type) for result in visible_results],
        }

    def _get_fuzzy_search_page(
        self,
        search: str,
        media_type: str,
        genre_ids: list[str],
        release_decades: list[str],
        page: int,
    ) -> dict:
        resolved_media_type = 'tv' if media_type in {'tv', 'anime'} else 'movie'
        params = {
            'language': 'en-US',
            'include_adult': 'false',
            'sort_by': 'popularity.desc',
        }
        if media_type == 'anime':
            params['with_genres'] = ','.join(dict.fromkeys([*genre_ids, '16'])) if genre_ids else '16'
            params['with_original_language'] = 'ja'
        elif genre_ids:
            params['with_genres'] = ','.join(genre_ids)

        candidates: list[dict] = []
        total_pages = 5
        current_page = 1

        while current_page <= total_pages:
            payload = self._request(f'/discover/{resolved_media_type}', {**params, 'page': current_page})
            total_pages = min(payload.get('total_pages', 1), 5)
            candidates.extend(
                self._apply_result_filters(
                    payload.get('results', []),
                    media_type=media_type,
                    genre_ids=genre_ids,
                    release_decades=release_decades,
                )
            )
            current_page += 1

        candidates = self._dedupe_results(candidates)
        ranked_results = self._rank_fuzzy_matches(search, candidates)
        page_size = 20
        start_index = max(page - 1, 0) * page_size
        end_index = start_index + page_size
        visible_results = ranked_results[start_index:end_index]
        has_more = len(ranked_results) > end_index

        return {
            'page': page,
            'total_pages': page + 1 if has_more else max(page, 1),
            'total_results': len(ranked_results),
            'results': [self._normalize_media_item(result, media_type) for result in visible_results],
        }

    def _apply_result_filters(
        self,
        results: list[dict],
        media_type: str,
        genre_ids: list[str],
        release_decades: list[str],
    ) -> list[dict]:
        filtered_results = self._filter_media_results(results, media_type)
        if genre_ids:
            filtered_results = [item for item in filtered_results if self._matches_selected_genres(item, genre_ids)]
        if release_decades:
            filtered_results = [
                item
                for item in filtered_results
                if any(
                    int(decade) <= extract_release_year(item.get('release_date') or item.get('first_air_date')) <= int(decade) + 9
                    for decade in release_decades
                )
            ]
        return self._dedupe_results(filtered_results)

    def _filter_media_results(self, results: list[dict], media_type: str) -> list[dict]:
        blocked_terms = self._get_blocked_terms(media_type)
        filtered_results = [
            item
            for item in results
            if not item.get('adult') and not self._contains_blocked_terms(item, blocked_terms)
        ]

        if media_type == 'tv':
            return [item for item in filtered_results if not self._is_anime_item(item)]

        if media_type != 'anime':
            return filtered_results

        return [
            item
            for item in filtered_results
            if self._is_anime_item(item)
        ]

    def _matches_selected_genres(self, item: dict, genre_ids: list[str]) -> bool:
        item_genre_ids = {str(genre_id) for genre_id in item.get('genre_ids', [])}
        return all(selected_genre_id in item_genre_ids for selected_genre_id in genre_ids)

    def _is_anime_item(self, item: dict) -> bool:
        genre_ids = {str(genre_id) for genre_id in item.get('genre_ids', [])}
        return '16' in genre_ids and item.get('original_language') == 'ja'

    def _contains_blocked_terms(self, item: dict, blocked_terms: list[str]) -> bool:
        haystack = ' '.join(
            [
                item.get('title', ''),
                item.get('name', ''),
                item.get('original_title', ''),
                item.get('original_name', ''),
                item.get('overview', ''),
            ]
        ).lower()
        return any(term in haystack for term in blocked_terms)

    def _rank_fuzzy_matches(self, search: str, results: list[dict]) -> list[dict]:
        normalized_search = self._normalize_text(search)
        scored_results: list[tuple[float, dict]] = []

        for item in results:
            title = self._normalize_text(item.get('title') or item.get('name') or '')
            original_title = self._normalize_text(item.get('original_title') or item.get('original_name') or '')
            title_score = SequenceMatcher(None, normalized_search, title).ratio()
            original_score = SequenceMatcher(None, normalized_search, original_title).ratio() if original_title else 0
            best_score = max(title_score, original_score)

            if normalized_search and (
                normalized_search in title
                or title in normalized_search
                or normalized_search in original_title
                or original_title in normalized_search
            ):
                best_score = max(best_score, 0.9)

            if best_score >= 0.55:
                popularity_score = float(item.get('popularity') or 0)
                scored_results.append((best_score + min(popularity_score / 1000, 0.05), item))

        scored_results.sort(key=lambda entry: entry[0], reverse=True)
        return [item for _, item in scored_results]

    def _normalize_text(self, value: str) -> str:
        return ''.join(character for character in value.lower() if character.isalnum() or character.isspace()).strip()

    def _dedupe_results(self, results: list[dict]) -> list[dict]:
        seen_keys: set[tuple[str, int, str]] = set()
        unique_results: list[dict] = []

        for item in results:
            title = (item.get('title') or item.get('name') or '').strip().lower()
            release_year = extract_release_year(item.get('release_date') or item.get('first_air_date'))
            media_type = item.get('media_type') or ('tv' if item.get('name') else 'movie')
            dedupe_key = (title, release_year, media_type)

            if dedupe_key in seen_keys:
                continue

            seen_keys.add(dedupe_key)
            unique_results.append(item)

        return unique_results

    def _get_blocked_terms(self, media_type: str) -> list[str]:
        if media_type == 'anime':
            return self.ANIME_BLOCKED_TERMS
        if media_type == 'tv':
            return self.TV_BLOCKED_TERMS
        return self.MOVIE_BLOCKED_TERMS

    def _normalize_media_item(self, item: dict, media_type: str) -> dict:
        normalized_item = dict(item)
        normalized_item['media_type'] = media_type
        normalized_item['title'] = item.get('title') or item.get('name') or ''
        normalized_item['original_title'] = item.get('original_title') or item.get('original_name') or normalized_item['title']
        normalized_item['release_date'] = item.get('release_date') or item.get('first_air_date') or ''
        normalized_item['runtime'] = item.get('runtime') or (item.get('episode_run_time') or [0])[0] or 0
        normalized_item['number_of_episodes'] = item.get('number_of_episodes') or 0
        return normalized_item

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
    if movie_data.get('media_type') == 'tv':
        content_ratings = movie_data.get('content_ratings', {}).get('results', [])
        for rating in content_ratings:
            if rating.get('iso_3166_1') == 'US' and rating.get('rating'):
                return rating['rating']
        return ''

    release_dates = movie_data.get('release_dates', {}).get('results', [])
    for release_group in release_dates:
        if release_group.get('iso_3166_1') != 'US':
            continue
        for item in release_group.get('release_dates') or []:
            certification = item.get('certification', '')
            if certification:
                return certification
    return ''


def extract_duration_minutes(movie_data: dict) -> int:
    runtime = movie_data.get('runtime')
    if runtime:
        return runtime

    episode_run_time = movie_data.get('episode_run_time') or []
    return episode_run_time[0] if episode_run_time else 0


def extract_country(movie_data: dict) -> str:
    production_countries = movie_data.get('production_countries') or []
    if production_countries:
        return production_countries[0].get('name', '')

    origin_country = movie_data.get('origin_country') or []
    return origin_country[0] if origin_country else ''


def sync_movie_from_tmdb(movie_data: dict) -> Movie:
    client = TmdbClient()

    movie, _ = Movie.objects.update_or_create(
        tmdb_id=movie_data['id'],
        media_type=movie_data.get('media_type', 'movie'),
        defaults={
            'title': movie_data.get('title', ''),
            'original_title': movie_data.get('original_title', ''),
            'description': movie_data.get('overview', ''),
            'release_year': extract_release_year(movie_data.get('release_date')),
            'duration_minutes': extract_duration_minutes(movie_data),
            'poster_url': client.image_url(movie_data.get('poster_path')),
            'background_url': client.image_url(movie_data.get('backdrop_path')),
            'country': extract_country(movie_data),
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
