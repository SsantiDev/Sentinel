from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from interfaces.http.views.config_views import SentinelTokenObtainPairView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('interfaces.http.urls')),
    path('api/v1/auth/token/', SentinelTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/v1/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
