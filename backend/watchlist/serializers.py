from django.utils import timezone
from rest_framework import serializers

from movies.models import Movie, UserMovie
from movies.serializers import GenreSerializer
from movies.tmdb import TmdbClient, sync_movie_from_tmdb


class WatchlistMovieSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='tmdb_id', read_only=True)
    genres = GenreSerializer(many=True, read_only=True)
    media_type = serializers.CharField(read_only=True)

    class Meta:
        model = Movie
        fields = [
            'id',
            'media_type',
            'title',
            'original_title',
            'release_year',
            'duration_minutes',
            'poster_url',
            'country',
            'age_rating',
            'genres',
        ]


class UserMovieSerializer(serializers.ModelSerializer):
    movie = WatchlistMovieSerializer(read_only=True)
    movie_id = serializers.IntegerField(write_only=True, required=False)
    media_type = serializers.CharField(write_only=True, required=False, default='movie')

    class Meta:
        model = UserMovie
        fields = [
            'id',
            'movie',
            'movie_id',
            'media_type',
            'status',
            'mood',
            'rating',
            'review',
            'watched_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context['request']
        movie_id = attrs.pop('movie_id', None)
        media_type = attrs.pop('media_type', getattr(getattr(self.instance, 'movie', None), 'media_type', 'movie'))
        movie = attrs.get('movie') or getattr(self.instance, 'movie', None)

        if movie_id is not None:
            movie = Movie.objects.filter(tmdb_id=movie_id, media_type=media_type).first()
            if movie is None:
                movie_data = TmdbClient().get_movie_detail(movie_id, media_type)
                movie = sync_movie_from_tmdb(movie_data)
            attrs['movie'] = movie

        if self.instance is None and movie is not None:
            duplicate_exists = UserMovie.objects.filter(
                user=request.user,
                movie=movie,
            ).exists()
            if duplicate_exists:
                raise serializers.ValidationError(
                    {'movie_id': 'This movie is already in your library.'}
                )

        status_value = attrs.get('status', getattr(self.instance, 'status', None))
        watched_at = attrs.get('watched_at', getattr(self.instance, 'watched_at', None))

        if status_value == UserMovie.Status.WATCHED and watched_at is None:
            attrs['watched_at'] = timezone.now()

        if status_value != UserMovie.Status.WATCHED and 'watched_at' not in attrs:
            attrs['watched_at'] = None

        return attrs

    def create(self, validated_data):
        return UserMovie.objects.create(user=self.context['request'].user, **validated_data)
