from django.db import models
from django.contrib.auth.models import User

class Programme(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=10, unique=True)
    def __str__(self):
        return self.name

class Profile(models.Model):
    # `admin` is the account-maintenance role, added for handover: it exists to
    # look after accounts, not to run a course. It is deliberately NOT a
    # coordinator, so every course-level screen and endpoint that tests
    # `role == 'coordinator'` stays closed to it — the only workspace it opens is
    # User Management, and `UserViewSet` is the one read path that treats it
    # specially, by showing accounts from every programme instead of one cohort.
    ROLE_CHOICES = (
        ('student', 'Student'), ('lecturer', 'Lecturer'),
        ('coordinator', 'Coordinator'), ('admin', 'Administrator'),
    )
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    full_name = models.CharField(max_length=255, blank=True, verbose_name="Full Name")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    programme = models.ForeignKey(Programme, on_delete=models.SET_NULL, null=True, blank=True)
    phone_no = models.CharField(max_length=50, blank=True, null=True)
    student_id_no = models.CharField(max_length=50, blank=True, null=True)
    # A readable copy of the sign-in password, kept only so a coordinator can
    # look up or edit an account they administer. It is NEVER used to
    # authenticate — `user.password` (a salted hash) remains the real check —
    # and it is blank for any account whose password was set outside the
    # coordinator screens. Anyone with database or API access can read this
    # column, so treat it as a convenience, not as a secret store.
    visible_password = models.CharField(max_length=128, blank=True, default='', verbose_name="Stored Password")

    def __str__(self):
        return self.user.username

class FYPProject(models.Model):
    FYP_STAGE_CHOICES = (('PROPOSAL', 'Proposal Defense'),('FYP1', 'Final Year Project 1'), ('FYP2', 'Final Year Project 2'))
    student = models.OneToOneField(User, on_delete=models.CASCADE, limit_choices_to={'profile__role': 'student'})
    student_matric_id = models.CharField(max_length=50, blank=True, verbose_name="Student ID")
    title = models.CharField(max_length=255)
    supervisor = models.ForeignKey(User, related_name='supervised_projects', on_delete=models.SET_NULL, null=True, limit_choices_to={'profile__role': 'lecturer'})
    co_supervisor = models.ForeignKey(User, related_name='cosupervised_projects', on_delete=models.SET_NULL, null=True, blank=True, limit_choices_to={'profile__role': 'lecturer'})
    examiner = models.ForeignKey(User, related_name='examined_projects', on_delete=models.SET_NULL, null=True, blank=True, limit_choices_to={'profile__role': 'lecturer'})
    programme = models.ForeignKey(Programme, on_delete=models.SET_NULL, null=True, blank=True)
    fyp_stage = models.CharField(max_length=20, choices=FYP_STAGE_CHOICES, default='FYP1')

    def save(self, *args, **kwargs):
        """A project belongs to the programme of its student, always.

        The programme is a copy of the student's, kept for convenient filtering,
        so it is derived here rather than trusted from the caller. The two used to
        drift: 14 students had a profile on the legacy 'General' programme while
        their project row pointed at BCS/BDM/BMD/BID, and every programme-filtered
        screen disagreed about who belonged where as a result.

        Only synced when the student actually holds a programme, so a project is
        never silently blanked while a student's programme is still unset.
        """
        profile = getattr(self.student, 'profile', None)
        if profile is not None and profile.programme_id is not None:
            self.programme_id = profile.programme_id
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title

class PresentationDay(models.Model):
    date = models.DateField()
    programme = models.ForeignKey(Programme, on_delete=models.CASCADE, related_name='presentation_days') 
    class Meta:
        unique_together = ('date', 'programme')

class Venue(models.Model):
    name = models.CharField(max_length=100)
    programme = models.ForeignKey(Programme, on_delete=models.CASCADE, related_name='venues')
    class Meta:
        unique_together = ('name', 'programme')

class PresentationSlot(models.Model):
    programme = models.ForeignKey(Programme, on_delete=models.CASCADE)
    date = models.DateField()
    venue_name = models.CharField(max_length=100)
    
    class Meta:
        unique_together = ('programme', 'date', 'venue_name')

class TimetableBooking(models.Model):
    lecturer = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={'profile__role': 'lecturer'})
    project = models.ForeignKey(FYPProject, on_delete=models.SET_NULL, null=True, blank=True)
    examiner = models.ForeignKey(User, related_name='examiner_bookings', on_delete=models.SET_NULL, null=True, blank=True, limit_choices_to={'profile__role': 'lecturer'})
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    venue = models.CharField(max_length=100, blank=True)
    class Meta:
        unique_together = ('start_time', 'venue')
        ordering = ['start_time']

