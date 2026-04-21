from django.contrib.auth import get_user_model
from django.contrib.auth import authenticate
from rest_framework import generics, permissions, status
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import UserFollow
from .serializers import ChangePasswordSerializer, ProfileUpdateSerializer, RegisterSerializer, UserSerializer


User = get_user_model()


class RegisterAPIView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        headers = self.get_success_headers(serializer.data)
        return Response(
            {
                'user': UserSerializer(user).data,
                'token': token.key,
            },
            status=status.HTTP_201_CREATED,
            headers=headers,
        )


class LoginAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        user = authenticate(
            request,
            username=request.data.get('username'),
            password=request.data.get('password'),
        )
        if user is None:
            return Response(
                {'detail': 'Invalid credentials'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                'token': token.key,
                'user': UserSerializer(user).data,
            }
        )


class CurrentUserAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user, context={'request': request}).data)


class ChangePasswordAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        Token.objects.filter(user=user).delete()
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                'token': token.key,
                'user': UserSerializer(user).data,
            }
        )


class LogoutAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PublicUserAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, username):
        user = generics.get_object_or_404(User, username=username)
        return Response(UserSerializer(user, context={'request': request}).data)


class PublicUserListAPIView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = UserSerializer

    def get_queryset(self):
        queryset = User.objects.all().order_by('username')
        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(username__icontains=search)
        return queryset[:20]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class FollowListAPIView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    def get_queryset(self):
        relationship = self.kwargs['relationship']
        if relationship == 'followers':
            return User.objects.filter(following_links__following=self.request.user).order_by('username')
        return User.objects.filter(follower_links__follower=self.request.user).order_by('username')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class UserFollowAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, username):
        user_to_follow = generics.get_object_or_404(User, username=username)
        if user_to_follow == request.user:
            return Response(
                {'detail': 'You cannot follow yourself'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        UserFollow.objects.get_or_create(follower=request.user, following=user_to_follow)
        return Response(UserSerializer(user_to_follow, context={'request': request}).data)

    def delete(self, request, username):
        user_to_unfollow = generics.get_object_or_404(User, username=username)
        UserFollow.objects.filter(follower=request.user, following=user_to_unfollow).delete()
        return Response(UserSerializer(user_to_unfollow, context={'request': request}).data)
