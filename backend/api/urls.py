from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProgrammeViewSet, UserViewSet, FYPProjectViewSet, TimetableBookingViewSet,
    TimetableSlotViewSet, PresentationSlotViewSet, StudentListViewSet,
    SubmissionViewSet, MilestoneFormsViewSet, AnnouncementViewSet, FeedbackViewSet,
    CurrentUserView, export_to_google_sheet, export_students_excel,
    send_initial_notification, run_auto_scheduler, clear_schedule,
    ExcelUploadView, get_overview_summary, get_supervisor_quotas,
    get_supervisor_students, update_supervisor_quota, bulk_update_quotas,
    get_my_quota,
    get_eligible_supervisors, LecturerPreferenceView, auto_assign_examiners,
    RubricTemplateViewSet, RubricMarksViewSet, sync_project_programmes,
    get_fyp_stages_for_programme
)

router = DefaultRouter()
router.register(r'programmes', ProgrammeViewSet, basename='programme')
router.register(r'users', UserViewSet, basename='user')
router.register(r'projects', FYPProjectViewSet, basename='project')
router.register(r'student-list', StudentListViewSet, basename='student-list')
router.register(r'bookings', TimetableBookingViewSet, basename='booking')
router.register(r'slots', TimetableSlotViewSet, basename='slot')
router.register(r'presentation-slots', PresentationSlotViewSet, basename='presentationslot')
router.register(r'milestones', MilestoneFormsViewSet, basename='milestone')
router.register(r'announcements', AnnouncementViewSet, basename='announcement')
router.register(r'feedback', FeedbackViewSet, basename='feedback')
router.register(r'submissions', SubmissionViewSet, basename='submission')
router.register(r'rubric-templates', RubricTemplateViewSet, basename='rubrictemplate')
router.register(r'rubric-marks', RubricMarksViewSet, basename='rubricmarks')

urlpatterns = [
    path('', include(router.urls)),
    
    path('user/me/', CurrentUserView.as_view(), name='current_user'),
    path('export-to-sheet/', export_to_google_sheet, name='export-to-sheet'),
    path('export-students-excel/', export_students_excel, name='export-excel'),
    path('send-notification/', send_initial_notification, name='send-notification'),
    path('run-scheduler/', run_auto_scheduler, name='run-scheduler'),
    path('clear-schedule/', clear_schedule, name='clear-schedule'),
    path('upload-excel/', ExcelUploadView.as_view(), name='upload-excel'),
    path('overview/summary/', get_overview_summary, name='summary'),
    path('my-quota/', get_my_quota, name='my-quota'),
    path('supervisors/quotas/', get_supervisor_quotas, name='supervisor-quotas'),
    path('supervisors/students/<int:lecturer_id>/', get_supervisor_students, name='supervisor-students'),
    path('supervisors/quotas/<int:lecturer_id>/', update_supervisor_quota, name='update-supervisor-quota'),
    path('supervisors/quotas/bulk-update/', bulk_update_quotas, name='bulk-update-quotas'),
    path('eligible-supervisors/', get_eligible_supervisors, name='eligible-supervisors'),
    path('lecturer-preferences/', LecturerPreferenceView.as_view(), name='lecturer-preferences'),
    path('auto-assign-examiners/', auto_assign_examiners, name='auto-assign-examiners'),
    path('sync-project-programmes/', sync_project_programmes, name='sync-project-programmes'),
    path('programme-fyp-stages/', get_fyp_stages_for_programme, name='programme-fyp-stages'),
]