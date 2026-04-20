from django.urls import path

from .views import PublicUserMovieListAPIView, UserMovieDetailAPIView, UserMovieListCreateAPIView


urlpatterns = [
    path('', UserMovieListCreateAPIView.as_view(), name='watchlist-list-create'),
    path('<int:pk>/', UserMovieDetailAPIView.as_view(), name='watchlist-detail'),
    path('users/<str:username>/', PublicUserMovieListAPIView.as_view(), name='watchlist-public-user-list'),
]
