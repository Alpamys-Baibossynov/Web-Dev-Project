from django.urls import path
from .views import MovieListAPIView, MovieDetailAPIView, GenreListAPIView

urlpatterns = [
    path('genres/', GenreListAPIView.as_view()),
    path('', MovieListAPIView.as_view()),
    path('<int:pk>/', MovieDetailAPIView.as_view()),
]
