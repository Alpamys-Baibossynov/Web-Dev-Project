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
        
    def __str__(self):
        return f'{self.title} ({self.release_year})'

class UserMovie(models.Model):
    class Status(models.TextChoices):
        PLANNED = 'planned', 'Planned'
        WATCHED = 'watched', 'Watched'
        ABANDONED = 'abandoned', 'Abandoned'
        
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