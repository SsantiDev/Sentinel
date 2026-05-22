from django.urls import path, include
from rest_framework.routers import DefaultRouter
from interfaces.http.views.service_views import ServiceViewSet, CheckResultViewSet, AlertRuleViewSet
from interfaces.http.views.config_views import GlobalConfigView, ProfileUpdateView
from interfaces.http.views.user_views import UserViewSet
from interfaces.http.views.security_views import BlockedIPViewSet
from interfaces.http.views.public_views import PublicCheckView

router = DefaultRouter()
router.register('services', ServiceViewSet, basename='service')
router.register('checks', CheckResultViewSet, basename='check')
router.register('alert-rules', AlertRuleViewSet, basename='alert-rule')
router.register('users', UserViewSet, basename='user')
router.register('blocked-ips', BlockedIPViewSet, basename='blocked-ip')

urlpatterns = [
    path('', include(router.urls)),
    path('settings/global/', GlobalConfigView.as_view(), name='global-settings'),
    path('settings/profile/password/', ProfileUpdateView.as_view(), name='profile-password'),
    path('public/check/', PublicCheckView.as_view(), name='public-check'),
]
