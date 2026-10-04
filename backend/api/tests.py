import io
import importlib

import pandas as pd
from django.apps import apps
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APIClient, APIRequestFactory

from .models import (
    Announcements,
    FYPProject,
    PresentationDay,
    Programme,
    Profile,
    RubricMarks,
    RubricTemplate,
    Submissions,
    SupervisorQuotas,
    Venue,
)
from .serializers import UserSerializer, UserWriteSerializer

# Migration modules cannot be imported with a normal `import` statement because
# their names begin with a digit. Migration 0017 is imported so the test below
# can call its data function directly.
migration_0017 = importlib.import_module('api.migrations.0017_bind_programmes_and_retire_legacy')
# Imported for the same reason: the administrator account is created by a
# migration, and the migration has to be re-runnable without resetting a password
# an operator has since changed.
migration_0023 = importlib.import_module('api.migrations.0023_admin_role_and_account')


def make_user(username, role, programme=None, student_id_no=''):
    """An account plus its Profile, the way the app always creates one."""
    user = User.objects.create_user(username=username, password='secret123')
    Profile.objects.create(
        user=user,
        full_name=username.title(),
        role=role,
        programme=programme,
        student_id_no=student_id_no,
    )
    return user


def make_programme(name, code):
    """Reuse the canonical programme row if migration 0017 already seeded it.

    BCS/BDM/BMD/BID are created by `0017_bind_programmes_and_retire_legacy`, so a
    test that called `Programme.objects.create(code='BCS')` on a database built
    from migrations collided with the seeded row. `get_or_create` keeps the
    fixtures working whether or not the seed is present, and returns the seeded
    row's id rather than a duplicate. The name is left as seeded ('BCS') on the
    reuse path, which no test asserts on.
    """
    programme, _ = Programme.objects.get_or_create(code=code, defaults={'name': name})
    return programme


