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
    LecturerPreferenceSerializer, RubricTemplateSerializer, RubricMarksSerializer,
    PresentationDaySerializer, VenueSerializer
)

print("<<<<< LOADING LATEST views.py - VERSION FINAL >>>>>")

# Starting password for accounts created from a spreadsheet. Kept in step with
# serializers.DEFAULT_NEW_USER_PASSWORD and migration 0015.
BULK_UPLOAD_PASSWORD = 'wow12345'


# ---------------------------------------------------------------------------
# Programme helpers.
#
# The programme is the unit the course is administered in: one cohort per
# programme, one coordinator per programme, one set of marking templates per
# programme. Everything cohort-scoped reads the signed-in account's programme
# through these two helpers rather than re-deriving it, because a missing
# Profile or a NULL programme used to be handled differently in each view —
# some raised AttributeError, some 403'd, some silently returned the whole
# institution. One rule, applied in one place.
# ---------------------------------------------------------------------------

def get_user_programme(user):
    """The signed-in account's programme, or None if it holds none."""
    profile = getattr(user, 'profile', None)
    return getattr(profile, 'programme', None)


def get_user_profile(user):
    """The signed-in account's Profile row, or None."""
    return getattr(user, 'profile', None)


def scoped_to_user_programme(queryset, user, field='programme'):
    """Narrow a queryset to the caller's programme.

    A caller holding no programme is *not* silently given the whole database —
    that is what made an unassigned coordinator see every other cohort. It is
    given an empty queryset instead, and each view decides separately whether
    that should be a 403 with an explanation.
    """
    programme = get_user_programme(user)
    if programme is None:
        return queryset.none()
    return queryset.filter(**{field: programme})

class ProgrammeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ProgrammeSerializer

    def get_queryset(self):
        # Every real programme is offered, so an account can be filed under any
        # of them. The legacy 'General' / 'None' placeholder rows were removed
        # from the database by migration 0017, so there is no longer anything to
        # exclude here.
        return Programme.objects.order_by('code')

class PresentationSlotViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = PresentationSlotSerializer

    def get_queryset(self):
        # Slots are the presentation days/venues a lecturer marks themselves
        # unavailable on. They belong to one cohort, so the list is the caller's
        # own programme rather than the whole institution. Reading uses the safe
        # helper; writing is coordinator-only (see the guards below), because a
        # lecturer editing the slot list would rewrite the frame everyone books
        # inside.
        return scoped_to_user_programme(PresentationSlot.objects.all(), self.request.user)

    def _ensure_coordinator(self):
        profile = get_user_profile(self.request.user)
        if not profile or profile.role != 'coordinator':
            raise PermissionDenied('Only a coordinator can change presentation slots.')
        if profile.programme is None:
            raise PermissionDenied(
                'Your account is not assigned to a programme, so it owns no presentation slots.'
            )

    def perform_create(self, serializer):
        self._ensure_coordinator()
        serializer.save(programme=get_user_programme(self.request.user))

    def perform_update(self, serializer):
        self._ensure_coordinator()
        serializer.save()

    def perform_destroy(self, instance):
        self._ensure_coordinator()
        instance.delete()


class _CoordinatorOwnedProgrammeViewSet(viewsets.ModelViewSet):
    """Shared behaviour for rows that belong to one programme.

    Presentation dates and venues are the frame a cohort's timetable is built in:
    the scheduler pairs every date with every venue and fills the result, and
    `MyAvailabilityPage` renders exactly that grid. So they are scoped to the
    coordinator's own programme on read, and only a coordinator may write them —
    a lecturer editing the grid would change the frame everyone books inside.

    Extracted because the two viewsets were byte-for-byte identical apart from
    their model, and the frontend calls both with no role distinction.
    """

    permission_classes = [IsAuthenticated]
    # Concrete subclasses must set `model`; the base reads through it so there is
    # one place that decides what "all rows" means.
    model = None

    def get_queryset(self):
        queryset = self.model.objects.all()
        return scoped_to_user_programme(queryset, self.request.user).order_by('id')

    def _ensure_coordinator(self):
        profile = get_user_profile(self.request.user)
        if not profile or profile.role != 'coordinator':
            raise PermissionDenied(
                f'Only a coordinator can change presentation {self.owner_label}.'
            )
        if profile.programme is None:
            raise PermissionDenied(
                f'Your account is not assigned to a programme, so it owns no presentation {self.owner_label}.'
            )
        return profile

    def perform_create(self, serializer):
        profile = self._ensure_coordinator()
        serializer.save(programme=profile.programme)

    def perform_update(self, serializer):
        self._ensure_coordinator()
        serializer.save()

    def perform_destroy(self, instance):
        self._ensure_coordinator()
        instance.delete()


