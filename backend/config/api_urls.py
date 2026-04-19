from django.urls import path, include
from .views import health_check

urlpatterns = [
    path('', include('movies.urls')),
    path('health/', health_check, name='health-check'),
]