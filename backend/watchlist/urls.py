from django.urls import path

from .views import UserMovieDetailAPIView, UserMovieListCreateAPIView


urlpatterns = [
    path('', UserMovieListCreateAPIView.as_view(), name='watchlist-list-create'),
    path('<int:pk>/', UserMovieDetailAPIView.as_view(), name='watchlist-detail'),
]
