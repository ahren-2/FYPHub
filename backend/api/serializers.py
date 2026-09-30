from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Programme, Profile, FYPProject, TimetableBooking, 
    TimetableSlot, PresentationDay, Venue, PresentationSlot,
    Submissions, Feedback, MilestoneForms, MilestoneEntries, 
    SupervisorQuotas, Announcements, LecturerPreference,
    RubricTemplate, RubricMarks
)

class ProgrammeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Programme
        fields = ['id', 'name', 'code']

class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='profile.full_name', read_only=True)
    role = serializers.CharField(source='profile.role', read_only=True)
    student_id_no = serializers.CharField(source='profile.student_id_no', read_only=True)
    phone_no = serializers.CharField(source='profile.phone_no', read_only=True)
    visible_password = serializers.CharField(source='profile.visible_password', read_only=True)
    programme_id = serializers.IntegerField(source='profile.programme.id', read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'email', 'role', 'student_id_no', 'phone_no',
                  'visible_password', 'programme_id',
                  # Read-only, so the user list can disable Delete for administrator
                  # accounts instead of letting the request fail server-side.
                  'is_superuser']


# Password given to an account when the coordinator creates one without typing
# a password. Matches the default the bulk Excel upload uses.
DEFAULT_NEW_USER_PASSWORD = 'wow12345'


class UserWriteSerializer(serializers.ModelSerializer):
    """Create/edit one account (coordinator only).

    Kept separate from UserSerializer, which every read path uses and which must
    stay read-only. Profile fields are writable here and are written through the
    related Profile, because a dotted ``source`` cannot be handed straight to
    ``User.objects.create()``.

    ``password`` is write-only: Django stores a one-way hash, so a stored
    password can never be read back out.
    """

    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        min_length=6,
        error_messages={'min_length': 'The password must be at least 6 characters long.'},
    )
    full_name = serializers.CharField(source='profile.full_name', required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=Profile.ROLE_CHOICES, source='profile.role', required=False)
    student_id_no = serializers.CharField(
        source='profile.student_id_no', required=False, allow_blank=True, allow_null=True
    )
    phone_no = serializers.CharField(
        source='profile.phone_no', required=False, allow_blank=True, allow_null=True
    )
    # Only meaningful for a student: the stage of the project record created alongside them.
    fyp_stage = serializers.ChoiceField(
        choices=FYPProject.FYP_STAGE_CHOICES, required=False, write_only=True
    )
    # Read-only here so a create/update response has the same shape as the list.
    visible_password = serializers.CharField(source='profile.visible_password', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'password',
            'full_name', 'role', 'student_id_no', 'phone_no',
            'visible_password', 'fyp_stage',
        ]

    def validate_username(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('A username is required.')
        # Case-insensitive so "Ali" cannot be created next to an existing "ali".
        existing = User.objects.filter(username__iexact=value)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError('An account with this username already exists.')
        return value

    def validate_email(self, value):
        value = (value or '').strip()
        if value:
            existing = User.objects.filter(email__iexact=value)
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise serializers.ValidationError('An account with this email address already exists.')
        return value

    def _coordinator_programme(self):
        """New accounts belong to the coordinator's programme.

        UserViewSet only ever lists accounts from the coordinator's own
        programme, so anything filed elsewhere would be created and then vanish
        from the page.
        """
        request = self.context.get('request')
        profile = getattr(getattr(request, 'user', None), 'profile', None)
        return getattr(profile, 'programme', None)

    def create(self, validated_data):
        profile_data = validated_data.pop('profile', {})
        fyp_stage = validated_data.pop('fyp_stage', None)

        password = validated_data.pop('password', '') or DEFAULT_NEW_USER_PASSWORD
        user = User(**validated_data)
        user.set_password(password)
        user.save()

        profile_data.setdefault('role', 'student')
        profile_data.setdefault('programme', self._coordinator_programme())
        # Keep the readable copy in step with the hash so a coordinator can look
        # the password up later.
        profile_data['visible_password'] = password
        profile, _ = Profile.objects.update_or_create(user=user, defaults=profile_data)

        if profile.role == 'student':
            FYPProject.objects.get_or_create(
                student=user,
                defaults={
                    'title': 'Pending TRF Submission',
                    'student_matric_id': profile.student_id_no or '',
                    'fyp_stage': fyp_stage or 'FYP1',
                    'programme': profile.programme,
                },
            )

        return user

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', {})
        validated_data.pop('fyp_stage', None)
        # An empty password field on the edit form means "leave it alone".
        password = validated_data.pop('password', '')

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()

        if profile_data or password:
            profile, _ = Profile.objects.get_or_create(user=instance)
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            if password:
                # Keep the readable copy in step with the new hash.
                profile.visible_password = password
            profile.save()

        return instance

class SubmissionSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.profile.full_name', read_only=True)
    supervisor_name = serializers.CharField(source='supervisor.profile.full_name', read_only=True, allow_null=True)
    supervisor = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), allow_null=True, required=False)
    co_supervisor = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), allow_null=True, required=False)

    class Meta:
        model = Submissions
        fields = '__all__'
        read_only_fields = ['student', 'status']

class FYPProjectSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.profile.full_name')
    supervisor_name = serializers.ReadOnlyField(source='supervisor.profile.full_name')
    co_supervisor_name = serializers.ReadOnlyField(source='co_supervisor.profile.full_name')
    examiner_name = serializers.ReadOnlyField(source='examiner.profile.full_name')
    class Meta:
        model = FYPProject
        fields = '__all__'

class TimetableBookingSerializer(serializers.ModelSerializer):
    project_title = serializers.CharField(source='project.title', read_only=True)
    student_name = serializers.CharField(source='project.student.profile.full_name', read_only=True)
    student_id = serializers.CharField(source='project.student_matric_id', read_only=True)
    lecturer_name = serializers.CharField(source='lecturer.profile.full_name', read_only=True)
    examiner_name = serializers.CharField(source='examiner.profile.full_name', read_only=True)
    class Meta:
        model = TimetableBooking
        fields = '__all__'
        read_only_fields = ['lecturer']

class TimetableSlotSerializer(serializers.ModelSerializer):
    project_title = serializers.CharField(source='project.title', read_only=True)
    student_name = serializers.CharField(source='project.student.profile.full_name', read_only=True)
    student_id = serializers.CharField(source='project.student_matric_id', read_only=True)
    
    class Meta:
        model = TimetableSlot
        fields = ['id', 'project', 'project_title', 'student_name', 'student_id', 'start_time', 'end_time', 'venue']

class AnnouncementSerializer(serializers.ModelSerializer):
    coordinator_name = serializers.CharField(source='coordinator.profile.full_name', read_only=True)
    class Meta:
        model = Announcements
        fields = ['id', 'title', 'content', 'created_at', 'coordinator_name']
        read_only_fields = ['coordinator']

class FeedbackSerializer(serializers.ModelSerializer):
    lecturer_name = serializers.CharField(source='lecturer.profile.full_name', read_only=True)
    class Meta:
        model = Feedback
        fields = ['id', 'submission', 'lecturer', 'lecturer_name', 'comment', 'created_at', 'is_read']
        read_only_fields = ['lecturer']

class MilestoneEntriesSerializer(serializers.ModelSerializer):
    class Meta:
        model = MilestoneEntries
        fields = ['id', 'form', 'milestone_number', 'milestone_name', 'max_marks', 'score', 'status']
        read_only_fields = ['id', 'form']

class MilestoneFormsSerializer(serializers.ModelSerializer):
    entries = MilestoneEntriesSerializer(many=True, read_only=True)
    progress = serializers.SerializerMethodField()

    class Meta:
        model = MilestoneForms
        fields = '__all__'
        read_only_fields = ['lecturer']
        
    def get_progress(self, obj):
        approved_count = obj.entries.filter(status='approved').count()
        return f"{approved_count} / 8"

    def update(self, instance, validated_data):
        entries_data = self.context['request'].data.get('entries', [])
        
        instance.student_name = validated_data.get('student_name', instance.student_name)
        instance.fyp_title = validated_data.get('fyp_title', instance.fyp_title)
        instance.save()

        for entry_data in entries_data:
            entry_id = entry_data.get('id', None)
            if entry_id:
                try:
                    entry = MilestoneEntries.objects.get(id=entry_id, form=instance)
                    score_value = entry_data.get('score', entry.score)
                    entry.score = int(score_value) if score_value is not None and score_value != '' else None
                    entry.status = entry_data.get('status', entry.status)
                    entry.save()
                except (MilestoneEntries.DoesNotExist, ValueError):
                    pass
        
        return instance

class PresentationSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = PresentationSlot
        fields = ['id', 'date', 'venue_name']
        read_only_fields = ['programme']
        
class SimplePresentationDaySerializer(serializers.ModelSerializer):
    class Meta:
        model = PresentationDay
        fields = ['id', 'date']

class LecturerPreferenceSerializer(serializers.ModelSerializer):
    presentation_slot = PresentationSlotSerializer(read_only=True)
    presentation_slot_id = serializers.PrimaryKeyRelatedField(
        queryset=PresentationSlot.objects.all(), 
        source='presentation_slot', 
        write_only=True
    )

    class Meta:
        model = LecturerPreference
        fields =['id', 'lecturer', 'presentation_slot', 'presentation_slot_id', 'unavailable_slots']
        read_only_fields = ['lecturer']

class RubricTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = RubricTemplate
        fields = '__all__'
        read_only_fields = ['created_by']

class RubricMarksSerializer(serializers.ModelSerializer):
    class Meta:
        model = RubricMarks
        fields = '__all__'
        read_only_fields = ['evaluated_by']