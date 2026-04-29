from django.contrib import admin, messages
from django.contrib.auth.models import User, Group
from django.utils.html import format_html
from infrastructure.models import ServiceModel, CheckResultModel

admin.site.unregister(User)
admin.site.unregister(Group)


def _last_check(service):
    return service.checks.first()


@admin.register(ServiceModel)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ['name', 'url', 'is_active', 'status_badge', 'last_response_ms', 'last_checked_at', 'check_interval_seconds']
    list_filter = ['is_active']
    search_fields = ['name', 'url']
    actions = ['ping_now', 'activate_services', 'deactivate_services']

    @admin.display(description='Estado')
    def status_badge(self, obj):
        check = _last_check(obj)
        if not check:
            return format_html('<span style="color:#888">— sin datos</span>')
        if check.status == 'up':
            return format_html('<span style="color:#2ecc71;font-weight:bold">● UP</span>')
        if check.status == 'down':
            return format_html('<span style="color:#e74c3c;font-weight:bold">● DOWN</span>')
        return format_html('<span style="color:#f39c12">● {}</span>', check.status)

    @admin.display(description='Resp. (ms)')
    def last_response_ms(self, obj):
        check = _last_check(obj)
        if not check or check.response_time_ms is None:
            return '—'
        return f'{check.response_time_ms:.0f} ms'

    @admin.display(description='Último ping')
    def last_checked_at(self, obj):
        check = _last_check(obj)
        if not check:
            return '—'
        return check.checked_at.strftime('%d/%m %H:%M:%S')

    @admin.action(description='Ping ahora')
    def ping_now(self, request, queryset):
        from infrastructure.tasks.ping_tasks import ping_service_task
        count = 0
        for service in queryset:
            ping_service_task.delay(service.pk)
            count += 1
        self.message_user(request, f'{count} ping(s) encolado(s). Refresca en unos segundos.', messages.SUCCESS)

    @admin.action(description='Activar servicios')
    def activate_services(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} servicio(s) activado(s).', messages.SUCCESS)

    @admin.action(description='Desactivar servicios')
    def deactivate_services(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} servicio(s) desactivado(s).', messages.WARNING)


@admin.register(CheckResultModel)
class CheckResultAdmin(admin.ModelAdmin):
    list_display = ['service', 'status_badge', 'response_time_ms', 'status_code', 'error_message', 'checked_at']
    list_filter = ['status', 'service']
    readonly_fields = ['service', 'status', 'response_time_ms', 'status_code', 'error_message', 'checked_at']

    @admin.display(description='Estado')
    def status_badge(self, obj):
        if obj.status == 'up':
            return format_html('<span style="color:#2ecc71;font-weight:bold">● UP</span>')
        if obj.status == 'down':
            return format_html('<span style="color:#e74c3c;font-weight:bold">● DOWN</span>')
        return format_html('<span style="color:#f39c12">● {}</span>', obj.status)
