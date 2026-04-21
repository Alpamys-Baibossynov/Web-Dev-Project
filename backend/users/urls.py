from django.urls import path

from .views import (
    ChangePasswordAPIView,
    CurrentUserAPIView,
    FollowListAPIView,
    LoginAPIView,
    LogoutAPIView,
    PublicUserAPIView,
    PublicUserListAPIView,
    RegisterAPIView,
    UserFollowAPIView,
)


urlpatterns = [
    path('register/', RegisterAPIView.as_view(), name='auth-register'),
    path('login/', LoginAPIView.as_view(), name='auth-login'),
    path('logout/', LogoutAPIView.as_view(), name='auth-logout'),
    path('me/', CurrentUserAPIView.as_view(), name='auth-me'),
    path('change-password/', ChangePasswordAPIView.as_view(), name='auth-change-password'),
    path('me/<str:relationship>/', FollowListAPIView.as_view(), name='auth-follow-list'),
    path('users/', PublicUserListAPIView.as_view(), name='auth-public-user-list'),
    path('users/<str:username>/', PublicUserAPIView.as_view(), name='auth-public-user'),
    path('users/<str:username>/follow/', UserFollowAPIView.as_view(), name='auth-user-follow'),
]