class UserProgrammeAssignmentTests(TestCase):
    """Accounts carry a programme, and it is what the coordinator lists group by.

    The programme used to be inherited silently from whoever created the
    account, which left a promoted coordinator owning no programme and therefore
    seeing an empty student list. It is now an explicit choice on the form, and
    every programme is selectable.
    """

    def setUp(self):
        self.bsc = make_programme('Bachelor of Computer Science', 'BCS')
        self.bse = make_programme('Bachelor of Software Engineering', 'BSE')
        self.coordinator = make_user('coord', 'coordinator', self.bsc)
        self.factory = APIRequestFactory()
        self.api = APIClient()

    def serializer(self, data):
        request = self.factory.post('/api/users/', data)
        request.user = self.coordinator
        return UserWriteSerializer(data=data, context={'request': request})

    def test_account_is_created_in_the_chosen_programme(self):
        serializer = self.serializer({
            'username': 'newstudent',
            'full_name': 'New Student',
            'role': 'student',
            'programme': self.bsc.id,
            'password': 'secret123',
            'student_id_no': 'A123456',
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()

        self.assertEqual(user.profile.programme, self.bsc)
        # The project row is what the programme-wide student list filters on, so
        # it has to carry the same programme from the moment of creation.
        self.assertEqual(user.profile.role, 'student')
        self.assertEqual(FYPProject.objects.get(student=user).programme, self.bsc)

    def test_account_can_be_filed_under_any_programme(self):
        """Any programme is selectable, not only the coordinator's own.

        This was previously restricted to the coordinator's own programme, which
        left a coordinator holding only the legacy 'General' programme able to
        select that alone.
        """
        serializer = self.serializer({
            'username': 'anyprogramme',
            'full_name': 'Any Programme Lecturer',
            'role': 'lecturer',
            'programme': self.bse.id,
            'password': 'secret123',
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.save().profile.programme, self.bse)

    def test_programme_defaults_to_the_coordinators_own_when_omitted(self):
        serializer = self.serializer({
            'username': 'noprogrammesent',
            'full_name': 'No Programme Lecturer',
            'role': 'lecturer',
            'password': 'secret123',
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.save().profile.programme, self.bsc)

    def test_read_payload_exposes_the_programme_for_grouping(self):
        user = make_user('listed', 'lecturer', self.bsc)
        # The seeded BCS row is named 'BCS' by migration 0017, which reuses an
        # existing row's name rather than renaming it. Give this fixture a
        # distinct display name so the assertion is about the serializer picking
        # up `programme.name`, not about what the seed happens to call it.
        self.bsc.name = 'Bachelor of Computer Science'
        self.bsc.save()
        user.refresh_from_db()

        data = UserSerializer(user).data

        self.assertEqual(data['programme_id'], self.bsc.id)
        self.assertEqual(data['programme_name'], 'Bachelor of Computer Science')
        self.assertEqual(data['programme_code'], 'BCS')

    def test_a_coordinator_cannot_reach_another_programmes_account(self):
        """The coordinator lists are bounded to the coordinator's own programme.

        Both directions are asserted: the account is absent from the list, and a
        direct PATCH addressed to it 404s rather than editing it. The second
        matters more than the first — a scoped list with an unscoped detail route
        is not a bound at all.
        """
        student = make_user('mover', 'student', self.bsc, student_id_no='A999999')
        FYPProject.objects.create(
            student=student,
            title='Pending TRF Submission',
            student_matric_id='A999999',
            fyp_stage='FYP1',
            programme=self.bsc,
        )

        other = make_user('coord2', 'coordinator', self.bse)
        self.api.force_authenticate(user=other)

        listing = self.api.get('/users/')
        self.assertEqual(listing.status_code, 200)
        listed_ids = [row['id'] for row in listing.json()]
        self.assertNotIn(student.id, listed_ids)
        # The caller's own account is still visible, so the bound is a bound and
        # not an empty list.
        self.assertIn(other.id, listed_ids)

        response = self.api.patch(f'/users/{student.id}/', {'phone_no': '0123456789'}, format='json')
        self.assertEqual(response.status_code, 404)
        student.profile.refresh_from_db()
        self.assertIsNone(student.profile.phone_no)

    def test_programme_options_offer_every_real_programme(self):
        """The selectable list offers exactly the programmes that exist.

        `ProgrammeViewSet` used to filter the legacy 'General' and 'None' rows out
        of the list. Migration 0017 deletes those rows, so the view is now a plain
        listing and this asserts the two stay in step: every programme in the
        database is offered, and nothing is invented.
        """
        make_user('coord4', 'coordinator', self.bse)
        self.api.force_authenticate(user=self.coordinator)

        response = self.api.get('/programmes/')
        self.assertEqual(response.status_code, 200)
        codes = sorted(row['code'] for row in response.json())

        # The four the institution offers (seeded by migration 0017) plus the one
        # this test adds. Nothing invented, nothing hidden.
        self.assertEqual(codes, ['BCS', 'BDM', 'BID', 'BMD', 'BSE'])

    def test_project_row_follows_the_profile_when_the_programme_changes(self):
        """A programme change keeps the project row in step.

        Reachable only from outside the request cycle today (the queryset scoping
        above prevents it through the API), so the sync is exercised directly
        rather than left untested.
        """
        student = make_user('synced', 'student', self.bsc, student_id_no='A888888')
        project = FYPProject.objects.create(
            student=student,
            title='Pending TRF Submission',
            student_matric_id='A888888',
            fyp_stage='FYP1',
            programme=self.bsc,
        )

        other = make_user('coord3', 'coordinator', self.bse)
        request = self.factory.patch(f'/api/users/{student.id}/', {})
        request.user = other
        serializer = UserWriteSerializer(student, context={'request': request})
        serializer.update(student, {'profile': {'programme': self.bse}})

        student.profile.refresh_from_db()
        project.refresh_from_db()
        self.assertEqual(student.profile.programme, self.bse)
        self.assertEqual(project.programme, self.bse)


class FullNameRequiredTests(TestCase):
    """An account cannot be created or edited into having no full name.

    The name is how a person is identified on every screen that lists them, and
    each of those screens falls back to the username when it is blank — so an
    account saved without one was shown under a different name in the student
    list, the marks table and the schedules. The rule is enforced on the API and
    not only on the form, because the form is not the only caller, and it is
    deliberately blind to partial edits: an unrelated change must not turn into a
    demand for a name.
    """

    def setUp(self):
        self.bsc = make_programme('Bachelor of Computer Science', 'BCS')
        self.coordinator = make_user('namecoord', 'coordinator', self.bsc)
        self.api = APIClient()
        self.api.force_authenticate(user=self.coordinator)

    def create(self, **overrides):
        payload = {
            'username': 'nameless',
            'full_name': 'Nameless Student',
            'role': 'student',
            'programme': self.bsc.id,
            'password': 'secret123',
        }
        payload.update(overrides)
        return self.api.post('/users/', payload, format='json')

    def test_an_account_cannot_be_created_with_a_blank_name(self):
        response = self.create(full_name='')

        self.assertEqual(response.status_code, 400, getattr(response, 'data', None))
        self.assertIn('full_name', response.data)
        self.assertFalse(User.objects.filter(username='nameless').exists())

    def test_a_name_of_only_spaces_is_refused(self):
        """`allow_blank` lets '   ' through, and it strips down to no name."""
        response = self.create(full_name='   ')

        self.assertEqual(response.status_code, 400, getattr(response, 'data', None))
        self.assertIn('full_name', response.data)
        self.assertFalse(User.objects.filter(username='nameless').exists())

    def test_a_request_that_omits_the_name_entirely_is_refused(self):
        response = self.api.post('/users/', {
            'username': 'nonamefield',
            'role': 'student',
            'programme': self.bsc.id,
            'password': 'secret123',
        }, format='json')

        self.assertEqual(response.status_code, 400, getattr(response, 'data', None))
        self.assertIn('full_name', response.data)
        self.assertFalse(User.objects.filter(username='nonamefield').exists())

    def test_an_edit_cannot_blank_an_existing_name(self):
        student = make_user('named', 'student', self.bsc, student_id_no='A1')

        response = self.api.patch(
            f'/users/{student.id}/', {'full_name': '  '}, format='json'
        )

        self.assertEqual(response.status_code, 400, getattr(response, 'data', None))
        student.profile.refresh_from_db()
        self.assertEqual(student.profile.full_name, 'Named')

    def test_an_edit_that_does_not_touch_the_name_still_saves(self):
        """A partial edit must not be answered with a demand for a name."""
        student = make_user('untouched', 'student', self.bsc)

        response = self.api.patch(
            f'/users/{student.id}/', {'phone_no': '0123456789'}, format='json'
        )

        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))
        student.profile.refresh_from_db()
        self.assertEqual(student.profile.phone_no, '0123456789')
        self.assertEqual(student.profile.full_name, 'Untouched')

    def test_the_model_refuses_a_blank_name_outside_the_api(self):
        """`blank=False` is the half of the rule Django's own forms obey."""
        profile = Profile(
            user=User.objects.create_user('formcheck', password='secret123'),
            full_name='',
            role='student',
            programme=self.bsc,
        )

        with self.assertRaises(ValidationError):
            profile.full_clean()


class SpreadsheetUploadProgrammeTests(TestCase):
    """The upload must never invent a programme or file accounts under a fallback.

    It used to read ``row.get('programme_code', 'General')`` and then
    ``Programme.objects.get_or_create`` on whatever came back, which is how the
    database ended up with a catch-all 'General' programme holding most of the
    accounts, plus a junk row literally named 'None'.
    """

    def setUp(self):
        self.bsc = make_programme('BCS', 'BCS')
        # Migration 0017 seeds BCS/BDM/BMD/BID. These assertions count programmes
        # to prove a rejected row leaves nothing behind, so the baseline is
        # narrowed to the one programme the upload is actually aimed at.
        Programme.objects.exclude(pk=self.bsc.pk).delete()
        self.coordinator = make_user('uploader', 'coordinator', self.bsc)
        self.api = APIClient()
        self.api.force_authenticate(user=self.coordinator)

    def upload(self, rows):
        frame = pd.DataFrame(rows)
        buffer = io.BytesIO()
        frame.to_excel(buffer, index=False)
        buffer.seek(0)
        buffer.name = 'accounts.xlsx'
        return self.api.post('/upload-excel/', {'file': buffer}, format='multipart')

    def test_known_programme_code_is_accepted(self):
        response = self.upload([
            {'username': 'up1', 'full_name': 'Up One', 'programme_code': 'BCS',
             'role': 'student', 'student_matric_id': 'A100001'},
        ])

        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))
        self.assertEqual(Profile.objects.get(user__username='up1').programme, self.bsc)

    def test_unknown_programme_code_is_rejected_and_creates_nothing(self):
        response = self.upload([
            {'username': 'up2', 'full_name': 'Up Two', 'programme_code': 'ZZZ', 'role': 'student'},
        ])

        self.assertEqual(response.status_code, 207)
        self.assertTrue(response.data['errors'])
        # Neither a programme nor a half-created account may be left behind.
        self.assertFalse(Programme.objects.filter(code='ZZZ').exists())
        self.assertFalse(User.objects.filter(username='up2').exists())
        self.assertEqual(Programme.objects.count(), 1)

    def test_the_literal_string_none_is_not_turned_into_a_programme(self):
        response = self.upload([
            {'username': 'up3', 'full_name': 'Up Three', 'programme_code': 'None', 'role': 'student'},
        ])

        self.assertEqual(response.status_code, 207)
        self.assertFalse(Programme.objects.filter(code__iexact='None').exists())
        self.assertFalse(User.objects.filter(username='up3').exists())

    def test_missing_programme_column_is_reported_per_row(self):
        response = self.upload([
            {'username': 'up4', 'full_name': 'Up Four', 'role': 'student'},
        ])

        self.assertEqual(response.status_code, 207)
        self.assertFalse(User.objects.filter(username='up4').exists())
        self.assertEqual(Programme.objects.count(), 1)

    def test_code_is_matched_case_insensitively_and_trimmed(self):
        response = self.upload([
            {'username': 'up5', 'full_name': 'Up Five', 'programme_code': ' bcs ',
             'role': 'student', 'student_matric_id': 'A100005'},
        ])

        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))
        self.assertEqual(Profile.objects.get(user__username='up5').programme, self.bsc)
        self.assertEqual(Programme.objects.count(), 1)


