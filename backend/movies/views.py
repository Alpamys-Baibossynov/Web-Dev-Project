from rest_framework import generics
from rest_framework.response import Response

from .models import Movie
from .serializers import GenreSerializer, TmdbMovieDetailSerializer, TmdbMovieListSerializer
from .tmdb import TmdbClient, sync_movie_from_tmdb

class MovieListAPIView(generics.ListAPIView):
    queryset = Movie.objects.none()
    serializer_class = TmdbMovieListSerializer

    def list(self, request, *args, **kwargs):
        page = int(request.query_params.get('page', 1))
        search = request.query_params.get('search', '').strip()
        genre_id = request.query_params.get('genres', '').strip()
        client = TmdbClient()
        genres = client.get_genres()
        genre_lookup = {genre['id']: genre['name'] for genre in genres}
        payload = client.get_movies(page=page, search=search, genre_id=genre_id)
        current_page = payload.get('page', 1)
        total_pages = payload.get('total_pages', 1)
        serializer = self.get_serializer(
            payload.get('results', []),
            many=True,
            context={'genre_lookup': genre_lookup},
        )
        return Response(
            {
                'count': payload.get('total_results', 0),
                'next': request.build_absolute_uri(f'?page={current_page + 1}') if current_page < total_pages else None,
                'previous': request.build_absolute_uri(f'?page={current_page - 1}') if current_page > 1 else None,
                'results': serializer.data,
            }
        )
    
class MovieDetailAPIView(generics.RetrieveAPIView):
    queryset = Movie.objects.none()
    serializer_class = TmdbMovieDetailSerializer

    def retrieve(self, request, *args, **kwargs):
        movie_data = TmdbClient().get_movie_detail(kwargs['pk'])
        sync_movie_from_tmdb(movie_data)
        serializer = self.get_serializer(movie_data)
        return Response(serializer.data)
    
class GenreListAPIView(generics.ListAPIView):
    serializer_class = GenreSerializer

    def list(self, request, *args, **kwargs):
        return Response(TmdbClient().get_genres())
