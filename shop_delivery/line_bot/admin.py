from django.contrib import admin
from .models import LineBotUser, LineMessage, LineNotification


# LINE Bot User Admin
@admin.register(LineBotUser)
class LineBotUserAdmin(admin.ModelAdmin):
    list_display = ('line_user_id', 'display_name', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('line_user_id', 'display_name')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)
    list_editable = ('is_active',)


# LINE Message Admin
@admin.register(LineMessage)
class LineMessageAdmin(admin.ModelAdmin):
    list_display = ('recipient', 'message_type', 'is_sent', 'sent_at', 'created_at')
    list_filter = ('message_type', 'is_sent', 'created_at')
    search_fields = ('recipient__display_name', 'content')
    readonly_fields = ('created_at', 'sent_at')
    ordering = ('-created_at',)


# LINE Notification Admin
@admin.register(LineNotification)
class LineNotificationAdmin(admin.ModelAdmin):
    list_display = ('recipient', 'notification_type', 'order', 'is_sent', 'sent_at', 'created_at')
    list_filter = ('notification_type', 'is_sent', 'created_at')
    search_fields = ('recipient__display_name', 'message', 'order__id')
    readonly_fields = ('created_at', 'sent_at')
    ordering = ('-created_at',)