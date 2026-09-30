"""Diagnostic: how does each write path store datetimes in this project?

Everything runs inside a transaction that is rolled back, so no data changes.
Run from backend/:  ..\\venv\\Scripts\\python.exe ..\\database\\_tz_probe.py
"""
import os
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

import django  # noqa: E402
django.setup()

from django.conf import settings  # noqa: E402
from django.contrib.auth.models import User  # noqa: E402
from django.db import connection, transaction  # noqa: E402

from api.models import Announcements, TimetableBooking  # noqa: E402
from rest_framework import serializers  # noqa: E402

print(f'USE_TZ={settings.USE_TZ}  TIME_ZONE={settings.TIME_ZONE}')


def raw(sql, params=None):
    with connection.cursor() as cur:
        cur.execute(sql, params or [])
        return cur.fetchall()


class BookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimetableBooking
        fields = '__all__'


def report(label, sql, params):
    rows = raw(sql, params)
    print(f'  {label}: {rows}')


try:
    with transaction.atomic():
        session = raw('SELECT NOW(), UTC_TIMESTAMP(), @@session.time_zone')[0]
        print(f'\nMySQL session: now={session[0]} utc={session[1]} tz={session[2]}')
        print(f'Python local now: {datetime.now()}   Python utc now: {datetime.utcnow()}')

        user = User.objects.filter(profile__role='lecturer').first()
        print(f'  using lecturer user pk={user.pk} ({user.username})')

        # --- Path 1: Django server-generated timestamp (auto_now_add) ---
        ann = Announcements.objects.create(coordinator=user, title='tz probe', content='x')
        report('auto_now_add announcements.created_at',
               'SELECT created_at, NOW(), TIMESTAMPDIFF(HOUR, created_at, NOW()) AS hours_behind_now '
               'FROM announcements WHERE id = %s', [ann.id])

        # --- Path 2: DRF input in the frontend's fake-UTC convention ---
        # MyAvailabilityPage.js sends moment.utc('<local pick>').toISOString()
        s = BookingSerializer(data={
            'lecturer': user.id, 'start_time': '2026-10-01T09:00:00.000Z',
            'end_time': '2026-10-01T09:30:00.000Z', 'venue': 'probe',
        })
        s.is_valid(raise_exception=True)
        b1 = s.save()
        report('DRF aware "Z" input (09:00Z) -> bookings.start_time',
               'SELECT start_time FROM api_timetablebooking WHERE id = %s', [b1.id])

        # --- Path 3: DRF input with no timezone (a plain datetime-local value) ---
        s2 = BookingSerializer(data={
            'lecturer': user.id, 'start_time': '2026-10-01T09:00:00',
            'end_time': '2026-10-01T09:30:00', 'venue': 'probe2',
        })
        s2.is_valid(raise_exception=True)
        b2 = s2.save()
        report('DRF naive input (09:00) -> bookings.start_time',
               'SELECT start_time FROM api_timetablebooking WHERE id = %s', [b2.id])

        # --- Path 4: views.py auto-scheduler style (naive Malaysia wall clock) ---
        from datetime import date as date_cls
        naive = datetime.combine(date_cls(2026, 10, 1), datetime.min.time().replace(hour=8))
        b3 = TimetableBooking.objects.create(lecturer=user, start_time=naive, end_time=naive, venue='probe3')
        report('scheduler naive 08:00 -> bookings.start_time',
               'SELECT start_time FROM api_timetablebooking WHERE id = %s', [b3.id])

        # --- What the API hands back to the browser ---
        print(f'\n  DRF output for the "Z" row   : {s.to_representation(b1)["start_time"]}')
        print(f'  DRF output for the naive row : {s2.to_representation(b2)["start_time"]}')

        # --- Reading side: what does Django report for a row it wrote? ---
        fresh = TimetableBooking.objects.get(pk=b1.pk)
        print(f'  Django reads the "Z" row back as: {fresh.start_time!r}')

        raise RuntimeError('rollback on purpose')
except RuntimeError:
    print('\nTransaction rolled back; no data was written.')

with connection.cursor() as cur:
    cur.execute('SELECT COUNT(*) FROM api_timetablebooking')
    print('api_timetablebooking rows after rollback:', cur.fetchone()[0])
    cur.execute('SELECT COUNT(*) FROM announcements')
    print('announcements rows after rollback:', cur.fetchone()[0])