class CoordinatorDashboardScopeTests(TestCase):
    """The coordinator dashboard describes one cohort, not the institution.

    Both endpoints were briefly global so that a coordinator filed under the
    legacy 'General' placeholder still saw something. That made the dashboard's
    own percentages meaningless — it divides "submitted" by "total students", and
    those came from different populations. Migration 0017 removed the placeholder
    that forced the widening, and a coordinator genuinely holding no programme now
    gets a 403 that names the reason instead of a whole-database answer.
    """

    def setUp(self):
        self.bsc = make_programme('BCS', 'BCS')
        self.bse = make_programme('BSE', 'BSE')

        self.bsc_student = make_user('bscstudent', 'student', self.bsc, student_id_no='A1')
        self.bse_student = make_user('bsestudent', 'student', self.bse, student_id_no='A2')
        for student in (self.bsc_student, self.bse_student):
            FYPProject.objects.create(
                student=student,
                title=f'{student.username} project',
                student_matric_id=student.profile.student_id_no,
                fyp_stage='FYP1',
                programme=student.profile.programme,
            )
        Submissions.objects.create(
            student=self.bsc_student, student_name='BSC Student',
            student_id_no='A1', programme='BCS', semester='1',
            project_category='Research', proposed_project_title='One',
        )
        Submissions.objects.create(
            student=self.bse_student, student_name='BSE Student',
            student_id_no='A2', programme='BSE', semester='1',
            project_category='Research', proposed_project_title='Two',
        )

        # A coordinator with a programme of their own, which is the normal case.
        self.coordinator = make_user('bsecoord', 'coordinator', self.bse)
        # And the edge case: a coordinator who has not been assigned one.
        self.coordinator_without_programme = make_user('noprogrammecoord', 'coordinator', None)
        self.api = APIClient()
        self.api.force_authenticate(user=self.coordinator)

    def test_summary_counts_only_the_coordinators_own_programme(self):
        """One cohort, both populations.

        The two counts must come from the same population, because the dashboard
        divides them ("N% of students have sent a TRF"). Counting every programme's
        students against every programme's submissions produces a percentage that
        describes no real cohort.
        """
        response = self.api.get('/overview/summary/')

        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))
        summary = response.data['summary']
        self.assertEqual(summary['programme_code'], 'BSE')
        self.assertEqual(summary['total_students'], 1)
        self.assertEqual(summary['projects_submitted'], 1)
        self.assertEqual(summary['pending_reviews'], 1)

    def test_summary_is_refused_for_a_coordinator_without_a_programme(self):
        """No programme means no cohort to describe — a 403, not the whole database."""
        self.api.force_authenticate(user=self.coordinator_without_programme)

        response = self.api.get('/overview/summary/')
        self.assertEqual(response.status_code, 403)

    def test_summary_is_refused_for_a_non_coordinator(self):
        student = make_user('plainstudent', 'student', self.bsc)
        self.api.force_authenticate(user=student)

        response = self.api.get('/overview/summary/')
        self.assertEqual(response.status_code, 403)

    def test_export_covers_only_the_coordinators_programme_and_names_the_file(self):
        response = self.api.get('/export-students-excel/')

        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))
        self.assertIn('FYP_Student_List_BSE.xlsx', response['Content-Disposition'])

        sheet = pd.read_excel(io.BytesIO(response.content))
        # One row: the BSE student. The BCS student belongs to another cohort.
        self.assertEqual(len(sheet), 1)
        self.assertIn('Programme', sheet.columns)
        self.assertEqual(sorted(sheet['Programme']), ['BSE'])

    def test_export_refuses_a_coordinator_without_a_programme(self):
        self.api.force_authenticate(user=self.coordinator_without_programme)

        response = self.api.get('/export-students-excel/')
        self.assertEqual(response.status_code, 403)

    def test_export_still_honours_the_stage_filter(self):
        response = self.api.get('/export-students-excel/', {'fyp_stage': 'FYP2'})

        self.assertEqual(response.status_code, 200)
        sheet = pd.read_excel(io.BytesIO(response.content))
        self.assertEqual(len(sheet), 0)


class SupervisionQuotaScopeTests(TestCase):
    """The four supervision-quota endpoints had no role check at all.

    Any signed-in account — including a student — could read every lecturer's
    allocation and write a new quota. They are staff tools, bounded to the
    caller's programme, and only a coordinator may write.
    """

    def setUp(self):
        self.bsc = make_programme('BCS', 'BCS')
        self.bse = make_programme('BSE', 'BSE')
        self.bsc_lecturer = make_user('bsclec', 'lecturer', self.bsc)
        self.bse_lecturer = make_user('bselec', 'lecturer', self.bse)
        self.bsc_coordinator = make_user('bsccoord', 'coordinator', self.bsc)
        self.student = make_user('quostudent', 'student', self.bsc, student_id_no='Q1')
        self.api = APIClient()

    def test_a_student_cannot_read_supervision_quotas(self):
        self.api.force_authenticate(user=self.student)

        response = self.api.get('/supervisors/quotas/')
        self.assertEqual(response.status_code, 403)

    def test_a_student_cannot_write_a_supervision_quota(self):
        self.api.force_authenticate(user=self.student)

        response = self.api.put(
            f'/supervisors/quotas/{self.bsc_lecturer.id}/', {'quota_total': 99}, format='json'
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(SupervisorQuotas.objects.filter(lecturer=self.bsc_lecturer).exists())

    def test_a_coordinator_sees_only_their_own_programmes_lecturers(self):
        self.api.force_authenticate(user=self.bsc_coordinator)

        response = self.api.get('/supervisors/quotas/')
        self.assertEqual(response.status_code, 200)
        names = [row['id'] for row in response.data['quotas']]
        self.assertIn(self.bsc_lecturer.id, names)
        self.assertNotIn(self.bse_lecturer.id, names)

    def test_a_coordinator_cannot_set_another_programmes_quota(self):
        self.api.force_authenticate(user=self.bsc_coordinator)

        response = self.api.put(
            f'/supervisors/quotas/{self.bse_lecturer.id}/', {'quota_total': 5}, format='json'
        )
        self.assertEqual(response.status_code, 404)
        self.assertFalse(SupervisorQuotas.objects.filter(lecturer=self.bse_lecturer).exists())

    def test_a_lecturer_cannot_write_even_their_own_quota(self):
        """Reading is open to staff; writing stays the coordinator's call."""
        self.api.force_authenticate(user=self.bsc_lecturer)

        response = self.api.put(
            f'/supervisors/quotas/{self.bsc_lecturer.id}/', {'quota_total': 50}, format='json'
        )
        self.assertEqual(response.status_code, 403)

    def test_a_coordinator_can_set_their_own_programmes_quota(self):
        self.api.force_authenticate(user=self.bsc_coordinator)

        response = self.api.put(
            f'/supervisors/quotas/{self.bsc_lecturer.id}/', {'quota_total': 7}, format='json'
        )
        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))
        quota = SupervisorQuotas.objects.get(lecturer=self.bsc_lecturer)
        self.assertEqual(quota.quota_total, 7)

    def test_a_negative_quota_is_rejected(self):
        self.api.force_authenticate(user=self.bsc_coordinator)

        response = self.api.put(
            f'/supervisors/quotas/{self.bsc_lecturer.id}/', {'quota_total': -1}, format='json'
        )
        self.assertEqual(response.status_code, 400)


