from django.urls import path, include
from rest_framework.routers import DefaultRouter
from interfaces.http.views.service_views import ServiceViewSet, CheckResultViewSet, AlertRuleViewSet

router = DefaultRouter()
router.register('services', ServiceViewSet, basename='service')
router.register('checks', CheckResultViewSet, basename='check')
router.register('alert-rules', AlertRuleViewSet, basename='alert-rule')

urlpatterns = [
    path('', include(router.urls)),
]
