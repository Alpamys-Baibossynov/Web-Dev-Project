from django.urls import path
from .views import MovieListAPIView, MovieDetailAPIView, GenreListAPIView

urlpatterns = [
    path('movies/', MovieListAPIView.as_view()),
    path('movies/<int:pk>/', MovieDetailAPIView.as_view()),
    path('genres/', GenreListAPIView.as_view()),
]