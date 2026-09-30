from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .models import (
    Programme, Profile, FYPProject, TimetableBooking, 
    TimetableSlot, PresentationDay, Venue,
    Announcements, Feedback, Submissions, 
    MilestoneForms, MilestoneEntries, SupervisorQuotas
)

@admin.action(description='Create placeholder FYP Project for selected students')
def create_placeholder_projects(modeladmin, request, queryset):
    created_count = 0
    for user in queryset:
        if hasattr(user, 'profile') and user.profile.role == 'student':
            project, created = FYPProject.objects.get_or_create(
                student=user,
                defaults={
                    'title': 'Pending TRF Submission',
                    'student_matric_id': user.profile.student_id_no or user.username,
                    'fyp_stage': 'FYP1',
                    'programme': user.profile.programme
                }
            )
            if created:
                created_count += 1
    modeladmin.message_user(request, f'Successfully created {created_count} new placeholder projects.', 'success')

class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    verbose_name_plural = 'User Profile'
    fk_name = 'user'

class CustomUserAdmin(BaseUserAdmin):
    inlines = (ProfileInline, )
    list_display = ('username', 'get_full_name_from_profile', 'email', 'is_staff', 'get_role_from_profile')
    list_filter = ('profile__role', 'is_staff', 'is_superuser', 'profile__programme')
    actions = [create_placeholder_projects]

    @admin.display(description='Full Name')
    def get_full_name_from_profile(self, instance):
        if hasattr(instance, 'profile'):
            return instance.profile.full_name
        return ""

    @admin.display(description='Role')
    def get_role_from_profile(self, instance):
        if hasattr(instance, 'profile'):
            return instance.profile.role
        return ""

admin.site.unregister(User)
admin.site.register(User, CustomUserAdmin)

@admin.register(FYPProject)
class FYPProjectAdmin(admin.ModelAdmin):
    list_display = ('title', 'student', 'supervisor', 'programme')
    list_filter = ('supervisor', 'examiner', 'programme')
    search_fields = ('title', 'student__username', 'student__profile__full_name')

@admin.register(Programme)
class ProgrammeAdmin(admin.ModelAdmin):
    list_display = ('code', 'name')
    search_fields = ('code', 'name')

@admin.register(TimetableBooking)
class TimetableBookingAdmin(admin.ModelAdmin):
    list_display = ('project', 'lecturer', 'start_time', 'venue')
    list_filter = ('venue', 'lecturer')

@admin.register(TimetableSlot)
class TimetableSlotAdmin(admin.ModelAdmin):
    list_display = ('project', 'start_time', 'venue')

@admin.register(PresentationDay)
class PresentationDayAdmin(admin.ModelAdmin):
    list_display = ('date', 'programme')
    list_filter = ('programme',)

@admin.register(Announcements)
class AnnouncementsAdmin(admin.ModelAdmin):
    list_display = ('title', 'coordinator', 'created_at')

@admin.register(Submissions)
class SubmissionsAdmin(admin.ModelAdmin):
    list_display = ('proposed_project_title', 'student_name', 'status', 'created_at')
    list_filter = ('status', 'programme')

@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ('submission', 'lecturer', 'created_at')

@admin.register(MilestoneForms)
class MilestoneFormsAdmin(admin.ModelAdmin):
    list_display = ('student_name', 'fyp_title', 'lecturer')

admin.site.register(MilestoneEntries)
admin.site.register(SupervisorQuotas)
admin.site.register(Venue)