class StudentRecordAccessTests(TestCase):
    """A student's record is readable by that student or their own teaching staff.

    The view used to accept any id from any signed-in account, so a classmate's
    status and unread-feedback count were one URL edit away.
    """

    def setUp(self):
        self.bsc = make_programme('BCS', 'BCS')
        self.bse = make_programme('BSE', 'BSE')
        self.mine = make_user('mine', 'student', self.bsc, student_id_no='M1')
        self.classmate = make_user('classmate', 'student', self.bsc, student_id_no='M2')
        self.other_cohort = make_user('othercohort', 'student', self.bse, student_id_no='M3')
        self.supervisor = make_user('super', 'lecturer', self.bsc)
        self.stranger_lecturer = make_user('stranger', 'lecturer', self.bsc)
        self.coordinator = make_user('bccord', 'coordinator', self.bsc)
        self.other_coordinator = make_user('becoord', 'coordinator', self.bse)

        FYPProject.objects.create(
            student=self.mine, title='Mine', student_matric_id='M1',
            fyp_stage='FYP1', supervisor=self.supervisor,
        )
        self.api = APIClient()

    def url(self, user):
        return f'/student-dashboard/{user.id}/'

    def test_a_student_can_read_their_own_record(self):
        self.api.force_authenticate(user=self.mine)
        self.assertEqual(self.api.get(self.url(self.mine)).status_code, 200)

    def test_a_student_cannot_read_a_classmate(self):
        self.api.force_authenticate(user=self.mine)
        self.assertEqual(self.api.get(self.url(self.classmate)).status_code, 403)

    def test_a_students_own_supervisor_can_read_it(self):
        self.api.force_authenticate(user=self.supervisor)
        self.assertEqual(self.api.get(self.url(self.mine)).status_code, 200)

    def test_a_lecturer_who_does_not_supervise_them_cannot(self):
        self.api.force_authenticate(user=self.stranger_lecturer)
        self.assertEqual(self.api.get(self.url(self.mine)).status_code, 403)

    def test_the_coordinator_of_their_programme_can_read_it(self):
        self.api.force_authenticate(user=self.coordinator)
        self.assertEqual(self.api.get(self.url(self.mine)).status_code, 200)

    def test_another_programmes_coordinator_cannot(self):
        """A BSE coordinator must not reach a BCS student.

        The BSE coordinator is aimed at the BCS student on purpose: the earlier
        version of this test pointed them at their *own* cohort, so it passed
        whatever the bound did.
        """
        self.api.force_authenticate(user=self.other_coordinator)
        self.assertEqual(self.api.get(self.url(self.mine)).status_code, 403)


class AnnouncementPermissionTests(TestCase):
    """Announcements are published by a coordinator, not by whoever asks."""

    def setUp(self):
        self.bsc = make_programme('BCS', 'BCS')
        self.coordinator = make_user('anncoord', 'coordinator', self.bsc)
        self.student = make_user('annstudent', 'student', self.bsc, student_id_no='AN1')
        self.api = APIClient()

    def test_a_student_cannot_publish_an_announcement(self):
        self.api.force_authenticate(user=self.student)

        response = self.api.post('/announcements/', {'title': 'Fake', 'content': 'x'}, format='json')
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Announcements.objects.exists())

    def test_a_student_cannot_delete_an_announcement(self):
        announcement = Announcements.objects.create(
            coordinator=self.coordinator, programme=self.bsc, title='Real', content='y'
        )
        self.api.force_authenticate(user=self.student)

        response = self.api.delete(f'/announcements/{announcement.id}/')
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Announcements.objects.filter(id=announcement.id).exists())

    def test_a_coordinator_can_publish_to_their_own_programme(self):
        self.api.force_authenticate(user=self.coordinator)

        response = self.api.post('/announcements/', {'title': 'Real', 'content': 'y'}, format='json')
        self.assertEqual(response.status_code, 201, getattr(response, 'data', None))
        announcement = Announcements.objects.get()
        self.assertEqual(announcement.programme, self.bsc)
        self.assertEqual(announcement.coordinator, self.coordinator)


class LegacyProgrammeRetirementTests(TestCase):
    """Migration 0017 binds every account to a real programme and retires the
    'General' / 'None' placeholders.

    The migration's own function is called directly rather than relying on a test
    database built from migration history. That keeps the assertions about what
    the migration *does* — including that it does not run when there is no BCS
    row to move onto — independent of how the test database happens to be
    created, which is the detail that made the first version of this test
    misleading.
    """

    def setUp(self):
        # The real cohort the placeholders are folded into.
        self.bcs = make_programme('BCS', 'BCS')
        self.general = make_programme('General', 'General')
        self.none = make_programme('None', 'None')

    def run_migration(self):
        migration_0017.bind_everything_to_a_real_programme(apps, None)

    def test_accounts_on_a_placeholder_move_to_bcs(self):
        student = make_user('legacystudent', 'student', self.general, student_id_no='G1')
        lecturer = make_user('legacylecturer', 'lecturer', self.general)
        none_student = make_user('nonestudent', 'student', self.none, student_id_no='N1')

        self.run_migration()

        for account in (student, lecturer, none_student):
            account.profile.refresh_from_db()
            self.assertEqual(account.profile.programme, self.bcs)

    def test_announcements_and_projects_move_with_the_account(self):
        student = make_user('legacyproj', 'student', self.general, student_id_no='G2')
        project = FYPProject.objects.create(
            student=student, title='Project', student_matric_id='G2', fyp_stage='FYP1',
        )
        # Force the stale state: the project rule would normally have corrected it.
        FYPProject.objects.filter(pk=project.pk).update(programme=self.general)

        self.run_migration()

        project.refresh_from_db()
        self.assertEqual(project.programme, self.bcs)

    def test_submission_programme_is_re_derived_from_the_student(self):
        student = make_user('legacysub', 'student', self.general, student_id_no='G3')
        submission = Submissions.objects.create(
            student=student, student_name='Legacy Sub', student_id_no='G3',
            programme='Bachelor of Computer Science', semester='1',
            project_category='Research', proposed_project_title='One',
        )

        self.run_migration()

        submission.refresh_from_db()
        # The stored human string is replaced by the programme's own name, which
        # is what the serialiser writes from now on.
        self.assertEqual(submission.programme, self.bcs.name)

    def test_placeholder_rows_are_removed(self):
        make_user('legacydel', 'student', self.general, student_id_no='G4')

        self.run_migration()

        self.assertFalse(Programme.objects.filter(code__in=['General', 'None']).exists())
        self.assertTrue(Programme.objects.filter(code='BCS').exists())

    def test_it_seeds_the_canonical_programmes(self):
        """The four real programmes are created if the database has none.

        Without this a fresh `manage.py migrate` produced a database with no
        programmes at all, which made the rest of this migration a silent no-op
        and left account creation with nothing to select.
        """
        # The migration under test is what normally creates these, so the test
        # database already has them. Clear the slate to exercise the seeding path.
        Programme.objects.all().delete()

        self.run_migration()

        codes = sorted(Programme.objects.values_list('code', flat=True))
        self.assertEqual(codes, ['BCS', 'BDM', 'BID', 'BMD'])

    def test_an_existing_programme_keeps_its_own_name(self):
        """Seeding must not rename a row an institution has already customised."""
        self.bcs.name = 'Bachelor of Computer Science'
        self.bcs.save()

        self.run_migration()

        self.bcs.refresh_from_db()
        self.assertEqual(self.bcs.name, 'Bachelor of Computer Science')


