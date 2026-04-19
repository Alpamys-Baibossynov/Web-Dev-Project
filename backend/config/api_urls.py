from django.urls import path, include
from .views import health_check

urlpatterns = [
    path('movies/', include('movies.urls')),
    path('genres/', include('movies.urls_genres')),
    path('auth/', include('users.urls')),
    path('watchlist/', include('watchlist.urls')),
    path('health/', health_check, name='health-check'),
]
