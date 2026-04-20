from django.contrib.auth import get_user_model
from django.db import OperationalError, ProgrammingError
from rest_framework import serializers

from .models import UserFollow, UserProfile

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    email = serializers.SerializerMethodField()
    profile_picture_url = serializers.SerializerMethodField()
    followers_count = serializers.SerializerMethodField()
    following_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    is_friend = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'profile_picture_url',
            'followers_count',
            'following_count',
            'is_following',
            'is_friend',
        ]

    def get_email(self, obj):
        request = self.context.get('request')
        if request is None:
            return obj.email
        if request.user.is_authenticated and request.user == obj:
            return obj.email
        return ''

    def get_profile_picture_url(self, obj):
        profile, _ = UserProfile.objects.get_or_create(user=obj)
        return profile.profile_picture_url or None

    def get_followers_count(self, obj):
        try:
            return obj.follower_links.count()
        except (OperationalError, ProgrammingError):
            return 0

    def get_following_count(self, obj):
        try:
            return obj.following_links.count()
        except (OperationalError, ProgrammingError):
            return 0

    def get_is_following(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        if request.user == obj:
            return False
        try:
            return UserFollow.objects.filter(follower=request.user, following=obj).exists()
        except (OperationalError, ProgrammingError):
            return False

    def get_is_friend(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        if request.user == obj:
            return False
        try:
            return (
                UserFollow.objects.filter(follower=request.user, following=obj).exists()
                and UserFollow.objects.filter(follower=obj, following=request.user).exists()
            )
        except (OperationalError, ProgrammingError):
            return False


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password']

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class ProfileUpdateSerializer(serializers.ModelSerializer):
    profile_picture_url = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'profile_picture_url']

    def update(self, instance, validated_data):
        profile_picture_url = validated_data.pop('profile_picture_url', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if profile_picture_url is not None:
            profile, _ = UserProfile.objects.get_or_create(user=instance)
            profile.profile_picture_url = profile_picture_url
            profile.save(update_fields=['profile_picture_url'])

        return instance


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField()
    new_password = serializers.CharField(min_length=8)

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value

    def save(self, **kwargs):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save(update_fields=['password'])
        return user
