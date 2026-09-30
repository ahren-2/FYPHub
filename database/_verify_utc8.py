"""Verification that the whole system runs on Malaysia wall-clock time (UTC+8).

Checks config, every write path, the auto-scheduler endpoint, the values the
browser receives, and that PHP-written rubric rows are untouched.

Everything runs inside a transaction that is rolled back, so no data changes.
Run from the project root:  venv\\Scripts\\python.exe database\\_verify_utc8.py
"""
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

import django  # noqa: E402
django.setup()

from django.conf import settings  # noqa: E402
from django.contrib.auth.models import User  # noqa: E402
from django.db import connection, transaction  # noqa: E402
from django.urls import reverse  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

from api.models import (Announcements, FYPProject, PresentationSlot,  # noqa: E402
                        RubricMarks, TimetableBooking)

failures = []
notes = []


def check(label, condition, detail=''):
    status = 'PASS' if condition else 'FAIL'
    if not condition:
        failures.append(label)
    print(f'  [{status}] {label}{"  ->  " + str(detail) if detail else ""}')


def raw(sql, params=None):
    with connection.cursor() as cur:
        cur.execute(sql, params or [])
        return cur.fetchall()


print('=' * 74)
print('1. CONFIGURATION')
print('=' * 74)
session_tz = raw('SELECT @@session.time_zone, NOW(), UTC_TIMESTAMP()')[0]
py_now = datetime.now()
print(f'  USE_TZ={settings.USE_TZ}  TIME_ZONE={settings.TIME_ZONE}')
print(f'  MySQL session tz={session_tz[0]}  NOW()={session_tz[1]}  UTC_TIMESTAMP()={session_tz[2]}')
print(f'  Python datetime.now()={py_now}')
check('USE_TZ is False (wall-clock storage)', settings.USE_TZ is False)
check('TIME_ZONE is Asia/Kuala_Lumpur', settings.TIME_ZONE == 'Asia/Kuala_Lumpur')
check('MySQL session pinned to +08:00', session_tz[0] == '+08:00', session_tz[0])
check('Python clock agrees with MySQL NOW() (< 5s apart)',
      abs((py_now - session_tz[1]).total_seconds()) < 5,
      f'{abs((py_now - session_tz[1]).total_seconds()):.1f}s')
check('Malaysia is UTC+8', (session_tz[1] - session_tz[2]).total_seconds() == 8 * 3600)

