from rest_framework import serializers
from infrastructure.models import BlockedIPModel

class BlockedIPSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlockedIPModel
        fields = '__all__'