class CoordinatorSelfDeleteTests(TestCase):
    """A coordinator can delete their own account, and only with their password.

    The user-list delete refuses self-deletion outright, which is right there —
    one slip of the mouse would remove an account. Deleting your own is a
    deliberate act, so it has its own endpoint, and the password is re-checked
    because a signed-in browser session is not proof that the person at the
    keyboard meant it.
    """

    URL = '/users/delete-own-account/'

    def setUp(self):
        self.bsc = make_programme('BCS', 'BCS')
        self.coordinator = make_user('selfdel', 'coordinator', self.bsc)
        self.coordinator.set_password('correct-horse')
        self.coordinator.save()
        self.api = APIClient()
        self.api.force_authenticate(user=self.coordinator)

    def test_the_correct_password_deletes_the_account(self):
        response = self.api.post(self.URL, {'password': 'correct-horse'}, format='json')

        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))
        self.assertFalse(User.objects.filter(username='selfdel').exists())

    def test_the_wrong_password_deletes_nothing(self):
        response = self.api.post(self.URL, {'password': 'not-it'}, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertTrue(User.objects.filter(username='selfdel').exists())

    def test_an_empty_password_is_refused(self):
        response = self.api.post(self.URL, {}, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertTrue(User.objects.filter(username='selfdel').exists())

    def test_a_student_cannot_delete_their_own_account(self):
        student = make_user('selfdelstudent', 'student', self.bsc, student_id_no='SD1')
        student.set_password('studentpass')
        student.save()
        self.api.force_authenticate(user=student)

        response = self.api.post(self.URL, {'password': 'studentpass'}, format='json')

        self.assertEqual(response.status_code, 403)
        self.assertTrue(User.objects.filter(username='selfdelstudent').exists())

    def test_a_lecturer_cannot_delete_their_own_account(self):
        lecturer = make_user('selfdellecturer', 'lecturer', self.bsc)
        lecturer.set_password('lecturerpass')
        lecturer.save()
        self.api.force_authenticate(user=lecturer)

        response = self.api.post(self.URL, {'password': 'lecturerpass'}, format='json')

        self.assertEqual(response.status_code, 403)
        self.assertTrue(User.objects.filter(username='selfdellecturer').exists())

    def test_another_coordinator_is_still_protected_from_the_user_list(self):
        """The self-delete endpoint must not have opened a general self-delete."""
        other = make_user('othercoord', 'coordinator', self.bsc)
        self.api.force_authenticate(user=other)

        response = self.api.delete(f'/users/{self.coordinator.id}/')
        self.assertEqual(response.status_code, 400)
        self.assertTrue(User.objects.filter(username='selfdel').exists())

    def test_the_response_reports_what_the_deletion_leaves_behind(self):
        """The account holder is told what they are orphaning, not just 'done'."""
        student = make_user('orphaned', 'student', self.bsc, student_id_no='SD2')
        FYPProject.objects.create(
            student=student, title='P', student_matric_id='SD2',
            fyp_stage='FYP1', supervisor=self.coordinator,
        )

        response = self.api.post(self.URL, {'password': 'correct-horse'}, format='json')

        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))
        self.assertEqual(response.data['programme_code'], 'BCS')
        self.assertEqual(response.data['projects_now_without_a_supervisor'], 1)
        self.assertEqual(response.data['other_coordinators_left_in_the_programme'], 0)


class AdministratorAccountTests(TestCase):
    """The handover account: what it can see, and what it must not be able to do.

    The `admin` role exists so the person taking the project over can look after
    accounts across every programme, and nothing else. Two properties matter and
    are both asserted here:

    * it is the only role whose user list spans programmes — a coordinator's stays
      bounded to their own cohort, which is the thing that must not regress;
    * it is not a coordinator with a wider view. Granting the role is
      administrator-only, so a coordinator cannot mint one (through the API or
      through a spreadsheet) and promote themselves past the programme bound.
    """

    def setUp(self):
        self.bsc = make_programme('BCS', 'BCS')
        self.bse = make_programme('BSE', 'BSE')
        self.bsc_student = make_user('adm_bsc_student', 'student', self.bsc, student_id_no='AD1')
        self.bse_lecturer = make_user('adm_bse_lecturer', 'lecturer', self.bse)
        self.bsc_coordinator = make_user('adm_bsc_coord', 'coordinator', self.bsc)
        # An account with no Profile row at all, the way `createsuperuser` leaves
        # one. Only the administrator's list includes these.
        self.profileless = User.objects.create_user(username='adm_profileless', password='secret123')

        self.admin = make_user('adm_handover', 'admin', None)
        self.api = APIClient()

    def listed_usernames(self, user):
        self.api.force_authenticate(user=user)
        response = self.api.get('/users/')
        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))
        return [row['username'] for row in response.json()]

    def test_the_administrator_sees_every_role_and_every_programme(self):
        names = self.listed_usernames(self.admin)

        for account in (self.bsc_student, self.bse_lecturer, self.bsc_coordinator):
            self.assertIn(account.username, names)
        # Including accounts that hold no Profile row at all.
        self.assertIn(self.profileless.username, names)
        # And the administrator's own account, so the list is a list and not a
        # view of everybody else.
        self.assertIn(self.admin.username, names)

    def test_a_coordinator_list_stays_bounded_to_their_own_programme(self):
        """The bound the administrator was given an exemption from still holds."""
        names = self.listed_usernames(self.bsc_coordinator)

        self.assertIn(self.bsc_student.username, names)
        self.assertNotIn(self.bse_lecturer.username, names)

    def test_the_administrator_can_edit_an_account_in_any_programme(self):
        self.api.force_authenticate(user=self.admin)

        response = self.api.patch(
            f'/users/{self.bse_lecturer.id}/', {'phone_no': '0199999999'}, format='json'
        )

        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))
        self.bse_lecturer.profile.refresh_from_db()
        self.assertEqual(self.bse_lecturer.profile.phone_no, '0199999999')

    def test_the_administrator_can_create_an_account_with_no_programme(self):
        """An administrator is not filed under a cohort, so `programme` is nullable.

        The frontend sends `null` for an administrator account rather than
        borrowing the first programme in the list.
        """
        self.api.force_authenticate(user=self.admin)

        response = self.api.post('/users/', {
            'username': 'adm_second',
            'full_name': 'Second Administrator',
            'role': 'admin',
            'programme': None,
            'password': 'secret123',
        }, format='json')

        self.assertEqual(response.status_code, 201, getattr(response, 'data', None))
        created = User.objects.get(username='adm_second')
        self.assertEqual(created.profile.role, 'admin')
        self.assertIsNone(created.profile.programme_id)

    def test_the_administrator_can_delete_an_ordinary_account(self):
        self.api.force_authenticate(user=self.admin)

        response = self.api.delete(f'/users/{self.bsc_student.id}/')

        self.assertEqual(response.status_code, 204, getattr(response, 'data', None))
        self.assertFalse(User.objects.filter(username=self.bsc_student.username).exists())

    def test_an_administrator_cannot_be_deleted_from_the_user_list(self):
        self.api.force_authenticate(user=self.admin)
        other_admin = make_user('adm_other_handover', 'admin', None)

        response = self.api.delete(f'/users/{other_admin.id}/')

        self.assertEqual(response.status_code, 400)
        self.assertTrue(User.objects.filter(username='adm_other_handover').exists())

    def test_the_administrator_cannot_delete_its_own_account(self):
        self.api.force_authenticate(user=self.admin)

        response = self.api.delete(f'/users/{self.admin.id}/')

        self.assertEqual(response.status_code, 400)
        self.assertTrue(User.objects.filter(username='adm_handover').exists())

    def test_a_coordinator_cannot_grant_administrator_access(self):
        """No self-promotion past the programme bound."""
        self.api.force_authenticate(user=self.bsc_coordinator)

        response = self.api.patch(
            f'/users/{self.bsc_student.id}/', {'role': 'admin'}, format='json'
        )

        self.assertEqual(response.status_code, 400, getattr(response, 'data', None))
        self.bsc_student.profile.refresh_from_db()
        self.assertEqual(self.bsc_student.profile.role, 'student')

    def test_a_student_cannot_reach_the_user_list(self):
        self.assertEqual(self.listed_usernames(self.bsc_student), [])


