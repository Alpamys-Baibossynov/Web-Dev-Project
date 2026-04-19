from django.contrib import admin
from .models import Genre, Movie, UserMovie

@admin.register(Genre)
class GenreAdmin(admin.ModelAdmin):
    search_fields = ["name"]


@admin.register(Movie)
class MovieAdmin(admin.ModelAdmin):
    list_display = ["title", "release_year", "duration_minutes", "country", 'get_genres']
    search_fields = ["title", "original_title"]
    list_filter = ["release_year", "genres"]
    ordering = ["-release_year", "title"]
    
    def get_genres(self, obj):
        return ", ".join(genre.name for genre in obj.genres.all())
    get_genres.short_description = "Genres"


@admin.register(UserMovie)
class UserMovieAdmin(admin.ModelAdmin):
    list_display = ["user", "movie", "status", "rating", "watched_at"]
    search_fields = ["user__username", "movie__title"]
    list_filter = ["status", "watched_at"]