try:
    with transaction.atomic():
        print()
        print('=' * 74)
        print('2. WRITE PATHS (all must land on Malaysia wall clock)')
        print('=' * 74)
        # Pick a coordinator whose programme has projects the scheduler can place.
        coordinator = programme = None
        for candidate in User.objects.select_related('profile').filter(
                profile__role='coordinator', profile__programme__isnull=False):
            prog = candidate.profile.programme
            already = TimetableBooking.objects.filter(
                project__student__profile__programme=prog).values_list('project_id', flat=True)
            if FYPProject.objects.filter(student__profile__programme=prog,
                                         supervisor__isnull=False).exclude(id__in=already).exists():
                coordinator, programme = candidate, prog
                break
        check('found a coordinator with schedulable projects', coordinator is not None)
        print(f'  coordinator={coordinator.username} programme={programme}')

        # 2a. Server-generated timestamps (auto_now / auto_now_add)
        ann = Announcements.objects.create(coordinator=coordinator, title='utc8 check', content='x')
        stored, now_db = raw('SELECT created_at, NOW() FROM announcements WHERE id = %s', [ann.id])[0]
        drift = abs((now_db - stored).total_seconds())
        check('auto_now_add stores local wall clock (0h drift, not 8h)',
              drift < 10, f'{drift:.2f}s from MySQL NOW()')

        # 2b. A booking created the way the browser does it (fake-UTC "Z" string)
        # The test client sends Host: testserver, which the project's empty
        # ALLOWED_HOSTS rejects; allow it for this script only.
        settings.ALLOWED_HOSTS = list(settings.ALLOWED_HOSTS) + ['testserver']
        client = APIClient()
        client.force_authenticate(user=coordinator)
        payload = {'lecturer': coordinator.id, 'venue': 'UTC8-A',
                   'start_time': '2026-11-02T09:00:00.000Z',
                   'end_time': '2026-11-02T09:30:00.000Z'}
        resp = client.post(reverse('booking-list'), payload, format='json')
        check('booking POST accepted', resp.status_code in (200, 201), f'HTTP {resp.status_code}')
        booking_id = resp.data.get('id')
        stored = raw('SELECT start_time FROM api_timetablebooking WHERE id = %s', [booking_id])[0][0]
        check('browser-picked 09:00 is stored as 09:00 wall clock',
              stored == datetime(2026, 11, 2, 9, 0), stored)
        check('API returns the value with no offset (so new Date() reads it as local)',
              str(resp.data['start_time']) == '2026-11-02T09:00:00', resp.data['start_time'])

        # 2c. Auto-scheduler: the path that used to store times 8 hours off
        PresentationSlot.objects.create(programme=programme, date=datetime(2026, 11, 20).date(),
                                        venue_name='UTC8-VENUE')
        pool = FYPProject.objects.filter(student__profile__programme=programme,
                                        supervisor__isnull=False)
        resp = client.post(reverse('run-scheduler'), {}, format='json')
        sched_rows = raw(
            'SELECT id, start_time, end_time FROM api_timetablebooking '
            'WHERE venue = %s ORDER BY start_time', ['UTC8-VENUE'])
        print(f'  scheduler response: HTTP {resp.status_code} {resp.data}')
        check('scheduler created bookings', len(sched_rows) > 0, f'{len(sched_rows)} row(s)')
        in_window = all(
            datetime(2026, 11, 20, 8, 0) <= row[1] <= datetime(2026, 11, 20, 17, 0)
            for row in sched_rows)
        on_grid = all(row[1].minute in (0, 30) and row[1].second == 0 for row in sched_rows)
        check('scheduled times fall in the 08:00-17:00 working window (no 8h shift)',
              in_window, [str(r[1]) for r in sched_rows][:4])
        check('scheduled times are on the 30-minute grid', on_grid,
              [str(r[1]) for r in sched_rows][:4])
        check('each booking is 30 minutes long',
              all(r[2] - r[1] == timedelta(minutes=30) for r in sched_rows))
        if sched_rows:
            first = min(r[1] for r in sched_rows)
            check('scheduler starts the day at 08:00', first == datetime(2026, 11, 20, 8, 0), first)

        # 2d. Naive input is no longer shifted
        resp2 = client.post(reverse('booking-list'), {
            'lecturer': coordinator.id, 'venue': 'UTC8-B',
            'start_time': '2026-11-03T14:00:00', 'end_time': '2026-11-03T14:30:00',
        }, format='json')
        stored2 = raw('SELECT start_time FROM api_timetablebooking WHERE id = %s',
                      [resp2.data.get('id')])[0][0]
        check('naive 14:00 input is stored as 14:00 (was stored as 06:00 before)',
              stored2 == datetime(2026, 11, 3, 14, 0), stored2)

        print()
        print('=' * 74)
        print('3. AUTHENTICATION AND API OUTPUT')
        print('=' * 74)
        # USE_TZ changed, so prove the JWT login flow the frontend uses still works.
        temp = User.objects.create_user(username='utc8_probe', password='utc8-probe-pass')
        anon = APIClient()
        token_resp = anon.post('/token/', {'username': 'utc8_probe', 'password': 'utc8-probe-pass'},
                               format='json')
        check('POST /token/ returns an access token', token_resp.status_code == 200,
              f'HTTP {token_resp.status_code}')
        access = token_resp.data.get('access') if token_resp.status_code == 200 else None
        check('access token issued', bool(access))
        if access:
            auth_client = APIClient()
            auth_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
            listing = auth_client.get(reverse('announcement-list'))
            check('authenticated GET /announcements/ works', listing.status_code == 200,
                  f'HTTP {listing.status_code}')
            if listing.status_code == 200 and listing.data:
                value = listing.data[0]['created_at']
                check('announcement timestamps come back without a UTC offset',
                      not str(value).endswith('Z') and '+' not in str(value), value)
            else:
                notes.append('announcements list was empty for the probe user; '
                             'offset-free output is covered by the booking payload above')

        print()
        print('=' * 74)
        print('4. PHP-WRITTEN RUBRIC DATA (must be untouched by the change)')
        print('=' * 74)
        mark = RubricMarks.objects.select_related('template').first()
        mark_raw = raw('SELECT evaluated_at, updated_at FROM rubrics_marks WHERE id = %s', [mark.id])[0]
        print(f'  rubrics_marks id={mark.id} evaluated_at={mark_raw[0]} (Django reads {mark.evaluated_at})')
        check('Django reads the PHP timestamp as the same wall clock',
              mark.evaluated_at == mark_raw[0], mark.evaluated_at)
        check('no offset is attached to rubric datetimes', mark.evaluated_at.tzinfo is None)

        raise RuntimeError('rollback on purpose')
except RuntimeError:
    print('\nTransaction rolled back; no data was written.')

print()
print('=' * 74)
print('4. POST-ROLLBACK STATE')
print('=' * 74)
for table in ('api_timetablebooking', 'api_presentationslot', 'announcements'):
    n = raw(f'SELECT COUNT(*) FROM {table}')[0][0]
    print(f'  {table}: {n} row(s)')
    if table != 'announcements':
        check(f'{table} left empty', n == 0, n)

print()
print('=' * 74)
print('RESULT:', 'no problems' if not failures else f'{len(failures)} PROBLEM(S): {failures}')
print('=' * 74)