class AdministratorSeedTests(TestCase):
    """Migration 0023 seeds the handover account, and keeps its hands off it after.

    The account is created by the migration so a database built from
    `manage.py setup_fyphub` has the same way in as the shipped dump. Re-running
    it must be harmless: `migrate` can be replayed, and a password changed with
    `manage.py changepassword` must survive that.
    """

    def test_the_seeded_account_signs_in_and_holds_the_administrator_role(self):
        user = User.objects.get(username=migration_0023.ADMIN_USERNAME)

        self.assertTrue(user.check_password(migration_0023.ADMIN_PASSWORD))
        self.assertTrue(user.is_active)
        self.assertEqual(user.profile.role, 'admin')
        # No programme: the role is not scoped to a cohort, and giving it one
        # would suggest it is.
        self.assertIsNone(user.profile.programme_id)
        # Deliberately not a Django superuser — the app's own role is what grants
        # the User Management screen, and the Django admin site stays shut.
        self.assertFalse(user.is_superuser)
        self.assertFalse(user.is_staff)

    def test_re_running_the_seed_does_not_reset_a_changed_password(self):
        user = User.objects.get(username=migration_0023.ADMIN_USERNAME)
        user.set_password('changed-by-hand')
        user.save()

        migration_0023.create_admin_account(apps, None)

        user.refresh_from_db()
        self.assertTrue(user.check_password('changed-by-hand'))
        self.assertEqual(User.objects.filter(username=migration_0023.ADMIN_USERNAME).count(), 1)

    def test_re_running_the_seed_restores_a_missing_role(self):
        """If the account was left with another role, the seed corrects the role.

        Not the password — see the test above — but the account has to end up able
        to do the job it was seeded for.
        """
        user = User.objects.get(username=migration_0023.ADMIN_USERNAME)
        user.profile.role = 'lecturer'
        user.profile.save()

        migration_0023.create_admin_account(apps, None)

        user.profile.refresh_from_db()
        self.assertEqual(user.profile.role, 'admin')


class SpreadsheetUploadRoleTests(TestCase):
    """The spreadsheet must not be a way to hand out administrator access.

    The upload reads the role as free text out of a column, so without a guard a
    coordinator could type 'admin' into a row and create an account that outranks
    them. Refused before anything is written, like a bad programme code: a
    rejected row must not leave a signed-in account with no Profile behind.
    """

    def setUp(self):
        self.bsc = make_programme('BCS', 'BCS')
        self.coordinator = make_user('role_upload_coord', 'coordinator', self.bsc)
        self.admin = make_user('role_upload_admin', 'admin', None)
        self.api = APIClient()

    def upload(self, user, rows):
        frame = pd.DataFrame(rows)
        buffer = io.BytesIO()
        frame.to_excel(buffer, index=False)
        buffer.seek(0)
        buffer.name = 'accounts.xlsx'
        self.api.force_authenticate(user=user)
        return self.api.post('/upload-excel/', {'file': buffer}, format='multipart')

    def test_a_coordinator_cannot_create_an_administrator_from_a_spreadsheet(self):
        response = self.upload(self.coordinator, [
            {'username': 'sneakyadmin', 'full_name': 'Sneaky Admin',
             'programme_code': 'BCS', 'role': 'admin'},
        ])

        self.assertEqual(response.status_code, 207)
        self.assertTrue(response.data['errors'])
        self.assertFalse(User.objects.filter(username='sneakyadmin').exists())

    def test_a_coordinator_can_still_upload_the_course_roles(self):
        response = self.upload(self.coordinator, [
            {'username': 'plainupload', 'full_name': 'Plain Upload',
             'programme_code': 'BCS', 'role': 'student', 'student_matric_id': 'SU1'},
        ])

        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))
        self.assertEqual(Profile.objects.get(user__username='plainupload').role, 'student')

    def test_an_administrator_may_create_an_administrator(self):
        response = self.upload(self.admin, [
            {'username': 'secondadmin', 'full_name': 'Second Admin',
             'programme_code': 'BCS', 'role': 'admin'},
        ])

        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))
        self.assertEqual(Profile.objects.get(user__username='secondadmin').role, 'admin')