class TimetableSlot(models.Model):
    project = models.ForeignKey(FYPProject, on_delete=models.CASCADE)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    examiners = models.ManyToManyField(User, limit_choices_to={'profile__role': 'lecturer'})
    venue = models.CharField(max_length=100, blank=True)

class Announcements(models.Model):
    coordinator = models.ForeignKey(User, on_delete=models.CASCADE, db_column='coordinator_user_id')
    programme = models.ForeignKey(Programme, on_delete=models.CASCADE, null=True, blank=True) 
    title = models.CharField(max_length=255)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'announcements'

class Feedback(models.Model):
    submission = models.ForeignKey('Submissions', on_delete=models.CASCADE, db_column='submission_id')
    lecturer = models.ForeignKey(User, on_delete=models.CASCADE, db_column='lecturer_user_id')
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    class Meta:
        db_table = 'feedback'

class Submissions(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='my_submissions', db_column='student_user_id')
    supervisor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='student_submissions', db_column='supervisor_user_id')
    co_supervisor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, db_column='co_supervisor_user_id')
    student_name = models.CharField(max_length=255)
    student_id_no = models.CharField(max_length=50)
    phone_no = models.CharField(max_length=50, blank=True, null=True)
    programme = models.CharField(max_length=100)
    semester = models.CharField(max_length=50)
    project_category = models.CharField(max_length=50)
    proposed_project_title = models.TextField()
    detail_description = models.TextField(blank=True, null=True)
    detail_problem = models.TextField(blank=True, null=True)
    detail_value = models.TextField(blank=True, null=True)
    detail_scope = models.TextField(blank=True, null=True)
    detail_similar_system = models.TextField(blank=True, null=True)
    detail_features = models.TextField(blank=True, null=True)
    document_path = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=50, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        db_table = 'submissions'

class MilestoneForms(models.Model):
    lecturer = models.ForeignKey(User, on_delete=models.CASCADE, db_column='lecturer_user_id')
    student_name = models.CharField(max_length=255)
    student_id_no = models.CharField(max_length=50, blank=True, null=True)
    fyp_title = models.TextField()
    supervisor_name = models.CharField(max_length=255)
    class Meta:
        db_table = 'milestone_forms'

class MilestoneEntries(models.Model):
    form = models.ForeignKey(MilestoneForms, on_delete=models.CASCADE, db_column='form_id', related_name='entries')
    milestone_number = models.IntegerField()
    milestone_name = models.CharField(max_length=255, default='')
    max_marks = models.IntegerField(default=0)
    score = models.IntegerField(blank=True, null=True)
    status = models.CharField(max_length=20, default='pending')
    class Meta:
        db_table = 'milestone_entries'
        ordering =['milestone_number']

class SupervisorQuotas(models.Model):
    lecturer = models.OneToOneField(User, on_delete=models.CASCADE, db_column='lecturer_user_id')
    quota_total = models.IntegerField()
    class Meta:
        db_table = 'supervisor_quotas'

class LecturerPreference(models.Model):
    lecturer = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        limit_choices_to=models.Q(profile__role='lecturer') | models.Q(profile__role='coordinator')
    )
    presentation_slot = models.ForeignKey(PresentationSlot, on_delete=models.CASCADE, null=True)
    unavailable_slots = models.JSONField(default=list, blank=True)

    class Meta:
        unique_together = ('lecturer', 'presentation_slot')
        ordering = ['presentation_slot__date', 'lecturer__profile__full_name']

# ---------------------------------------------------------------------------
# Rubric storage.
#
# These three models own the tables the PHP backend in `php/` reads and writes
# (see README_PHP_BACKEND.md). They are declared here — and created by
# `manage.py migrate` — so that the whole database structure comes from
# migrations and no SQL dump has to be imported by hand.
#
# Deliberate schema decisions, all driven by the PHP scripts being the primary
# writer:
#   * table names are the PHP names, not Django's default `api_*` names;
#   * `created_by` / `evaluated_by` / `updated_by` are plain strings, not FKs to
#     auth_user, because PHP stores free text ('admin', 'coordinator_admin', a
#     lecturer's display name);
#   * the JSON payload columns are TextField (LONGTEXT), not JSONField, so a
#     fresh `migrate` produces the same column type as the existing databases
#     and PHP keeps doing its own json_encode()/json_decode();
#   * the timestamp columns are converted to MySQL TIMESTAMP by migration 0012
#     so they keep their DEFAULT CURRENT_TIMESTAMP / ON UPDATE CURRENT_TIMESTAMP
#     behaviour for PHP, which relies on the database to fill them in.
#
# Programme scoping (migration 0018)
# ----------------------------------
# A marking rubric belongs to one programme. Each programme keeps its own set of
# templates and its own "active template per FYP stage", because the level
# descriptors, criteria weights and even the course code differ between
# programmes — BCS marks CSS3714 while BDM marks a different paper. One shared
# active template per stage would mean editing the rubric for one cohort silently
# changed what every other cohort was marked against.
#
# `programme` is nullable on purpose, and is the one place a null is meaningful:
# a template with no programme is a library/starter template that any programme
# may fall back to when it has not set its own active rubric yet. The active
# mapping (`RubricActiveTemplate`) is unique per (programme, stage), so exactly
# one template is live for a cohort at a time.
# ---------------------------------------------------------------------------

