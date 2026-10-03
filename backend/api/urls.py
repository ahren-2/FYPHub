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
    get_fyp_stages_for_programme, get_student_dashboard_data,
    PresentationDayViewSet, VenueViewSet, sync_missing_projects
)

router = DefaultRouter()
router.register(r'programmes', ProgrammeViewSet, basename='programme')
router.register(r'users', UserViewSet, basename='user')
router.register(r'projects', FYPProjectViewSet, basename='project')
router.register(r'student-list', StudentListViewSet, basename='student-list')
router.register(r'bookings', TimetableBookingViewSet, basename='booking')
router.register(r'slots', TimetableSlotViewSet, basename='slot')
router.register(r'presentation-slots', PresentationSlotViewSet, basename='presentationslot')
# Presentation dates and venues. TimetableScheduling.js and MyAvailabilityPage.js
# have always called these two endpoints, but no route ever existed for them, so
# both pages failed to load their grid and a coordinator could not add a
# presentation day or venue at all.
router.register(r'presentation-days', PresentationDayViewSet, basename='presentationday')
router.register(r'venues', VenueViewSet, basename='venue')
router.register(r'milestones', MilestoneFormsViewSet, basename='milestone')
router.register(r'announcements', AnnouncementViewSet, basename='announcement')
router.register(r'feedback', FeedbackViewSet, basename='feedback')
router.register(r'submissions', SubmissionViewSet, basename='submission')
router.register(r'rubric-templates', RubricTemplateViewSet, basename='rubrictemplate')
router.register(r'rubric-marks', RubricMarksViewSet, basename='rubricmarks')

urlpatterns = [
    path('', include(router.urls)),
    
    path('user/me/', CurrentUserView.as_view(), name='current_user'),
    # The student dashboard tile. It was written but never routed, so the endpoint
    # the frontend calls answered 404.
    path('student-dashboard/<int:student_id>/', get_student_dashboard_data, name='student-dashboard'),
    path('export-to-sheet/', export_to_google_sheet, name='export-to-sheet'),
    path('export-students-excel/', export_students_excel, name='export-excel'),
    path('send-notification/', send_initial_notification, name='send-notification'),
    path('run-scheduler/', run_auto_scheduler, name='run-scheduler'),
    path('clear-schedule/', clear_schedule, name='clear-schedule'),
    path('upload-excel/', ExcelUploadView.as_view(), name='upload-excel'),
    path('overview/summary/', get_overview_summary, name='summary'),
    path('my-quota/', get_my_quota, name='my-quota'),
    path('supervisors/quotas/', get_supervisor_quotas, name='supervisor-quotas'),
    # `bulk-update` must be matched before the `<int:lecturer_id>` pattern below.
    # Django resolves in order, so with the two the other way round a request to
    # supervisors/quotas/bulk-update/ was captured by the detail route as a
    # non-integer id and failed to resolve — the Bulk Edit button on the quota
    # screen could only ever return 404.
    path('supervisors/quotas/bulk-update/', bulk_update_quotas, name='bulk-update-quotas'),
    path('supervisors/quotas/<int:lecturer_id>/', update_supervisor_quota, name='update-supervisor-quota'),
    path('supervisors/students/<int:lecturer_id>/', get_supervisor_students, name='supervisor-students'),
    path('eligible-supervisors/', get_eligible_supervisors, name='eligible-supervisors'),
    path('lecturer-preferences/', LecturerPreferenceView.as_view(), name='lecturer-preferences'),
    path('auto-assign-examiners/', auto_assign_examiners, name='auto-assign-examiners'),
    path('sync-project-programmes/', sync_project_programmes, name='sync-project-programmes'),
    # Written but never routed, like the student dashboard above. It is the
    # coordinator's repair for a student who has no project row — without it the
    # student is missing from the Student List and cannot submit a TRF.
    path('sync-missing-projects/', sync_missing_projects, name='sync-missing-projects'),
    path('programme-fyp-stages/', get_fyp_stages_for_programme, name='programme-fyp-stages'),
]