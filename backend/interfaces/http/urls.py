from django.urls import path, include
from rest_framework.routers import DefaultRouter
from interfaces.http.views.service_views import (
    ServiceViewSet, CheckResultViewSet, AlertRuleViewSet, ServiceDependencyViewSet,
)
from interfaces.http.views.config_views import GlobalConfigView, ProfileUpdateView
from interfaces.http.views.user_views import UserViewSet
from interfaces.http.views.security_views import BlockedIPViewSet
from interfaces.http.views.public_views import PublicCheckView
from interfaces.http.views.scheduler_views import SchedulerStatusView
from interfaces.http.views.log_views import LogTailView
from interfaces.http.views.transaction_views import (
    TransactionIngestView, TransactionAnomalyViewSet, DetectionConfigView,
    TransactionSimulateView,
)

router = DefaultRouter()
router.register('services', ServiceViewSet, basename='service')
router.register('checks', CheckResultViewSet, basename='check')
router.register('alert-rules', AlertRuleViewSet, basename='alert-rule')
router.register('service-dependencies', ServiceDependencyViewSet, basename='service-dependency')
router.register('users', UserViewSet, basename='user')
router.register('blocked-ips', BlockedIPViewSet, basename='blocked-ip')
router.register('transaction-anomalies', TransactionAnomalyViewSet, basename='transaction-anomaly')

urlpatterns = [
    path('', include(router.urls)),
    path('settings/global/', GlobalConfigView.as_view(), name='global-settings'),
    path('settings/profile/password/', ProfileUpdateView.as_view(), name='profile-password'),
    path('public/check/', PublicCheckView.as_view(), name='public-check'),
    path('scheduler/status/', SchedulerStatusView.as_view(), name='scheduler-status'),
    path('logs/tail/', LogTailView.as_view(), name='logs-tail'),
    path('transactions/', TransactionIngestView.as_view(), name='transactions-ingest'),
    path('transactions/simulate/', TransactionSimulateView.as_view(), name='transactions-simulate'),
    path('detection-config/', DetectionConfigView.as_view(), name='detection-config'),
]
