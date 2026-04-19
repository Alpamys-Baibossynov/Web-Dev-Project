from django.urls import path

from .views import GenreListAPIView


urlpatterns = [
    path('', GenreListAPIView.as_view(), name='genre-list'),
]
