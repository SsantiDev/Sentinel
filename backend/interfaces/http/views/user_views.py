from django.contrib.auth.models import User
from rest_framework import viewsets, permissions
from interfaces.http.serializers.user_serializer import UserSerializer, UserCreateUpdateSerializer

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('-date_joined')
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return UserCreateUpdateSerializer
        return UserSerializer

    def get_queryset(self):
        # Solo permitimos que el SuperAdmin gestione otros usuarios
        if self.request.user.is_superuser:
            return User.objects.all().order_by('-date_joined')
        # Si es solo staff, tal vez solo pueda verse a sí mismo (o nada)
        return User.objects.filter(id=self.request.user.id)