class PresentationDayViewSet(_CoordinatorOwnedProgrammeViewSet):
    serializer_class = PresentationDaySerializer
    owner_label = 'dates'
    model = PresentationDay


class VenueViewSet(_CoordinatorOwnedProgrammeViewSet):
    serializer_class = VenueSerializer
    owner_label = 'venues'
    model = Venue

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_eligible_supervisors(request):
    profile = get_user_profile(request.user)

    if not profile:
        return Response({'error': 'No profile found'}, status=400)
    
    if not profile.programme:
        return Response({'error': 'User has no assigned programme.'}, status=400)

    eligible_users = User.objects.filter(
        profile__programme=profile.programme,
        profile__role__in=['lecturer', 'coordinator']
    ).select_related('profile').order_by('profile__full_name')

    # UserSerializer carries the readable `visible_password` column, so this list
    # is trimmed to the fields a student's supervisor picker actually needs.
    # Students have no business reading staff sign-in details.
    payload = [
        {
            'id': candidate.id,
            'full_name': candidate.profile.full_name or candidate.username,
        }
        for candidate in eligible_users
    ]
    return Response(payload)

class UserViewSet(viewsets.ModelViewSet):
    """Account administration: the coordinator's own cohort, or every account.

    Two roles reach this view, with deliberately different visibility:

    * a **coordinator** administers their own programme — create, edit and delete
      the accounts in their cohort;
    * an **admin** (the handover account-maintenance role) sees every account in
      the system, whatever its role and whichever programme it sits on, because
      looking after accounts across cohorts is its entire job. It has no
      programme of its own, so the programme scoping below is skipped for it
      rather than applied — the same helper would otherwise hand it an empty
      list, `scoped_to_user_programme` treating a missing programme as "owns
      nothing".

    Everyone else gets an empty queryset, so the endpoint's shape is the same for
    them as for a signed-out caller.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['profile__role']

    # Roles allowed to create, edit and delete accounts through this view.
    MANAGE_ROLES = ('coordinator', 'admin')
    # Roles that may look at every account instead of one cohort.
    ALL_PROGRAMMES_ROLES = ('admin',)

    def get_queryset(self):
        user = self.request.user
        queryset = User.objects.none()

        profile = get_user_profile(user)
        if profile and profile.role in self.MANAGE_ROLES:
            if profile.role in self.ALL_PROGRAMMES_ROLES:
                # Institution-wide on purpose: no `profile__programme` bound and
                # no `profile__isnull=False`, because an account with no Profile
                # row (a `createsuperuser` leftover) is still an account the
                # administrator has to be able to see and fix.
                return User.objects.filter(is_active=True).select_related(
                    'profile', 'profile__programme'
                ).order_by(
                    Case(
                        When(profile__role='admin', then=Value(0)),
                        When(profile__role='coordinator', then=Value(1)),
                        When(profile__role='lecturer', then=Value(2)),
                        When(profile__role='student', then=Value(3)),
                        default=Value(4)
                    ),
                    'profile__programme__code',
                    'profile__full_name',
                    'username',
                )

            # Cohort-scoped: a coordinator administers their own programme, not
            # every account in the institution. Migration 0017 moved every
            # account off the legacy 'General' placeholder, so this bound no
            # longer hides anyone who belongs to a real cohort.
            base_queryset = User.objects.filter(
                is_active=True,
                # Accounts with no Profile row are Django-admin leftovers that take
                # no part in the course, so they are left out.
                profile__isnull=False,
            ).select_related('profile', 'profile__programme')

            # Deliberately no `is_superuser=False` here. Accounts that hold Django
            # superuser rights are still coordinators/lecturers in this system (one
            # of the shipped coordinators is a superuser), and filtering them out
            # hid the signed-in coordinator from their own user list.
            queryset = scoped_to_user_programme(
                base_queryset, user, field='profile__programme'
            ).order_by(
                Case(
                    When(profile__role='coordinator', then=Value(1)),
                    When(profile__role='lecturer', then=Value(2)),
                    When(profile__role='student', then=Value(3)),
                    default=Value(4)
                ),
                'profile__programme__code',
                'profile__full_name'
            )

        return queryset

    def get_serializer_class(self):
        # Writes go through the dedicated serializer; every read keeps the
        # read-only shape the rest of the app already consumes.
        if self.action in ('create', 'update', 'partial_update'):
            return UserWriteSerializer
        return UserSerializer

    def _ensure_can_manage_users(self):
        """Creating, editing and deleting accounts: coordinator or administrator.

        Both roles run the same screen; what differs is only which accounts each
        of them can see in the first place (see `get_queryset`). Anything they
        cannot see they cannot fetch by id either, so the object-level check is
        the queryset itself.
        """
        profile = getattr(self.request.user, 'profile', None)
        if not profile or profile.role not in self.MANAGE_ROLES:
            raise PermissionDenied(
                'Only a coordinator or an administrator can create or edit user accounts.'
            )

    def create(self, request, *args, **kwargs):
        # No programme requirement: every programme is selectable, so a
        # coordinator whose own account holds no programme can still create
        # accounts by choosing one explicitly.
        self._ensure_can_manage_users()
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        self._ensure_can_manage_users()
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        self._ensure_can_manage_users()
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._ensure_can_manage_users()

        target = self.get_object()
        target_profile = getattr(target, 'profile', None)

        # Locking yourself out of your own system, or removing the other person
        # who can run the course, is unrecoverable from the interface.
        if target.pk == request.user.pk:
            raise ValidationError({
                'error': 'You cannot delete your own account. Ask another coordinator if it must be removed.'
            })

        if target.is_superuser or (
            target_profile and target_profile.role in ('coordinator', 'admin')
        ):
            raise ValidationError({
                'error': f'{target.username} is a coordinator or administrator account and cannot be deleted from here.'
            })

        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['post'], url_path='delete-own-account')
    def delete_own_account(self, request):
        """Delete the signed-in coordinator's own account.

        Kept separate from `destroy`, which refuses self-deletion outright. That
        refusal is right for the user list, where one slip of the mouse would take
        out an account; deleting your own is a deliberate act, so it lives behind
        its own endpoint and its own route in the UI.

        The password is re-checked because a signed-in browser session is not on
        its own proof that the person at the keyboard intends to destroy the
        account, and this is irreversible from the interface. Django's
        `check_password` verifies the salted hash — the readable
        `Profile.visible_password` copy is never used for authentication.

        Only a coordinator may call it, and the action is bound to `request.user`
        with no id in the payload, so it cannot be pointed at anyone else.
        """
        profile = get_user_profile(request.user)
        if not profile or profile.role != 'coordinator':
            raise PermissionDenied('Only a coordinator can delete their own account.')

        password = request.data.get('password') or ''
        if not password:
            return Response(
                {'error': 'Enter your password to confirm.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not request.user.check_password(password):
            return Response(
                {'error': 'That password is not correct.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        username = request.user.username
        programme_code = profile.programme.code if profile.programme else None

        # What the deletion leaves behind, reported rather than silently applied,
        # so the account holder is not surprised by a course with no examiner.
        projects_still_unassigned = FYPProject.objects.filter(
            Q(supervisor=request.user) | Q(co_supervisor=request.user)
        ).count()
        other_coordinators = User.objects.filter(
            profile__role='coordinator', profile__programme=profile.programme,
        ).exclude(pk=request.user.pk).count()

        request.user.delete()

        return Response({
            'status': 'success',
            'message': f'Account {username} has been deleted.',
            'programme_code': programme_code,
            'projects_now_without_a_supervisor': projects_still_unassigned,
            'other_coordinators_left_in_the_programme': other_coordinators,
        })

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

        # The role is what grants the coordinator tools, but the programme is
        # what makes them useful: every programme-wide query (student list, user
        # list, overview, examiner auto-assignment) filters on
        # profile.programme and returns an empty set when it is missing. A
        # lecturer promoted from a cohort with no programme would therefore take
        # over the role and see nothing, so the course they are inheriting
        # supplies the programme when they have none of their own.
        inherited_programme = None
        if new_coordinator_profile.programme is None and current_coordinator_profile.programme is not None:
            new_coordinator_profile.programme = current_coordinator_profile.programme
            inherited_programme = current_coordinator_profile.programme.name

        new_coordinator_profile.role = 'coordinator'
        new_coordinator_profile.save()
        
        current_coordinator_profile.role = 'lecturer'
        current_coordinator_profile.save()
        
        message = f'Coordinator role has been successfully transferred to {lecturer_to_promote.profile.full_name}. You have been demoted to a lecturer.'
        if inherited_programme:
            message += f' They have been assigned to the {inherited_programme} programme.'

        return Response({
            'status': 'success',
            'message': message
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
        profile = get_user_profile(user)

        if not profile or profile.role != 'coordinator':
            return FYPProject.objects.none()

        # Cohort-scoped: a coordinator sees the students of their own programme.
        # This was briefly every project in the institution while the legacy
        # 'General' placeholder still held accounts (the programme-bounded
        # filter returned nothing for a coordinator filed under it). Migration
        # 0017 removed that placeholder, so the bound is correct again.
        return scoped_to_user_programme(
            FYPProject.objects.select_related(
                'student__profile',
                'supervisor__profile',
                'co_supervisor__profile',
                'examiner__profile',
                'programme',
            ),
            user,
        ).order_by('student__profile__student_id_no')

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
    """Cohort counts for the coordinator dashboard.

    Scoped to the signed-in coordinator's programme. These counts were briefly
    institution-wide, which made the dashboard a false statement rather than
    just a leak: the panel is headed "Every registered FYP student in your
    course" while counting every programme at once, so "submitted" and
    "total students" came from different populations. Migration 0017 removed the
    legacy 'General' placeholder that made the programme filter return zero, so
    the bound is safe to apply again.
    """
    profile = get_user_profile(request.user)
    if not profile or profile.role != 'coordinator':
        return Response({'error': 'Unauthorized'}, status=403)

    programme = profile.programme
    if programme is None:
        return Response(
            {'error': 'Your account is not assigned to a programme, so it has no cohort to summarise.'},
            status=403,
        )

    # Both populations are filtered by the same programme, so the percentages the
    # dashboard derives (submitted/total, approved/submitted) are ratios of one
    # cohort rather than of the whole institution.
    students = User.objects.filter(profile__role='student', profile__programme=programme)
    submissions = Submissions.objects.filter(student__profile__programme=programme)

    data = {
        'programme_code': programme.code,
        'programme_name': programme.name,
        'total_students': students.count(),
        'total_supervisors': User.objects.filter(
            profile__role__in=['lecturer', 'coordinator'], profile__programme=programme
        ).count(),

        'projects_submitted': submissions.count(),
        'pending_reviews': submissions.filter(status='pending').count(),
        'approved_projects': submissions.filter(status='approved').count(),
        'revision_needed': submissions.filter(status='revision').count(),
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


def _require_coordinator_or_lecturer(request, what):
    """Guard for the supervision-quota endpoints.

    These four views had no role check at all, so any signed-in account —
    including a student — could read every lecturer's allocation and write a new
    quota. They are staff tools, so both roles are allowed here and the programme
    bound below is what stops one cohort reading another's.
    """
    profile = get_user_profile(request.user)
    if not profile or profile.role not in ('coordinator', 'lecturer'):
        raise PermissionDenied(f'Only a coordinator or lecturer can {what}.')
    if profile.programme is None:
        raise PermissionDenied(
            f'Your account is not assigned to a programme, so it has no {what} to show.'
        )
    return profile


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_supervisor_quotas(request):
    profile = _require_coordinator_or_lecturer(request, 'view supervisor quotas')

    lecturers = User.objects.filter(
        profile__role='lecturer', profile__programme=profile.programme
    ).select_related('profile').order_by('profile__full_name')
    results = []
    for lec in lecturers:
        q = SupervisorQuotas.objects.filter(lecturer=lec).first()
        total = q.quota_total if q else 0
        assigned = FYPProject.objects.filter(supervisor=lec).count()
        results.append({
            'id': lec.id, 'name': lec.profile.full_name or lec.username,
            'total_quota': total, 'assigned_count': assigned,
            # Clamped for the same reason as get_my_quota: an over-allocated
            # lecturer should read "0 left", not a negative number.
            'available_quota': max(total - assigned, 0)
        })
    return Response({'success': True, 'quotas': results})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_supervisor_students(request, lecturer_id):
    profile = _require_coordinator_or_lecturer(request, 'view a supervisor\'s students')

    # Both bounds matter: the requested lecturer must be in the caller's own
    # programme, so this cannot be used to enumerate another cohort by guessing
    # an id.
    projects = FYPProject.objects.filter(
        supervisor_id=lecturer_id,
        programme=profile.programme,
    ).select_related('student__profile', 'supervisor__profile', 'examiner__profile')
    return Response(FYPProjectSerializer(projects, many=True).data)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_supervisor_quota(request, lecturer_id):
    profile = _require_coordinator_or_lecturer(request, 'change a supervision quota')

    # Writing a quota is the coordinator's call; a lecturer may only look.
    if profile.role != 'coordinator':
        raise PermissionDenied('Only a coordinator can change a supervision quota.')

    val = request.data.get('quota_total')
    try:
        quota_total = int(val)
    except (TypeError, ValueError):
        return Response({'error': 'quota_total must be a whole number.'}, status=400)
    if quota_total < 0:
        return Response({'error': 'quota_total cannot be negative.'}, status=400)

    target = User.objects.filter(
        id=lecturer_id,
        profile__programme=profile.programme,
        profile__role__in=['lecturer', 'coordinator'],
    ).first()
    if target is None:
        return Response(
            {'error': 'That lecturer is not in your programme.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    SupervisorQuotas.objects.update_or_create(
        lecturer=target, defaults={'quota_total': quota_total}
    )
    return Response({"success": True})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_student_dashboard_data(request, student_id):
    """A student's TRF status and unread-feedback count.

    Reachable only by that student, by their supervisor/co-supervisor, or by a
    coordinator of their programme. The view previously accepted any id from any
    signed-in account, so a student could read a classmate's record by changing
    one number in the URL.
    """
    caller_profile = get_user_profile(request.user)
    if caller_profile is None:
        return Response({'error': 'No profile found'}, status=status.HTTP_403_FORBIDDEN)

    student = User.objects.filter(id=student_id, profile__role='student').select_related('profile').first()
    if student is None:
        return Response({'error': 'No such student.'}, status=status.HTTP_404_NOT_FOUND)

    student_profile = student.profile
    is_self = student.id == request.user.id
    is_own_cohort = (
        caller_profile.programme_id is not None
        and caller_profile.programme_id == student_profile.programme_id
    )

    if is_self:
        allowed = True
    elif caller_profile.role == 'coordinator':
        allowed = is_own_cohort
    elif caller_profile.role == 'lecturer':
        allowed = is_own_cohort and FYPProject.objects.filter(
            student=student,
        ).filter(Q(supervisor=request.user) | Q(co_supervisor=request.user)).exists()
    else:
        allowed = False

    if not allowed:
        return Response(
            {'error': 'You do not have access to this student.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    sub = Submissions.objects.filter(student_id=student_id).order_by('-created_at').first()
    unread = Feedback.objects.filter(submission__student_id=student_id, is_read=False).count()
    return Response({'success': True, 'data': {
        'submission_status': sub.status.capitalize() if sub else "Not Submitted",
        'unread_feedback_count': unread,
        'full_name': student_profile.full_name
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

def _sync_submission_programme(submission):
    """Keep `Submissions.programme` in step with the student's programme.

    `Submissions.programme` is free text rather than a foreign key, so it used to
    hold whatever the student typed on the TRF — eight rows carried the human
    string 'Bachelor of Computer Science' while the programme row is coded 'BCS',
    which is why a programme-grouped report could not match them. It is derived
    here the same way `FYPProject.save()` derives its programme, so the column
    stays a copy of one source of truth instead of a second opinion.
    """
    profile = getattr(submission.student, 'profile', None)
    programme = getattr(profile, 'programme', None)
    if programme is None:
        return
    if submission.programme != programme.name:
        submission.programme = programme.name
        submission.save(update_fields=['programme'])


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
        _sync_submission_programme(submission)

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
        _sync_submission_programme(instance)

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

    def _ensure_coordinator(self):
        """Publishing notices is a coordinator action.

        This viewset had no role check at all, so any signed-in account could
        create, edit and delete announcements, which the read path then presents
        to the cohort as an official notice from its coordinator.
        """
        profile = get_user_profile(self.request.user)
        if not profile or profile.role != 'coordinator':
            raise PermissionDenied('Only a coordinator can publish or change announcements.')
        if profile.programme is None:
            # An announcement with no programme matches no read query — the read
            # filter compares against a programme id, and NULL never equals
            # anything — so it would be posted and seen by nobody, including its
            # author. Refusing is clearer than a silent no-op.
            raise ValidationError({
                'error': 'Your account is not assigned to a programme, so an announcement you post would be visible to nobody.'
            })
        return profile

    def get_queryset(self):
        user = self.request.user
        programme = get_user_programme(user)
        if programme is None:
            return Announcements.objects.none()
        return Announcements.objects.filter(
            programme=programme
        ).select_related('coordinator__profile').order_by('-created_at')

    def create(self, request, *args, **kwargs):
        self._ensure_coordinator()
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        self._ensure_coordinator()
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        self._ensure_coordinator()
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._ensure_coordinator()
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        profile = self._ensure_coordinator()
        serializer.save(
            coordinator=self.request.user,
            programme=profile.programme,
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
        # Same two roles as UserViewSet: bulk upload is the other half of the
        # same screen, so an administrator gets it too.
        if request.user.profile.role not in ('coordinator', 'admin'):
            return Response(status=status.HTTP_403_FORBIDDEN)

        # Only an administrator may hand out administrator access, here as
        # everywhere else. The spreadsheet supplies the role as free text, so
        # without this a coordinator could mint an account that outranks them
        # just by typing 'admin' in a column.
        caller_is_admin = request.user.profile.role == 'admin'

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
                    # Resolve the programme before creating anything. A bad code
                    # must fail the row while nothing has been written yet:
                    # validating after the user exists would leave a signed-in
                    # account with no Profile, which is worse than a skipped row.
                    missing = object()
                    raw_code = row.get('programme_code', missing)
                    if raw_code is missing or raw_code is None:
                        raise ValueError(
                            'the programme_code column is missing or blank for this row. '
                            'Add the programme each account belongs to (for example BCS).'
                        )

                    # Whitespace stripped so " BCS " and "BCS" are the same code.
                    code = str(raw_code).strip()
                    programme = Programme.objects.filter(code__iexact=code).first()
                    if programme is None:
                        known = ', '.join(
                            Programme.objects.order_by('code').values_list('code', flat=True)
                        ) or 'none configured'
                        raise ValueError(
                            f'unknown programme code "{code}". Use one of: {known}. '
                            'The programme has to exist before accounts can be filed under it.'
                        )

                    # Resolved together with the programme, and for the same
                    # reason: a row that will be refused must be refused before
                    # anything is written, or it leaves a signed-in account with
                    # no Profile behind.
                    role = str(row.get('role', 'student')).lower().strip()
                    if role == 'admin' and not caller_is_admin:
                        raise ValueError(
                            'the "admin" role cannot be granted from a spreadsheet by a '
                            'coordinator. Only an administrator can create administrator accounts.'
                        )

                    username = str(row['username']).strip()
                    user, user_created = User.objects.get_or_create(username=username)
                    if user_created:
                        user.set_password(BULK_UPLOAD_PASSWORD)
                        user.save()
                        created_users_count += 1

                    profile_defaults = {
                        'full_name': row.get('full_name'),
                        'role': role,
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
                        # FYPProject.save() derives the programme from the student's
                        # profile, so it is not passed here.
                        project, project_created = FYPProject.objects.get_or_create(
                            student=user,
                            defaults={
                                'title': 'Pending TRF Submission',
                                'student_matric_id': row.get('student_matric_id'),
                                'fyp_stage': str(row.get('fyp_stage', 'FYP1')).upper().strip(),
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
    """The coordinator's student list as a spreadsheet.

    Scoped to the caller's own programme. This export was briefly institution-wide
    so that a coordinator filed under the legacy 'General' placeholder still got a
    file; migration 0017 removed that placeholder, and a coordinator handing out
    another cohort's student records was never the intent.
    """
    profile = get_user_profile(request.user)
    if not profile or profile.role != 'coordinator':
        return Response({'error': 'Unauthorized'}, status=403)

    programme = profile.programme
    if programme is None:
        return Response(
            {'error': 'Your account is not assigned to a programme, so it has no students to export.'},
            status=403,
        )

    queryset = FYPProject.objects.filter(
        student__profile__programme=programme
    ).order_by('student_matric_id')

    fyp_stage_filter = request.query_params.get('fyp_stage', None)
    if fyp_stage_filter in ['FYP1', 'FYP2']:
        queryset = queryset.filter(fyp_stage=fyp_stage_filter)

    # Programme kept as a column so the sheet is self-describing, and so the same
    # export shape still works if it is ever widened again.
    data = queryset.values(
        'student_matric_id',
        'student__profile__full_name',
        'student__profile__programme__code',
        'title',
        'supervisor__profile__full_name',
        'examiner__profile__full_name',
        'fyp_stage'
    )
    
    df = pd.DataFrame(list(data))
    df.rename(columns={
        'student_matric_id': 'Student ID',
        'student__profile__full_name': 'Student Name',
        'student__profile__programme__code': 'Programme',
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
    # The programme code is safe to use here: the guard above already returned a
    # 403 for a coordinator holding no programme, so `programme.code` cannot be
    # reached with a null programme.
    response['Content-Disposition'] = (
        f'attachment; filename="FYP_Student_List_{programme.code}.xlsx"'
    )
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

    # examiner__isnull=True is the whole point: this is a bulk *fill* for students
    # who have no examiner yet, not a re-roll. Without it every call re-randomised
    # the examiner for every project in the programme, silently overwriting
    # assignments that had already been made (the pool is rebuilt per project, so
    # the previous examiner was not even excluded from the draw) — while the
    # "already have an examiner" message below claimed the opposite.
    projects_to_assign = FYPProject.objects.filter(
        student__profile__programme=programme,
        examiner__isnull=True,
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
@permission_classes([IsAuthenticated])
def sync_missing_projects(request):
    """Create the placeholder project row for any student who lacks one.

    Coordinator-only, and bounded to the caller's programme. It was previously
    role-unchecked and institution-wide, so any signed-in account could trigger a
    write across every cohort — and it also created projects for students who sit
    on no programme at all, which is the state migration 0017 exists to remove.
    """
    profile = get_user_profile(request.user)
    if not profile or profile.role != 'coordinator':
        return Response(
            {'error': 'Unauthorized. Only a coordinator can create missing project rows.'},
            status=403,
        )
    if profile.programme is None:
        return Response(
            {'error': 'Your account is not assigned to a programme, so there is no cohort to sync.'},
            status=403,
        )

    # Students with no programme are skipped deliberately: a project row for them
    # would carry a null programme, which is exactly the drift this system is
    # being cleaned of. They are listed in the response so the coordinator can
    # see who still needs assigning rather than being told "0 created".
    students = User.objects.filter(
        profile__role='student',
        profile__programme=profile.programme,
    ).select_related('profile')

    created_count = 0
    for student in students:
        obj, created = FYPProject.objects.get_or_create(
            student=student,
            defaults={
                'title': 'Pending TRF Submission',
                'student_matric_id': student.profile.student_id_no or '',
                'fyp_stage': 'FYP1',
            }
        )
        if created:
            created_count += 1

    unassigned = User.objects.filter(
        profile__role='student', profile__programme__isnull=True
    ).count()

    message = f'Created {created_count} placeholder projects.'
    if unassigned:
        message += f' {unassigned} student account(s) still hold no programme and were skipped.'
    return Response({
        'message': message,
        'created': created_count,
        'students_without_a_programme': unassigned,
    })

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
    """Repair project rows that disagree with their student's programme.

    Bounded to the caller's programme: the repair itself is idempotent and safe,
    but a coordinator triggering a write across every other cohort is not
    something a scoped role should be able to do. Migration 0017 performs the
    same repair once for the whole database, so this endpoint is now the
    on-demand version of a fix that has already been applied.
    """
    profile = get_user_profile(request.user)
    if not profile or profile.role != 'coordinator':
        return Response({'error': 'Unauthorized. Only coordinators can run this sync.'}, status=403)
    if profile.programme is None:
        return Response(
            {'error': 'Your account is not assigned to a programme, so there is no cohort to sync.'},
            status=403,
        )

    projects_to_sync = FYPProject.objects.filter(
        student__profile__programme=profile.programme
    ).select_related('student__profile')
    synced_count = 0
    errors = []

    for project in projects_to_sync:
        try:
            student_profile = project.student.profile
            updated = False

            # Compare ids, not the related object, so a project on the right
            # programme is not re-saved on every run.
            if project.programme_id != student_profile.programme_id and student_profile.programme_id:
                project.programme_id = student_profile.programme_id
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
        'message': f'Scan complete. Synced data for {synced_count} projects in {profile.programme.code}.',
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