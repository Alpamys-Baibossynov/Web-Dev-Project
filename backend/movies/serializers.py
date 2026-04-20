from rest_framework import serializers
from .models import Movie, Genre
from .tmdb import TmdbClient, extract_age_rating, extract_country, extract_duration_minutes, extract_release_year

class GenreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Genre
        fields = ['id', 'name']
        
class MovieListSerializer(serializers.ModelSerializer):
    genres = GenreSerializer(many=True)

    class Meta:
        model = Movie
        fields = [
            'id',
            'title',
            'original_title',
            'release_year',
            'duration_minutes',
            'poster_url',
            'country',
            'age_rating',
            'genres',
        ]
        
class MovieDetailSerializer(serializers.ModelSerializer):
    genres = GenreSerializer(many=True)

    class Meta:
        model = Movie
        fields = '__all__'


class TmdbMovieListSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    media_type = serializers.CharField()
    title = serializers.CharField()
    original_title = serializers.CharField(allow_blank=True)
    release_year = serializers.SerializerMethodField()
    poster_url = serializers.SerializerMethodField()
    country = serializers.SerializerMethodField()
    age_rating = serializers.CharField(default='', allow_blank=True)
    genres = serializers.SerializerMethodField()

    def get_release_year(self, obj):
        return extract_release_year(obj.get('release_date'))

    def get_poster_url(self, obj):
        return TmdbClient().image_url(obj.get('poster_path'))

    def get_country(self, obj):
        return ''

    def get_genres(self, obj):
        genre_lookup = self.context.get('genre_lookup', {})
        return [
            {'id': genre_id, 'name': genre_lookup[genre_id]}
            for genre_id in obj.get('genre_ids', [])
            if genre_id in genre_lookup
        ]


class TmdbMovieDetailSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    media_type = serializers.CharField()
    title = serializers.CharField()
    original_title = serializers.CharField(allow_blank=True)
    description = serializers.CharField(source='overview', allow_blank=True)
    release_year = serializers.SerializerMethodField()
    duration_minutes = serializers.SerializerMethodField()
    total_episodes = serializers.SerializerMethodField()
    poster_url = serializers.SerializerMethodField()
    background_url = serializers.SerializerMethodField()
    country = serializers.SerializerMethodField()
    age_rating = serializers.SerializerMethodField()
    genres = GenreSerializer(many=True)
    created_at = serializers.CharField(default='', allow_blank=True)
    updated_at = serializers.CharField(default='', allow_blank=True)

    def get_release_year(self, obj):
        return extract_release_year(obj.get('release_date'))

    def get_duration_minutes(self, obj):
        return extract_duration_minutes(obj)

    def get_total_episodes(self, obj):
        return obj.get('number_of_episodes') or 0

    def get_poster_url(self, obj):
        return TmdbClient().image_url(obj.get('poster_path'))

    def get_background_url(self, obj):
        return TmdbClient().image_url(obj.get('backdrop_path'))

    def get_country(self, obj):
        return extract_country(obj)

    def get_age_rating(self, obj):
        return extract_age_rating(obj)
