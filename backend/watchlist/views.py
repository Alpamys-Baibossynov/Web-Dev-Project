from rest_framework import generics, permissions

from movies.models import UserMovie

from .serializers import UserMovieSerializer


class UserMovieListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = UserMovieSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = (
            UserMovie.objects.filter(user=self.request.user)
            .select_related('movie')
            .prefetch_related('movie__genres')
        )
        status_value = self.request.query_params.get('status')
        movie_tmdb_id = self.request.query_params.get('movie')
        media_type = self.request.query_params.get('media_type')

        if status_value:
            queryset = queryset.filter(status=status_value)

        if movie_tmdb_id:
            queryset = queryset.filter(movie__tmdb_id=movie_tmdb_id)

        if media_type:
            queryset = queryset.filter(movie__media_type=media_type)

        return queryset


class UserMovieDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = UserMovieSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            UserMovie.objects.filter(user=self.request.user)
            .select_related('movie')
            .prefetch_related('movie__genres')
        )


class PublicUserMovieListAPIView(generics.ListAPIView):
    serializer_class = UserMovieSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = (
            UserMovie.objects.filter(user__username=self.kwargs['username'])
            .select_related('movie', 'user')
            .prefetch_related('movie__genres')
        )
        status_value = self.request.query_params.get('status')
        media_type = self.request.query_params.get('media_type')

        if status_value:
            queryset = queryset.filter(status=status_value)

        if media_type:
            queryset = queryset.filter(movie__media_type=media_type)

        return queryset