class PresentationFurnitureTests(TestCase):
    """The presentation dates and venues the timetable grid is built from.

    `TimetableScheduling.js` and `MyAvailabilityPage.js` have always called
    `/presentation-days/` and `/venues/`, but no route existed for either, so both
    pages loaded an empty grid and a coordinator could not add a date or a venue.
    These tests pin the routes and the programme scoping.
    """

    def setUp(self):
        self.bsc = make_programme('BCS', 'BCS')
        self.bse = make_programme('BSE', 'BSE')
        self.coordinator = make_user('furncoord', 'coordinator', self.bsc)
        self.lecturer = make_user('furnlec', 'lecturer', self.bsc)
        self.api = APIClient()

    def test_a_coordinator_can_list_and_add_a_date_and_venue(self):
        self.api.force_authenticate(user=self.coordinator)

        self.assertEqual(self.api.get('/presentation-days/').status_code, 200)
        self.assertEqual(self.api.get('/venues/').status_code, 200)

        day = self.api.post('/presentation-days/', {'date': '2027-03-01'}, format='json')
        self.assertEqual(day.status_code, 201, getattr(day, 'data', None))
        venue = self.api.post('/venues/', {'name': 'DK9'}, format='json')
        self.assertEqual(venue.status_code, 201, getattr(venue, 'data', None))

        # Both are filed under the coordinator's own programme, not chosen per row.
        self.assertEqual(PresentationDay.objects.get(date='2027-03-01').programme, self.bsc)
        self.assertEqual(Venue.objects.get(name='DK9').programme, self.bsc)

    def test_a_repeat_venue_is_refused_with_a_message_not_a_crash(self):
        """`programme` is read-only on the serializer, so DRF could not build its
        unique-together validator and a repeat name went straight to the unique
        index. The coordinator got an HTTP 500 error page from the timetable
        screen's own "add a venue" form instead of something it could show."""
        Venue.objects.create(name='DK9', programme=self.bsc)
        self.api.force_authenticate(user=self.coordinator)

        response = self.api.post('/venues/', {'name': 'DK9'}, format='json')

        self.assertEqual(response.status_code, 400, getattr(response, 'data', None))
        self.assertEqual(Venue.objects.filter(name='DK9').count(), 1)

    def test_a_repeat_venue_is_refused_in_any_case(self):
        """The name column's collation is case-insensitive, so "cl3" collides with
        an existing "CL3" at the database and has to be caught in validation."""
        Venue.objects.create(name='CL3', programme=self.bsc)
        self.api.force_authenticate(user=self.coordinator)

        response = self.api.post('/venues/', {'name': 'cl3'}, format='json')

        self.assertEqual(response.status_code, 400, getattr(response, 'data', None))

    def test_a_repeat_date_is_refused_with_a_message(self):
        PresentationDay.objects.create(date='2027-03-06', programme=self.bsc)
        self.api.force_authenticate(user=self.coordinator)

        response = self.api.post('/presentation-days/', {'date': '2027-03-06'}, format='json')

        self.assertEqual(response.status_code, 400, getattr(response, 'data', None))

    def test_the_same_venue_name_may_exist_in_two_programmes(self):
        """Uniqueness is per programme: another cohort's room list must not stop
        this one from using the same room name."""
        Venue.objects.create(name='DK9', programme=self.bse)
        self.api.force_authenticate(user=self.coordinator)

        response = self.api.post('/venues/', {'name': 'DK9'}, format='json')

        self.assertEqual(response.status_code, 201, getattr(response, 'data', None))

    def test_a_lecturer_can_read_them_but_not_change_them(self):
        """The grid is the lecturer's to book in, not to redraw."""
        PresentationDay.objects.create(date='2027-03-02', programme=self.bsc)
        Venue.objects.create(name='DK10', programme=self.bsc)
        self.api.force_authenticate(user=self.lecturer)

        self.assertEqual(self.api.get('/presentation-days/').status_code, 200)
        self.assertEqual(self.api.get('/venues/').status_code, 200)

        post = self.api.post('/presentation-days/', {'date': '2027-03-03'}, format='json')
        self.assertEqual(post.status_code, 403)

    def test_a_coordinator_only_sees_their_own_programmes_furniture(self):
        PresentationDay.objects.create(date='2027-03-04', programme=self.bsc)
        PresentationDay.objects.create(date='2027-03-05', programme=self.bse)
        self.api.force_authenticate(user=self.coordinator)

        dates = [row['date'] for row in self.api.get('/presentation-days/').data]
        self.assertIn('2027-03-04', dates)
        self.assertNotIn('2027-03-05', dates)

    def test_a_student_cannot_list_them(self):
        student = make_user('furnstudent', 'student', self.bsc, student_id_no='F1')
        self.api.force_authenticate(user=student)

        # An empty result rather than a 403: the list is scoped by programme and a
        # student's programme matches, but the endpoint is staff furniture. The
        # important part is that they cannot write.
        post = self.api.post('/venues/', {'name': 'DK11'}, format='json')
        self.assertEqual(post.status_code, 403)


