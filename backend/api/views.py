from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from django.core.mail import send_mail
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q
from django.db.models import Case, When, Value
from django.conf import settings
from django.utils import timezone
import gspread
import random
from oauth2client.service_account import ServiceAccountCredentials
import os
import pandas as pd
import numpy as np
from datetime import datetime, time, timedelta

import io
from django.http import HttpResponse

from .models import (
    Programme, Profile, FYPProject, TimetableBooking, 
    TimetableSlot, PresentationDay, Venue, PresentationSlot,
    Submissions, Feedback, MilestoneForms, MilestoneEntries, SupervisorQuotas,
    Announcements, LecturerPreference, RubricTemplate, RubricMarks
)
from .serializers import (
    ProgrammeSerializer, UserSerializer, UserWriteSerializer, FYPProjectSerializer, 
    TimetableBookingSerializer, TimetableSlotSerializer, PresentationSlotSerializer,
    SubmissionSerializer, FeedbackSerializer, 
    MilestoneFormsSerializer, MilestoneEntriesSerializer, AnnouncementSerializer,
    LecturerPreferenceSerializer, RubricTemplateSerializer, RubricMarksSerializer 
)

print("<<<<< LOADING LATEST views.py - VERSION FINAL >>>>>")

# Starting password for accounts created from a spreadsheet. Kept in step with
# serializers.DEFAULT_NEW_USER_PASSWORD and migration 0015.
BULK_UPLOAD_PASSWORD = 'wow12345'

class ProgrammeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ProgrammeSerializer
    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'profile') and user.profile.role == 'coordinator' and user.profile.programme:
            return Programme.objects.filter(id=user.profile.programme.id)
        return Programme.objects.all()

class PresentationSlotViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = PresentationSlotSerializer

    def get_queryset(self):
        user_programme = self.request.user.profile.programme
        return PresentationSlot.objects.filter(programme=user_programme)

    def perform_create(self, serializer):
        user_programme = self.request.user.profile.programme
        serializer.save(programme=user_programme)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_eligible_supervisors(request):
    user = request.user
    profile = getattr(user, 'profile', None)

    if not profile:
        return Response({'error': 'No profile found'}, status=400)
    
    if not profile.programme:
        return Response({'error': 'User has no assigned programme.'}, status=400)

    eligible_users = User.objects.filter(
        profile__programme=profile.programme,
        profile__role__in=['lecturer', 'coordinator']
    ).select_related('profile').order_by('profile__full_name')

    serializer = UserSerializer(eligible_users, many=True)
    return Response(serializer.data)

class UserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['profile__role']

    def get_queryset(self):
        user = self.request.user
        queryset = User.objects.none()

        profile = getattr(user, 'profile', None)
        if profile and profile.role == 'coordinator' and profile.programme:
            base_queryset = User.objects.filter(
                is_active=True,
                # Accounts with no Profile row are Django-admin leftovers that take
                # no part in the course, so they are left out.
                profile__isnull=False,
                profile__programme=profile.programme
            ).select_related('profile')

            # Deliberately no `is_superuser=False` here. Accounts that hold Django
            # superuser rights are still coordinators/lecturers in this system (one
            # of the shipped coordinators is a superuser), and filtering them out
            # hid the signed-in coordinator from their own user list.
            queryset = base_queryset.order_by(
                Case(
                    When(profile__role='coordinator', then=Value(1)),
                    When(profile__role='lecturer', then=Value(2)),
                    When(profile__role='student', then=Value(3)),
                    default=Value(4)
                ),
                'profile__full_name'
            )
        
        return queryset
    
    def get_serializer_class(self):
        # Writes go through the dedicated serializer; every read keeps the
        # read-only shape the rest of the app already consumes.
        if self.action in ('create', 'update', 'partial_update'):
            return UserWriteSerializer
        return UserSerializer

    def _ensure_coordinator(self, require_programme=False):
        """Creating and editing accounts is a coordinator-only action."""
        profile = getattr(self.request.user, 'profile', None)
        if not profile or profile.role != 'coordinator':
            raise PermissionDenied('Only a coordinator can create or edit user accounts.')
        if require_programme and not profile.programme:
            # The list is filtered by the coordinator's programme, so an account
            # created without one would be created and then be invisible.
            raise ValidationError({
                'error': 'Your coordinator account has no programme assigned, so new accounts would not appear in this list.'
            })

    def create(self, request, *args, **kwargs):
        self._ensure_coordinator(require_programme=True)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        self._ensure_coordinator()
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        self._ensure_coordinator()
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._ensure_coordinator()

        target = self.get_object()
        target_profile = getattr(target, 'profile', None)

        # Locking yourself out of your own system, or removing the other person
        # who can run the course, is unrecoverable from the interface.
        if target.pk == request.user.pk:
            raise ValidationError({
                'error': 'You cannot delete your own account. Ask another coordinator if it must be removed.'
            })

        if target.is_superuser or (target_profile and target_profile.role == 'coordinator'):
            raise ValidationError({
                'error': f'{target.username} is a coordinator or administrator account and cannot be deleted from here.'
            })

        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='promote-to-coordinator')
    def promote_to_coordinator(self, request, pk=None):
        if request.user.profile.role != 'coordinator':
            return Response({'error': 'Only a coordinator can perform this action.'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            lecturer_to_promote = self.get_object()
            new_coordinator_profile = lecturer_to_promote.profile
        except User.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if new_coordinator_profile.role != 'lecturer':
            return Response({'error': 'Only lecturers can be promoted to coordinator.'}, status=status.HTTP_400_BAD_REQUEST)
        
        current_coordinator_profile = request.user.profile
        
        new_coordinator_profile.role = 'coordinator'
        new_coordinator_profile.save()
        
        current_coordinator_profile.role = 'lecturer'
        current_coordinator_profile.save()
        
        return Response({
            'status': 'success',
            'message': f'Coordinator role has been successfully transferred to {lecturer_to_promote.profile.full_name}. You have been demoted to a lecturer.'
        })

class FYPProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = FYPProjectSerializer
    filter_backends = [DjangoFilterBackend]
    
    filterset_fields = ['fyp_stage', 'supervisor', 'examiner']

    def get_queryset(self):
        user = self.request.user
        profile = getattr(user, 'profile', None)
        
        if not profile:
            return FYPProject.objects.none()
        
        if profile.role in ['lecturer', 'coordinator']:
            return FYPProject.objects.filter(
                Q(supervisor=user) | Q(co_supervisor=user) | Q(examiner=user)
            ).distinct().order_by('student_matric_id')
        
        elif profile.role == 'student':
            return FYPProject.objects.filter(student=user).order_by('student_matric_id')
            
        return FYPProject.objects.none()

class StudentListViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = FYPProjectSerializer 
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['fyp_stage']

    def get_queryset(self):
        user = self.request.user
        
        if hasattr(user, 'profile') and user.profile.role == 'coordinator' and user.profile.programme:
            base_queryset = FYPProject.objects.filter(
                programme=user.profile.programme
            ).select_related(
                'student__profile', 
                'supervisor__profile',
                'co_supervisor__profile',
                'examiner__profile'
            ).order_by('student__profile__student_id_no')
            
            return base_queryset
            
        return FYPProject.objects.none()

class LecturerPreferenceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, 'profile') or request.user.profile.role not in ['lecturer', 'coordinator']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            
        preferences = LecturerPreference.objects.filter(lecturer=request.user).select_related('presentation_slot')
        serializer = LecturerPreferenceSerializer(preferences, many=True)
        return Response(serializer.data)

    def post(self, request):
        if not hasattr(request.user, 'profile') or request.user.profile.role not in ['lecturer', 'coordinator']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            
        presentation_slot_id = request.data.get('presentation_slot_id')
        unavailable_slots = request.data.get('unavailable_slots')

        if not presentation_slot_id or unavailable_slots is None:
            return Response({'error': 'presentation_slot_id and unavailable_slots are required.'}, status=400)

        try:
            slot = PresentationSlot.objects.get(id=presentation_slot_id)
        except PresentationSlot.DoesNotExist:
            return Response({'error': 'Invalid slot ID.'}, status=400)

        preference, created = LecturerPreference.objects.update_or_create(
            lecturer=request.user,
            presentation_slot=slot, 
            defaults={'unavailable_slots': unavailable_slots}
        )
        
        return Response(LecturerPreferenceSerializer(preference).data, status=201 if created else 200)

from django.db import transaction

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def run_auto_scheduler(request):
    user = request.user
    if user.profile.role != 'coordinator' or not user.profile.programme:
        return Response({'error': 'Unauthorized: Only Programme coordinators can run scheduler'}, status=403)

    programme = user.profile.programme
    slots = PresentationSlot.objects.filter(programme=programme).order_by('date')
    
    if not slots.exists():
        return Response({'error': 'No slots configured. Please define Presentation Slots first.'}, status=400)

    scheduled_project_ids = TimetableBooking.objects.filter(project__student__profile__programme=programme).values_list('project_id', flat=True)
    project_pool = list(
        FYPProject.objects.filter(
            student__profile__programme=programme,
            supervisor__isnull=False
        ).exclude(id__in=scheduled_project_ids)
    )
    
    if not project_pool:
        return Response({'status': 'success', 'message': 'All projects are already scheduled.'})

    preferences = {}
    for pref in LecturerPreference.objects.filter(lecturer__profile__programme=programme):
        if not pref.presentation_slot:
            continue
            
        date_str = pref.presentation_slot.date.strftime('%Y-%m-%d')
        
        if pref.lecturer_id not in preferences:
            preferences[pref.lecturer_id] = {}
        
        preferences[pref.lecturer_id][date_str] = pref.unavailable_slots

    existing_bookings_by_time = {}
    existing_bookings_by_slot = {}
    for booking in TimetableBooking.objects.filter(project__student__profile__programme=programme):
        slot_key = f"{booking.start_time.strftime('%Y-%m-%d %H:%M')} {booking.venue}"
        existing_bookings_by_slot[slot_key] = booking
        
        time_key = booking.start_time.strftime('%Y-%m-%d %H:%M')
        if time_key not in existing_bookings_by_time:
            existing_bookings_by_time[time_key] = []
        existing_bookings_by_time[time_key].append(booking.lecturer_id)
        if booking.examiner_id:
            existing_bookings_by_time[time_key].append(booking.examiner_id)

    created_count = 0
    with transaction.atomic():
        while project_pool:
            best_choice = None
            highest_score = -1

            for slot in slots:
                venue_name = slot.venue_name
                # Wall-clock Malaysia time (naive), matching how every datetime
                # is stored in this project — see TIME_ZONE / USE_TZ in
                # backend/settings.py. Building these as timezone-aware values
                # would store them 8 hours off and break the conflict checks
                # below, which compare against stored booking times.
                curr_time = datetime.combine(slot.date, time(8, 0))
                end_time = datetime.combine(slot.date, time(17, 0))
                
                while curr_time < end_time:
                    slot_key = f"{curr_time.strftime('%Y-%m-%d %H:%M')} {venue_name}"
                    time_key = curr_time.strftime('%Y-%m-%d %H:%M')
                    date_key = curr_time.strftime('%Y-%m-%d')
                    
                    if slot_key in existing_bookings_by_slot:
                        curr_time += timedelta(minutes=30)
                        continue

                    for project in project_pool:
                        supervisor_id = project.supervisor_id
                        examiner_id = project.examiner_id

                        if supervisor_id in existing_bookings_by_time.get(time_key,[]) or \
                           (examiner_id and examiner_id in existing_bookings_by_time.get(time_key,[])):
                            continue
                        
                        if preferences.get(supervisor_id, {}).get(date_key,[]).__contains__(curr_time.strftime('%H:%M')):
                            continue
                        
                        if examiner_id and preferences.get(examiner_id, {}).get(date_key,[]).__contains__(curr_time.strftime('%H:%M')):
                            continue

                        score = 0
                        prev_time = curr_time - timedelta(minutes=30)
                        prev_slot_key = f"{prev_time.strftime('%Y-%m-%d %H:%M')} {venue_name}"
                        prev_booking = existing_bookings_by_slot.get(prev_slot_key)
                        
                        if prev_booking:
                            if prev_booking.lecturer_id == supervisor_id or prev_booking.examiner_id == supervisor_id:
                                score += 20
                            if examiner_id and (prev_booking.lecturer_id == examiner_id or prev_booking.examiner_id == examiner_id):
                                score += 15

                        next_time = curr_time + timedelta(minutes=30)
                        next_slot_key = f"{next_time.strftime('%Y-%m-%d %H:%M')} {venue_name}"
                        next_booking = existing_bookings_by_slot.get(next_slot_key)
                        
                        if next_booking:
                            if next_booking.lecturer_id == supervisor_id or next_booking.examiner_id == supervisor_id:
                                score += 10
                            if examiner_id and (next_booking.lecturer_id == examiner_id or next_booking.examiner_id == examiner_id):
                                score += 8

                        if score > highest_score:
                            highest_score = score
                            best_choice = {
                                'project': project,
                                'time': curr_time,
                                'venue': venue_name,
                                'score': score
                            }
                    
                    curr_time += timedelta(minutes=30)

            if best_choice:
                proj = best_choice['project']
                start = best_choice['time']
                venue = best_choice['venue']
                
                new_booking = TimetableBooking.objects.create(
                    lecturer=proj.supervisor,
                    project=proj,
                    examiner=proj.examiner,
                    venue=venue,
                    start_time=start,
                    end_time=start + timedelta(minutes=30)
                )
                created_count += 1
                project_pool.remove(proj)
                
                slot_key = f"{start.strftime('%Y-%m-%d %H:%M')} {venue}"
                time_key = start.strftime('%Y-%m-%d %H:%M')
                existing_bookings_by_slot[slot_key] = new_booking
                if time_key not in existing_bookings_by_time:
                    existing_bookings_by_time[time_key] = []
                existing_bookings_by_time[time_key].append(proj.supervisor_id)
                if proj.examiner_id:
                    existing_bookings_by_time[time_key].append(proj.examiner_id)
            else:
                break

    message = f'Auto-scheduling complete: {created_count} new projects scheduled.'
    if project_pool:
        message += f' Could not schedule {len(project_pool)} projects due to conflicts.'
        
    return Response({'status': 'success', 'message': message})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def clear_schedule(request):
    if request.user.profile.role != 'coordinator' or not request.user.profile.programme:
        return Response({'error': 'Unauthorized'}, status=403)

    programme = request.user.profile.programme
    
    bookings_to_delete = TimetableBooking.objects.filter(project__student__profile__programme=programme)
    count, _ = bookings_to_delete.delete()
    
    return Response({'status': 'success', 'message': f'Successfully cleared {count} booking slots.'})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_update_quotas(request):
    if request.user.profile.role != 'coordinator' or not request.user.profile.programme:
        return Response({'error': 'Unauthorized'}, status=403)
    
    new_quota = request.data.get('quota_total')
    if new_quota is None or not isinstance(new_quota, int):
        return Response({'error': 'Invalid quota value provided'}, status=400)

    programme_lecturers = User.objects.filter(profile__role='lecturer', profile__programme=request.user.profile.programme)
    
    for lecturer in programme_lecturers:
        SupervisorQuotas.objects.update_or_create(
            lecturer=lecturer,
            defaults={'quota_total': new_quota}
        )
    
    return Response({'status': 'success', 'message': f'Updated quotas for {programme_lecturers.count()} lecturers.'})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_overview_summary(request):
    if not hasattr(request.user, 'profile') or request.user.profile.role != 'coordinator' or not request.user.profile.programme:
        return Response({'error': 'Unauthorized'}, status=403)
        
    programme = request.user.profile.programme
    
    data = {
        'total_students': User.objects.filter(profile__role='student', profile__programme=programme).count(),
        
        'projects_submitted': Submissions.objects.filter(student__profile__programme=programme).count(),
        'pending_reviews': Submissions.objects.filter(student__profile__programme=programme, status='pending').count(),
        'approved_projects': Submissions.objects.filter(student__profile__programme=programme, status='approved').count(),
        'revision_needed': Submissions.objects.filter(student__profile__programme=programme, status='revision').count(),
    }
    return Response({'success': True, 'summary': data})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_my_quota(request):
    """The signed-in supervisor's own allocation, for the lecturer dashboard.

    `assigned_count` uses the same definition as `get_supervisor_quotas`: the
    projects where this lecturer is the main supervisor.
    """
    user = request.user
    if not getattr(user, 'profile', None):
        return Response({'error': 'This account has no profile.'}, status=status.HTTP_403_FORBIDDEN)

    quota = SupervisorQuotas.objects.filter(lecturer=user).first()
    total = quota.quota_total if quota else 0
    assigned = FYPProject.objects.filter(supervisor=user).count()

    return Response({
        'success': True,
        'quota_total': total,
        'assigned_count': assigned,
        # Clamped, because "you have -2 places left" is not useful to a lecturer.
        'available_quota': max(total - assigned, 0),
        'has_quota_set': quota is not None,
    })


@api_view(['GET'])
def get_supervisor_quotas(request):
    user = request.user
    lecturers = User.objects.filter(profile__role='lecturer', profile__programme=user.profile.programme)
    results = []
    for lec in lecturers:
        q = SupervisorQuotas.objects.filter(lecturer=lec).first()
        total = q.quota_total if q else 0
        assigned = FYPProject.objects.filter(supervisor=lec).count()
        results.append({
            'id': lec.id, 'name': lec.profile.full_name or lec.username,
            'total_quota': total, 'assigned_count': assigned, 'available_quota': total - assigned
        })
    return Response({'success': True, 'quotas': results})

@api_view(['GET'])
def get_supervisor_students(request, lecturer_id):
    projects = FYPProject.objects.filter(supervisor_id=lecturer_id)
    return Response(FYPProjectSerializer(projects, many=True).data)

@api_view(['PUT'])
def update_supervisor_quota(request, lecturer_id):
    val = request.data.get('quota_total')
    SupervisorQuotas.objects.update_or_create(lecturer_id=lecturer_id, defaults={'quota_total': int(val)})
    return Response({"success": True})

@api_view(['GET'])
def get_student_dashboard_data(request, student_id):
    sub = Submissions.objects.filter(student_id=student_id).order_by('-created_at').first()
    unread = Feedback.objects.filter(submission__student_id=student_id, is_read=False).count()
    return Response({'success': True, 'data': {
        'submission_status': sub.status.capitalize() if sub else "Not Submitted",
        'unread_feedback_count': unread,
        'full_name': User.objects.get(id=student_id).profile.full_name
    }})

class TimetableBookingViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TimetableBookingSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project__fyp_stage']
    def get_queryset(self):
        return TimetableBooking.objects.all().order_by('start_time')
    def perform_create(self, serializer):
        serializer.save(lecturer=self.request.user)

class TimetableSlotViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TimetableSlotSerializer
    def get_queryset(self):
        user = self.request.user
        if user.profile.role == 'student': return TimetableSlot.objects.filter(project__student=user)
        return TimetableSlot.objects.all()

class SubmissionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = SubmissionSerializer
    
    def get_queryset(self):
        user = self.request.user
        profile = getattr(user, 'profile', None)
        if not profile:
            return Submissions.objects.none()

        view_mode = self.request.query_params.get('view', 'mine')

        if profile.role == 'student':
            return Submissions.objects.filter(student=user)

        if profile.role in ['coordinator', 'lecturer']:
            if profile.role == 'coordinator' and view_mode != 'mine':
                return Submissions.objects.filter(student__profile__programme=profile.programme)
            
            if self.action in ['retrieve', 'feedback']:
                return Submissions.objects.filter(student__profile__programme=profile.programme)
            
            if self.action == 'list':
                if view_mode == 'all':
                    return Submissions.objects.filter(student__profile__programme=profile.programme)
                return Submissions.objects.filter(supervisor=user)

        return Submissions.objects.none()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        submission = serializer.save(student=self.request.user)

        try:
            project_to_update = FYPProject.objects.get(student=self.request.user)
            project_to_update.title = submission.proposed_project_title
            project_to_update.supervisor = submission.supervisor
            project_to_update.co_supervisor = submission.co_supervisor
            project_to_update.save()
        except FYPProject.DoesNotExist:
            pass
            
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_update(self, serializer):
        instance = serializer.save()

        try:
            project = FYPProject.objects.get(student=instance.student)
            
            project.title = instance.proposed_project_title
            project.supervisor = instance.supervisor
            project.co_supervisor = instance.co_supervisor
            project.save()
            
        except FYPProject.DoesNotExist:
            print(f"Warning: FYPProject not found for student {instance.student}")

    @action(detail=True, methods=['post'], url_path='add-feedback')
    def feedback(self, request, pk=None):
        submission = self.get_object()
        current_user = request.user
        new_status = request.data.get('new_status')
        if new_status:
            if submission.supervisor == current_user:
                submission.status = new_status
                submission.save()
        Feedback.objects.create(
            submission=submission, 
            lecturer=current_user, 
            comment=request.data.get('comment')
        )
        return Response({'success': True})

class MilestoneFormsViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = MilestoneFormsSerializer
    queryset = MilestoneForms.objects.all()

    def get_queryset(self):
        return MilestoneForms.objects.filter(lecturer=self.request.user)
        
    def perform_create(self, serializer):
        form = serializer.save(lecturer=self.request.user)

        milestone_data = [
            {'week': 1, 'name': 'Project Plan Review & Refinement', 'marks': 2},
            {'week': 3, 'name': 'System Development/Research Implementation', 'marks': 2},
            {'week': 4, 'name': 'System Development/Research Implementation', 'marks': 2},
            {'week': 6, 'name': 'Project Deployment', 'marks': 1},
            {'week': 7, 'name': 'Test Planning', 'marks': 2},
            {'week': 8, 'name': 'Testing Execution', 'marks': 2},
            {'week': 11, 'name': 'Results Discussion and Comparative Evaluation', 'marks': 2},
            {'week': 12, 'name': 'Final Document Submission', 'marks': 2},
        ]

        milestones_to_create = []
        for data in milestone_data:
            milestones_to_create.append(
                MilestoneEntries(
                    form=form, 
                    milestone_number=data['week'], 
                    milestone_name=data['name'],
                    max_marks=data['marks'],
                    status='pending'
                )
            )
        
        MilestoneEntries.objects.bulk_create(milestones_to_create)

class AnnouncementViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = AnnouncementSerializer
    
    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'profile') and user.profile.programme:
            return Announcements.objects.filter(
                programme=user.profile.programme
            ).order_by('-created_at')
        
        return Announcements.objects.none()

    def perform_create(self, serializer):
        serializer.save(
            coordinator=self.request.user,
            programme=self.request.user.profile.programme
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def export_to_google_sheet(request):
    user = request.user
    try:
        scope = ['https://www.googleapis.com/auth/spreadsheets', "https://www.googleapis.com/auth/drive"]
        creds = ServiceAccountCredentials.from_json_keyfile_name(os.path.join(settings.BASE_DIR, 'client_secret.json'), scope)
        client = gspread.authorize(creds)
        sheet = client.open('FYP_Schedule_Sheet').sheet1
        
        bookings = TimetableBooking.objects.filter(project__student__profile__programme=user.profile.programme).order_by('start_time')
        
        header = ['Date', 'Start Time', 'End Time', 'Venue', 'Name', 'Student ID', 'FYP Title', 'Supervisor', 'Co-Supervisor', 'Examiner', 'FYP Level']
        data = [header]
        for b in bookings:
            data.append([
                str(b.start_time.date()), b.start_time.strftime('%I:%M %p'), b.end_time.strftime('%I:%M %p'), b.venue,
                b.project.student.profile.full_name, b.project.student_matric_id, b.project.title,
                b.lecturer.profile.full_name, b.project.co_supervisor.profile.full_name if b.project.co_supervisor else "N/A",
                b.examiner.profile.full_name, b.project.fyp_stage
            ])
        sheet.clear()
        sheet.update('A1', data)
        return Response({'status': 'success', 'url': f"https://docs.google.com/spreadsheets/d/{sheet.spreadsheet.id}"})
    except Exception as e: return Response({'status': 'error', 'message': str(e)}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_initial_notification(request):
    user = request.user
    try:
        bookings = TimetableBooking.objects.filter(project__student__profile__programme=user.profile.programme)
        lec_ids = set(list(bookings.values_list('lecturer_id', flat=True)) + list(bookings.values_list('examiner_id', flat=True)))
        lecturers = User.objects.filter(id__in=lec_ids, email__isnull=False)
        for lec in lecturers:
            message = f"Dear {lec.profile.full_name or lec.username},\n\nYour FYP presentation schedule for {user.profile.programme.code} is finalized. Please view it: http://localhost:3000/present-schedule"
            send_mail('FYP Schedule Ready', message, settings.DEFAULT_FROM_EMAIL, [lec.email])
        return Response({'status': 'success', 'message': f'Notified {len(lecturers)} staff.'})
    except Exception as e: return Response({'error': str(e)}, status=500)

class ExcelUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        if request.user.profile.role != 'coordinator':
            return Response(status=status.HTTP_403_FORBIDDEN)
        
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"error": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            df = pd.read_excel(file_obj).replace({np.nan: None})
            
            created_users_count = 0
            created_projects_count = 0
            errors = []

            for index, row in df.iterrows():
                try:
                    username = str(row['username']).strip()
                    user, user_created = User.objects.get_or_create(username=username)
                    if user_created:
                        user.set_password(BULK_UPLOAD_PASSWORD)
                        user.save()
                        created_users_count += 1

                    code = str(row.get('programme_code', 'General')).strip()
                    programme, _ = Programme.objects.get_or_create(
                        code__iexact=code,
                        defaults={'code': code, 'name': code}
                    )

                    profile_defaults = {
                        'full_name': row.get('full_name'),
                        'role': str(row.get('role', 'student')).lower().strip(),
                        'programme': programme,
                        'student_id_no': row.get('student_matric_id')
                    }
                    # Only record the readable password when this row actually set
                    # one. Re-uploading a corrected file must not overwrite the copy
                    # of a password the coordinator has since changed.
                    if user_created:
                        profile_defaults['visible_password'] = BULK_UPLOAD_PASSWORD

                    profile, _ = Profile.objects.update_or_create(
                        user=user,
                        defaults=profile_defaults
                    )

                    if profile.role == 'student':
                        project, project_created = FYPProject.objects.get_or_create(
                            student=user,
                            defaults={
                                'title': 'Pending TRF Submission',
                                'student_matric_id': row.get('student_matric_id'),
                                'fyp_stage': str(row.get('fyp_stage', 'FYP1')).upper().strip(),
                                'programme': programme
                            }
                        )
                        if project_created:
                            created_projects_count += 1
                
                except Exception as e:
                    errors.append(f"Row {index + 2}: {str(e)}")

            if errors:
                return Response({
                    "status": "partial_success", 
                    "message": f"Processed with errors. Created {created_users_count} users and {created_projects_count} projects.",
                    "errors": errors
                }, status=status.HTTP_207_MULTI_STATUS)

            return Response({
                "status": "success",
                "message": f"Successfully processed file. Created {created_users_count} new users and {created_projects_count} new projects."
            })

        except Exception as e:
            return Response({"error": f"An unexpected error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_students_excel(request):
    if request.user.profile.role != 'coordinator' or not request.user.profile.programme:
        return Response({'error': 'Unauthorized'}, status=403)

    programme = request.user.profile.programme
    queryset = FYPProject.objects.filter(student__profile__programme=programme).order_by('student_matric_id')

    fyp_stage_filter = request.query_params.get('fyp_stage', None)
    if fyp_stage_filter in ['FYP1', 'FYP2']:
        queryset = queryset.filter(fyp_stage=fyp_stage_filter)

    data = queryset.values(
        'student_matric_id',
        'student__profile__full_name',
        'title',
        'supervisor__profile__full_name',
        'examiner__profile__full_name',
        'fyp_stage'
    )
    
    df = pd.DataFrame(list(data))
    df.rename(columns={
        'student_matric_id': 'Student ID',
        'student__profile__full_name': 'Student Name',
        'title': 'Project Title',
        'supervisor__profile__full_name': 'Supervisor',
        'examiner__profile__full_name': 'Examiner',
        'fyp_stage': 'FYP Stage'
    }, inplace=True)

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Students')
    
    buffer.seek(0)

    response = HttpResponse(
        buffer,
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="FYP_Student_List_{programme.code}.xlsx"'
    return response

class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        return Response(UserSerializer(request.user).data)
    
class FeedbackViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = FeedbackSerializer

    def get_queryset(self):
        user = self.request.user
        
        if hasattr(user, 'profile') and user.profile.role == 'student':
            return Feedback.objects.filter(submission__student=user).order_by('-created_at')
        
        return Feedback.objects.none()
    
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def auto_assign_examiners(request):
    if not hasattr(request.user, 'profile') or request.user.profile.role != 'coordinator' or not request.user.profile.programme:
        return Response({'error': 'Unauthorized'}, status=403)

    programme = request.user.profile.programme

    projects_to_assign = FYPProject.objects.filter(
        student__profile__programme=programme,
    )

    if not projects_to_assign.exists():
        return Response({'status': 'info', 'message': 'All projects already have an examiner.'})

    eligible_examiners = list(User.objects.filter(
        profile__programme=programme,
        profile__role__in=['lecturer', 'coordinator']
    ))
    
    if len(eligible_examiners) < 2:
        return Response({'error': 'Not enough eligible lecturers/coordinators in the programme to assign as examiners.'}, status=400)

    assigned_count = 0
    for project in projects_to_assign:
        supervisor_id = project.supervisor.id if project.supervisor else None
        co_supervisor_id = project.co_supervisor.id if project.co_supervisor else None
        
        valid_examiner_pool = [
            examiner for examiner in eligible_examiners 
            if examiner.id not in [supervisor_id, co_supervisor_id]
        ]

        if valid_examiner_pool:
            chosen_examiner = random.choice(valid_examiner_pool)
            project.examiner = chosen_examiner
            project.save()
            assigned_count += 1

    return Response({
        'status': 'success',
        'message': f'Successfully assigned examiners to {assigned_count} projects.'
    })

@api_view(['GET'])
def sync_missing_projects(request):
    students = User.objects.filter(profile__role='student')
    created_count = 0
    for student in students:
        obj, created = FYPProject.objects.get_or_create(
            student=student,
            defaults={
                'title': 'Pending TRF Submission',
                'student_matric_id': student.profile.student_id_no or '',
                'fyp_stage': 'FYP1',
                'programme': student.profile.programme
            }
        )
        if created: created_count += 1
    return Response({"message": f"Created {created_count} placeholder projects."})

def rubric_actor_name(user):
    """Name recorded in the rubric tables' free-text *_by columns.

    These columns are plain strings rather than user foreign keys because the
    PHP backend writes them, and it writes display names (see models.py). The
    PHP frontend uses `full_name || username`, so mirror that here to keep the
    two writers consistent.
    """
    profile = getattr(user, 'profile', None)
    return getattr(profile, 'full_name', '') or user.get_username()

class RubricTemplateViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = RubricTemplateSerializer
    queryset = RubricTemplate.objects.filter(is_active=True).order_by('-updated_at')

    def perform_create(self, serializer):
        serializer.save(created_by=rubric_actor_name(self.request.user))

    def get_queryset(self):
        if self.request.user.profile.role == 'coordinator':
            return super().get_queryset()
        return RubricTemplate.objects.none()

class RubricMarksViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = RubricMarksSerializer

    def get_queryset(self):
        user = self.request.user
        profile = getattr(user, 'profile', None)
        role = getattr(profile, 'role', None)
        actor = rubric_actor_name(user)

        if role in ['lecturer', 'coordinator']:
            # Match either the display name or the username, since a marks row
            # may have been written by the PHP endpoint under either one.
            return RubricMarks.objects.filter(Q(evaluated_by=actor) | Q(evaluated_by=user.get_username()))
        elif role == 'student':
            # rubric_marks.student_id holds the matric number (a string), not a
            # user id, so match on the profile's student ID with a fallback.
            student_ref = getattr(profile, 'student_id_no', '') or str(user.pk)
            return RubricMarks.objects.filter(student_id=student_ref)
        return RubricMarks.objects.none()

    def perform_create(self, serializer):
        serializer.save(evaluated_by=rubric_actor_name(self.request.user))

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sync_project_programmes(request):
    if not hasattr(request.user, 'profile') or request.user.profile.role != 'coordinator':
        return Response({'error': 'Unauthorized. Only coordinators can run this sync.'}, status=403)
        
    projects_to_sync = FYPProject.objects.all()
    synced_count = 0
    errors = []
    
    for project in projects_to_sync:
        try:
            student_profile = project.student.profile
            updated = False
            
            if not project.programme and student_profile.programme:
                project.programme = student_profile.programme
                updated = True
                
            if project.student_matric_id != student_profile.student_id_no and student_profile.student_id_no:
                project.student_matric_id = student_profile.student_id_no
                updated = True
            
            if updated:
                project.save()
                synced_count += 1
        except Profile.DoesNotExist:
            errors.append(f"Project with ID {project.id} has a student ({project.student.username}) who is missing a profile.")
        except Exception as e:
            errors.append(f"Error processing project {project.id}: {str(e)}")

    return Response({
        'status': 'success',
        'message': f'Scan complete. Synced data for {synced_count} projects.',
        'errors': errors
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_fyp_stages_for_programme(request):
    user = request.user
    if not hasattr(user, 'profile') or user.profile.role != 'coordinator' or not user.profile.programme:
        return Response({'error': 'Unauthorized'}, status=403)

    programme = user.profile.programme
    
    stages = FYPProject.objects.filter(
        programme=programme
    ).values_list('fyp_stage', flat=True).distinct().order_by('fyp_stage')
    
    return Response(list(stages))