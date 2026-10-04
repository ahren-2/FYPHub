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
    # The human-readable side of programme_id, so a list can show and group by
    # programme without a second request per row.
    programme_name = serializers.CharField(source='profile.programme.name', read_only=True, allow_null=True)
    programme_code = serializers.CharField(source='profile.programme.code', read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'email', 'role', 'student_id_no', 'phone_no',
                  'visible_password', 'programme_id', 'programme_name', 'programme_code',
                  # Read-only, so the user list can disable Delete for administrator
                  # accounts instead of letting the request fail server-side.
                  'is_superuser']


# Password given to an account when the coordinator creates one without typing
# a password. Matches the default the bulk Excel upload uses.
DEFAULT_NEW_USER_PASSWORD = 'wow12345'

# One wording for the rule, so the form, the API and the tests cannot disagree
# about what is being asked for.
FULL_NAME_REQUIRED_MESSAGE = (
    'A full name is required — it is what this account is shown by everywhere in FYPHub.'
)


def actor_programme(request):
    """The signed-in account's programme, or None.

    Needed where validation has to reason about the cohort *before* the view's
    ``perform_create`` has attached it — the timetable serializers take
    ``programme`` as read-only, so at validation time the only place it exists is
    the request.
    """
    profile = getattr(getattr(request, 'user', None), 'profile', None)
    return getattr(profile, 'programme', None)


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
    # Required, and never blank. The full name is how an account is named to a
    # human: the student list, the marks table, the timetable and the
    # announcements all read `profile.full_name` and quietly fall back to the
    # username when it is empty, so an account saved without one appears under a
    # different name on every screen it reaches.
    full_name = serializers.CharField(
        source='profile.full_name',
        required=True,
        allow_blank=False,
        error_messages={
            'required': FULL_NAME_REQUIRED_MESSAGE,
            'blank': FULL_NAME_REQUIRED_MESSAGE,
        },
    )
    role = serializers.ChoiceField(choices=Profile.ROLE_CHOICES, source='profile.role', required=False)
    student_id_no = serializers.CharField(
        source='profile.student_id_no', required=False, allow_blank=True, allow_null=True
    )
    phone_no = serializers.CharField(
        source='profile.phone_no', required=False, allow_blank=True, allow_null=True
    )
    # Which programme the account belongs to. Accepted as a programme id, the
    # same value UserSerializer hands back as programme_id, so the edit form can
    # round-trip a row without translating anything.
    programme = serializers.PrimaryKeyRelatedField(
        source='profile.programme',
        queryset=Programme.objects.all(),
        required=False,
        allow_null=True,
        error_messages={'does_not_exist': 'That programme does not exist.'},
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
            'full_name', 'role', 'student_id_no', 'phone_no', 'programme',
            'visible_password', 'fyp_stage',
        ]

    def validate_role(self, value):
        """Only an administrator may grant administrator access.

        The role field is a ChoiceField over Profile.ROLE_CHOICES, which now
        includes 'admin', so without this any coordinator could promote an
        account — their own included — to the one role that sees every cohort.
        Kept in the serializer rather than the view so every write path that goes
        through this serializer is covered by construction.
        """
        request = self.context.get('request')
        actor = getattr(getattr(request, 'user', None), 'profile', None)
        if value == 'admin' and (actor is None or actor.role != 'admin'):
            raise serializers.ValidationError(
                'Only an administrator can grant administrator access.'
            )
        return value

    def validate_full_name(self, value):
        """Whitespace is not a name.

        ``allow_blank=False`` refuses ``''`` but lets ``'   '`` through, and that
        strips down to the empty name this field was made required to prevent —
        which is exactly the state that leaves an account showing as its
        username in every list.
        """
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError(FULL_NAME_REQUIRED_MESSAGE)
        return value

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

    def validate_student_id_no(self, value):
        """One matric number belongs to one account.

        Saved marks are matched to a student by this exact string
        (``RubricMarks.student_id``) and the Course Performance Report counts
        those marks per student, so two accounts holding the same number would
        silently pool their marks into a single report row. Nothing in the
        database prevents that — ``Profile.student_id_no`` carries no unique
        constraint, because the bulk upload writes it as free text — so the
        guard lives here, on the only path that edits it directly.
        """
        value = (value or '').strip()
        if not value:
            return ''
        existing = Profile.objects.filter(student_id_no__iexact=value)
        if self.instance is not None:
            existing = existing.exclude(user=self.instance)
        if existing.exists():
            raise serializers.ValidationError(
                'Another account already uses this student ID.'
            )
        return value

    @staticmethod
    def _carry_student_id_to_related_rows(user, previous_student_id_no, new_student_id_no):
        """Carry a student ID onto the rows that match the student by it.

        ``Profile.student_id_no`` is not the only copy of the number.
        ``FYPProject.student_matric_id`` is what the Student List, the
        Timetabling page and the Course Performance Report display, and
        ``RubricMarks.student_id`` is the key saved marks are matched on.
        Correcting the profile alone left every one of those showing the old
        number — the edit looked like it had been ignored, because the field
        being edited is not the field those pages read.
        """
        # The project row mirrors the profile's copy, including when a student
        # captured without a matric is given one later: the lists read this
        # column, so leaving it blank would keep the student unnumbered there.
        # Saved one at a time rather than through queryset.update(), matching the
        # programme propagation below — FYPProject.save() derives the row's
        # programme from its student, and a bulk update would bypass that rule.
        for project in FYPProject.objects.filter(student=user):
            project.student_matric_id = new_student_id_no
            project.save()

        # Marks are only re-keyed when there was a number for them to follow. An
        # account that held none has no row keyed on it, and re-pointing every
        # row whose student_id was blank would sweep up other people's marks.
        # `update()` is safe and cheaper than loading them: a mark row has no
        # derived columns, and the old matric identifies exactly one student.
        if previous_student_id_no:
            RubricMarks.objects.filter(student_id=previous_student_id_no).update(
                student_id=new_student_id_no
            )

    def _coordinator_programme(self):
        """The creating coordinator's own programme, used only as a default.

        This is a fallback for a request that omits ``programme`` entirely, not a
        restriction: any programme may be chosen explicitly. The list and the
        form both offer every programme.
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
        # The account's programme as chosen on the form. Falls back to the
        # coordinator's own programme so a direct API call that omits it still
        # lands somewhere visible instead of creating an orphan account.
        profile_data.setdefault('programme', self._coordinator_programme())
        # Keep the readable copy in step with the hash so a coordinator can look
        # the password up later.
        profile_data['visible_password'] = password
        profile, _ = Profile.objects.update_or_create(user=user, defaults=profile_data)

        if profile.role == 'student':
            # No `programme` here: FYPProject.save() derives it from the student's
            # profile, so passing it would be a second, competing source of truth.
            FYPProject.objects.get_or_create(
                student=user,
                defaults={
                    'title': 'Pending TRF Submission',
                    'student_matric_id': profile.student_id_no or '',
                    'fyp_stage': fyp_stage or 'FYP1',
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
            # Remembered before the write so we can tell whether the account
            # actually moved programme.
            previous_programme_id = profile.programme_id
            # Same reason for the matric: it is the key every other table matches
            # this student by, so a change has to be carried out rather than
            # looked for afterwards on a row that no longer holds the old value.
            previous_student_id_no = (profile.student_id_no or '').strip()

            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            if password:
                # Keep the readable copy in step with the new hash.
                profile.visible_password = password
            profile.save()

            # The project row holds its own copy of the programme, so moving the
            # account has to move the project with it or the student vanishes from
            # their new programme's list. Saved one at a time rather than via
            # queryset.update(), which bypasses FYPProject.save() and with it the
            # rule that a project follows its student's programme.
            if profile.programme_id != previous_programme_id and profile.role == 'student':
                for project in FYPProject.objects.filter(student=instance):
                    project.save()

            # The same row, and every saved mark, also holds its own copy of the
            # student ID. See the helper for why all three have to move together.
            new_student_id_no = (profile.student_id_no or '').strip()
            if new_student_id_no != previous_student_id_no:
                self._carry_student_id_to_related_rows(
                    instance, previous_student_id_no, new_student_id_no
                )

            # `instance` was loaded through `UserViewSet.get_queryset()`, which
            # uses select_related('profile'), so its cached profile still holds
            # the values from before this write. Without this the response would
            # report the old student ID (and old full name, role and programme)
            # straight back to the caller — an edit that did work, answered with
            # the values it replaced.
            instance.profile = profile

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


class PresentationDaySerializer(serializers.ModelSerializer):
    """A presentation date, as the timetable pages consume it.

    `programme` is read-only because it is taken from the signed-in coordinator
    rather than chosen per row, so a coordinator cannot file a date under another
    cohort.
    """
    programme_code = serializers.CharField(source='programme.code', read_only=True, allow_null=True)

    class Meta:
        model = PresentationDay
        fields = ['id', 'date', 'programme', 'programme_code']
        read_only_fields = ['programme']

    def validate_date(self, value):
        """One row per (date, programme), checked here rather than left to the
        database. `programme` is read-only on this serializer, so DRF cannot
        build its usual unique-together validator and a repeat slipped through to
        the unique index as an IntegrityError — an HTTP 500 error page instead of
        a message the timetable screen can show.
        """
        programme = actor_programme(self.context.get('request'))
        if programme is not None and PresentationDay.objects.filter(
            programme=programme, date=value
        ).exists():
            raise serializers.ValidationError(
                'That date is already configured as a presentation day for your programme.'
            )
        return value


class VenueSerializer(serializers.ModelSerializer):
    """A presentation venue, as the timetable pages consume it."""
    programme_code = serializers.CharField(source='programme.code', read_only=True, allow_null=True)

    class Meta:
        model = Venue
        fields = ['id', 'name', 'programme', 'programme_code']
        read_only_fields = ['programme']

    def validate_name(self, value):
        """One row per (name, programme), for the same reason as the day above.

        Matched case-insensitively on purpose: the column's collation is
        `utf8mb4_general_ci`, so the unique index treats "CL3" and "cl3" as the
        same venue and an exact-match check would let the second one through to
        fail at the database.
        """
        name = (value or '').strip()
        if not name:
            raise serializers.ValidationError('A venue name is required.')
        programme = actor_programme(self.context.get('request'))
        if programme is not None and Venue.objects.filter(
            programme=programme, name__iexact=name
        ).exists():
            raise serializers.ValidationError(
                f'"{name}" is already configured as a venue for your programme.'
            )
        return name

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