class ProjectFollowsStudentProgrammeTests(TestCase):
    """A project's programme is derived from its student, never taken on trust.

    The two copies used to drift, which is what made the programme-filtered
    screens disagree about who belonged where.
    """

    def setUp(self):
        self.bsc = make_programme('BCS', 'BCS')
        self.bse = make_programme('BSE', 'BSE')

    def test_a_disagreeing_programme_is_corrected_on_save(self):
        student = make_user('derived', 'student', self.bsc, student_id_no='A1')

        project = FYPProject.objects.create(
            student=student,
            title='Project',
            student_matric_id='A1',
            fyp_stage='FYP1',
            programme=self.bse,  # wrong on purpose
        )

        self.assertEqual(project.programme, self.bsc)

    def test_a_student_with_no_programme_does_not_blank_the_project(self):
        """Moving a student off every programme must not wipe the project's copy."""
        student = make_user('noprogramme', 'student', self.bsc, student_id_no='A2')
        project = FYPProject.objects.create(
            student=student, title='Project', student_matric_id='A2', fyp_stage='FYP1',
        )
        self.assertEqual(project.programme, self.bsc)

        student.profile.programme = None
        student.profile.save()
        project.save()

        # Unchanged rather than nulled: the rule only applies a real programme.
        project.refresh_from_db()
        self.assertEqual(project.programme, self.bsc)

    def test_moving_the_student_moves_the_project(self):
        bse_coordinator = make_user('bsecoord', 'coordinator', self.bse)
        student = make_user('moves', 'student', self.bsc, student_id_no='A3')
        project = FYPProject.objects.create(
            student=student, title='Project', student_matric_id='A3', fyp_stage='FYP1',
        )
        self.assertEqual(project.programme, self.bsc)

        request = APIRequestFactory().patch(f'/users/{student.id}/', {})
        request.user = bse_coordinator
        serializer = UserWriteSerializer(
            student, data={'programme': self.bse.id}, partial=True, context={'request': request}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        project.refresh_from_db()
        self.assertEqual(project.programme, self.bse)


class StudentIdCorrectionTests(TestCase):
    """A corrected matric number has to move everywhere it is the key.

    ``Profile.student_id_no`` is not the only copy. ``FYPProject.student_matric_id``
    is what the Student List, the Timetabling page and the Course Performance
    Report display, and ``RubricMarks.student_id`` is what saved marks are matched
    on. The account form only ever wrote the Profile copy, so correcting a
    student's number left every one of those screens showing the old one — the
    edit looked as though it had been ignored, because the field being edited is
    not the field those pages read.
    """

    def setUp(self):
        self.bsc = make_programme('BCS', 'BCS')
        self.coordinator = make_user('idcoord', 'coordinator', self.bsc)
        self.student = make_user('idstudent', 'student', self.bsc, student_id_no='OLD1')
        self.project = FYPProject.objects.create(
            student=self.student,
            title='Project',
            student_matric_id='OLD1',
            fyp_stage='FYP1',
        )
        self.template = RubricTemplate.objects.create(
            id='tpl_student_id', name='Rubric', template_data='{}', created_by='test',
        )
        self.mark = RubricMarks.objects.create(
            template=self.template,
            student_id='OLD1',
            student_name='Idstudent',
            course='CSS3714 Final Year Project I',
            marks_data='{}',
            evaluated_by='lecturer',
        )

    def _save(self, student, **payload):
        request = APIRequestFactory().patch(f'/users/{student.id}/', payload)
        request.user = self.coordinator
        serializer = UserWriteSerializer(
            student, data=payload, partial=True, context={'request': request}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        return serializer

    def test_the_project_row_follows_the_corrected_number(self):
        self._save(self.student, student_id_no='NEW1')

        self.project.refresh_from_db()
        self.assertEqual(self.project.student_matric_id, 'NEW1')

    def test_saved_marks_follow_the_corrected_number(self):
        """Left behind, the student's marks would drop out of their own report
        row: the report matches a mark to a project by this string."""
        self._save(self.student, student_id_no='NEW1')

        self.mark.refresh_from_db()
        self.assertEqual(self.mark.student_id, 'NEW1')

    def test_the_response_reports_the_number_it_just_saved(self):
        """The row is read with select_related('profile'), so the request used to
        answer with the value the edit had just replaced — a successful edit
        reported as a no-op, which is exactly how the bug presented in the UI."""
        serializer = self._save(self.student, student_id_no='NEW1')

        self.assertEqual(serializer.data['student_id_no'], 'NEW1')

    def test_filling_in_a_missing_number_reaches_the_project(self):
        """A student captured without a matric is numbered later; the lists read
        the project column, so leaving it blank keeps them unnumbered there."""
        late = make_user('lateid', 'student', self.bsc, student_id_no='')
        project = FYPProject.objects.create(
            student=late, title='Project', student_matric_id='', fyp_stage='FYP1',
        )

        self._save(late, student_id_no='FIRST1')

        project.refresh_from_db()
        self.assertEqual(project.student_matric_id, 'FIRST1')

    def test_filling_in_a_missing_number_does_not_sweep_up_blank_mark_rows(self):
        """Re-keying rows whose student_id is empty would re-point somebody
        else's marks, so a first-time number only touches the project row."""
        late = make_user('lateblank', 'student', self.bsc, student_id_no='')
        orphan = RubricMarks.objects.create(
            template=self.template,
            student_id='',
            student_name='Someone Else',
            marks_data='{}',
            evaluated_by='lecturer',
        )

        self._save(late, student_id_no='FIRST1')

        orphan.refresh_from_db()
        self.assertEqual(orphan.student_id, '')

    def test_a_number_another_account_already_holds_is_refused(self):
        """Two accounts on one matric would pool their marks into a single report
        row, because the report counts marks per student by this string."""
        make_user('taken', 'student', self.bsc, student_id_no='TAKEN1')
        request = APIRequestFactory().patch(f'/users/{self.student.id}/', {})
        request.user = self.coordinator
        serializer = UserWriteSerializer(
            self.student,
            data={'student_id_no': 'TAKEN1'},
            partial=True,
            context={'request': request},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('student_id_no', serializer.errors)

        self.student.profile.refresh_from_db()
        self.assertEqual(self.student.profile.student_id_no, 'OLD1')

    def test_an_account_may_keep_its_own_number(self):
        """Re-saving an untouched form must not trip the duplicate check against
        the very row being edited."""
        serializer = self._save(self.student, student_id_no='OLD1', phone_no='011-1')

        self.assertEqual(serializer.data['student_id_no'], 'OLD1')


class AutoAssignExaminersTests(TestCase):
    """Auto-assignment fills the gaps; it does not re-draw what is already there.

    The cohort-wide queryset had no `examiner__isnull` bound, so every call
    re-randomised the examiner for *every* project in the programme — including
    ones already assigned — and the pool was rebuilt per project without
    excluding the incumbent, so a lecturer could even draw their own project
    again. The endpoint's own "All projects already have an examiner" message
    asserted the behaviour it did not implement. This endpoint has no UI caller
    (API-only), which is why nothing caught it.
    """

    URL = '/auto-assign-examiners/'

    def setUp(self):
        self.bsc = make_programme('BCS', 'BCS')
        self.bse = make_programme('BSE', 'BSE')
        self.coordinator = make_user('bccord', 'coordinator', self.bsc)
        self.examiner_one = make_user('exam1', 'lecturer', self.bsc)
        self.examiner_two = make_user('exam2', 'lecturer', self.bsc)
        self.other_cohort = make_user('bselec', 'lecturer', self.bse)
        self.api = APIClient()

    def make_project(self, username, matric, examiner=None, supervisor=None):
        student = make_user(username, 'student', self.bsc, student_id_no=matric)
        return FYPProject.objects.create(
            student=student,
            title=f'Project {matric}',
            student_matric_id=matric,
            fyp_stage='FYP1',
            examiner=examiner,
            supervisor=supervisor,
        )

    def assign(self, user):
        self.api.force_authenticate(user=user)
        return self.api.post(self.URL)

    def test_an_existing_examiner_is_left_alone(self):
        project = self.make_project('kept', 'K1', examiner=self.examiner_one)

        response = self.assign(self.coordinator)

        self.assertEqual(response.status_code, 200)
        project.refresh_from_db()
        self.assertEqual(project.examiner, self.examiner_one)

    def test_only_unassigned_projects_are_filled(self):
        assigned = self.make_project('assigned', 'K2', examiner=self.examiner_one)
        unassigned = self.make_project('waiting', 'K3')

        self.assign(self.coordinator)

        assigned.refresh_from_db()
        unassigned.refresh_from_db()
        self.assertEqual(assigned.examiner, self.examiner_one)
        self.assertIsNotNone(unassigned.examiner)

    def test_a_fully_assigned_cohort_reports_that_nothing_was_needed(self):
        project = self.make_project('done', 'K4', examiner=self.examiner_one)

        response = self.assign(self.coordinator)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'info')
        project.refresh_from_db()
        self.assertEqual(project.examiner, self.examiner_one)

    def test_a_new_examiner_never_teaches_their_own_project(self):
        project = self.make_project(
            'supervised', 'K5',
            supervisor=self.examiner_one,
            examiner=None,
        )

        self.assign(self.coordinator)

        project.refresh_from_db()
        self.assertIsNotNone(project.examiner)
        self.assertNotEqual(project.examiner, self.examiner_one)

    def test_the_draw_is_bounded_to_the_coordinators_own_programme(self):
        project = self.make_project('scoped', 'K6')

        self.assign(self.coordinator)

        project.refresh_from_db()
        self.assertIsNotNone(project.examiner)
        self.assertNotEqual(project.examiner, self.other_cohort)

    def test_another_programmes_cohort_is_untouched(self):
        bse_student = make_user('bsestudent', 'student', self.bse, student_id_no='B1')
        bse_project = FYPProject.objects.create(
            student=bse_student, title='BSE Project', student_matric_id='B1',
            fyp_stage='FYP1',
        )
        self.make_project('mine', 'K7')

        self.assign(self.coordinator)

        bse_project.refresh_from_db()
        self.assertIsNone(bse_project.examiner)

    def test_a_lecturer_cannot_run_it(self):
        project = self.make_project('guarded', 'K8')

        response = self.assign(self.examiner_one)

        self.assertEqual(response.status_code, 403)
        project.refresh_from_db()
        self.assertIsNone(project.examiner)