class RubricTemplate(models.Model):
    id = models.CharField(max_length=50, primary_key=True)
    name = models.CharField(max_length=255)
    template_data = models.TextField()
    created_by = models.CharField(max_length=100, default='admin')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    version = models.IntegerField(default=1)
    is_active = models.BooleanField(default=True)
    # Null means "starter template, available to every programme".
    programme = models.ForeignKey(
        Programme, on_delete=models.CASCADE, null=True, blank=True,
        related_name='rubric_templates',
    )

    class Meta:
        db_table = 'rubrics_templates'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['name'], name='idx_rubrics_templates_name'),
            models.Index(fields=['created_by'], name='idx_rubric_tpl_created_by'),
            models.Index(fields=['created_at'], name='idx_rubric_tpl_created_at'),
        ]

    def __str__(self):
        return self.name

class RubricMarks(models.Model):
    STATUS_CHOICES = (('draft', 'Draft'), ('submitted', 'Submitted'), ('finalized', 'Finalized'))
    # AutoField (INT) rather than the project-wide BigAutoField default: the
    # existing rubrics_marks table uses INT AUTO_INCREMENT and PHP returns this
    # id to the frontend. auto_created is set so this matches the field Django
    # would have generated implicitly, which keeps `makemigrations` quiet.
    id = models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')
    template = models.ForeignKey(RubricTemplate, on_delete=models.CASCADE, db_column='template_id')
    # The programme the marked student belongs to. Nullable only so that a
    # database predating migration 0018 can be upgraded without a guess; the
    # migration backfills every row it can and the write paths always set it.
    programme = models.ForeignKey(
        Programme, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='rubric_marks',
    )
    student_id = models.CharField(max_length=50, verbose_name="Student ID")
    student_name = models.CharField(max_length=255)
    supervisor = models.CharField(max_length=255, null=True, blank=True)
    examiner = models.CharField(max_length=255, null=True, blank=True)
    project_name = models.CharField(max_length=255, null=True, blank=True)
    course = models.CharField(max_length=255, null=True, blank=True)
    fyp_stage = models.CharField(max_length=20, null=True, blank=True, verbose_name="FYP Stage")
    marks_data = models.TextField()
    section_totals = models.TextField(null=True, blank=True)
    co_attainment = models.TextField(null=True, blank=True)
    criterion_marks = models.TextField(null=True, blank=True)
    total_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    evaluated_by = models.CharField(max_length=100)
    evaluated_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')

    class Meta:
        db_table = 'rubrics_marks'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['student_id'], name='idx_rubrics_marks_student_id'),
            models.Index(fields=['evaluated_by'], name='idx_rubrics_marks_evaluated_by'),
            models.Index(fields=['status'], name='idx_rubrics_marks_status'),
            models.Index(fields=['course'], name='idx_rubrics_marks_course'),
            models.Index(fields=['fyp_stage'], name='idx_rubrics_marks_fyp_stage'),
        ]

    def __str__(self):
        return f'{self.student_name} — {self.template_id}'

class RubricActiveTemplate(models.Model):
    """The rubric selected as active for one (programme, FYP stage) pair.

    Was keyed on `fyp_stage` alone, which made the active rubric a single global
    choice per stage and forced every programme to be marked against the same
    template. The surrogate `id` replaces that primary key so a unique constraint
    can cover both columns — PHP's `ON DUPLICATE KEY UPDATE` needs a unique key to
    fire on, and a composite primary key does not reliably trigger it in MySQL.
    """
    id = models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')
    programme = models.ForeignKey(
        Programme, on_delete=models.CASCADE, related_name='active_rubric_templates',
    )
    fyp_stage = models.CharField(max_length=30, verbose_name="FYP Stage")
    template = models.ForeignKey(RubricTemplate, on_delete=models.CASCADE, db_column='template_id')
    updated_by = models.CharField(max_length=100, default='coordinator')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'rubrics_active_templates'
        verbose_name = 'Active rubric template'
        verbose_name_plural = 'Active rubric templates'
        constraints = [
            models.UniqueConstraint(
                fields=['programme', 'fyp_stage'],
                name='uniq_active_rubric_per_programme_stage',
            ),
        ]

    def __str__(self):
        return f'{self.programme.code} {self.fyp_stage} -> {self.template_id}'