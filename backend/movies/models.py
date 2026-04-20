from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator

class Genre(models.Model):
    name = models.CharField(max_length=100, unique=True)
    
    class Meta:
        ordering = ["name"]
        
    def __str__(self):
        return self.name
    
class Movie(models.Model):
    class MediaType(models.TextChoices):
        MOVIE = 'movie', 'Movie'
        TV = 'tv', 'TV Show'
        ANIME = 'anime', 'Anime'

    tmdb_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    media_type = models.CharField(
        max_length=20,
        choices=MediaType.choices,
        default=MediaType.MOVIE,
    )
    title = models.CharField(max_length=255)
    original_title = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    release_year = models.PositiveIntegerField()
    duration_minutes = models.PositiveIntegerField()
    poster_url = models.URLField(blank=True)
    background_url = models.URLField(blank=True)
    country = models.CharField(max_length=100, blank=True)
    age_rating = models.CharField(max_length=20, blank=True)
    genres = models.ManyToManyField(Genre, related_name='movies', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-release_year', 'title']
        constraints = [
            models.UniqueConstraint(
                fields=["tmdb_id", "media_type"],
                name="unique_tmdb_media_item",
            )
        ]
        
    def __str__(self):
        return f'{self.title} ({self.release_year})'

class UserMovie(models.Model):
    class Status(models.TextChoices):
        PLANNED = 'planned', 'Planned'
        CURRENTLY_WATCHING = 'currently_watching', 'Currently watching'
        WATCHED = 'watched', 'Watched'
        ABANDONED = 'abandoned', 'Abandoned'

    class Mood(models.TextChoices):
        BORED = 'bored', 'Bored'
        SCARED = 'scared', 'Scared'
        EXCITED = 'excited', 'Excited'
        THOUGHTFUL = 'thoughtful', 'Thoughtful'
        CALM = 'calm', 'Calm'
        COMFORTED = 'comforted', 'Calm'
        TENSE = 'tense', 'Tense'
        SAD = 'sad', 'Sad'
        
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="user_movies"
    )
    movie = models.ForeignKey(
        Movie,
        on_delete=models.CASCADE,
        related_name="user_movies",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PLANNED,
    )
    mood = models.CharField(
        max_length=20,
        choices=Mood.choices,
        blank=True,
    )
    rating = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(10)],
    )
    review = models.TextField(blank=True)
    watched_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "movie"],
                name="unique_user_movie",
            )
        ]
        
    def __str__(self):
        return f"{self.user} - {self.movie} ({self.status})"
