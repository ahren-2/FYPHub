"""Give every programme the schedule furniture it needs to be usable.

The problem
-----------
The presentation tables were completely empty:

    api_presentationday   0 rows
    api_venue             0 rows
    api_presentationslot  0 rows
    api_timetablebooking  0 rows

Two things depend on them:

* `MyAvailabilityPage` — the lecturer's booking grid — renders one column per
  venue and reads its dates from `api_presentationday`. With both empty the grid
  renders as a single empty cell on one undefined date, so there is nothing to
  choose and no way to see what a lecturer sees.
* `run_auto_scheduler` reads `PresentationSlot` and returns "No slots configured.
  Please define Presentation Slots first." for every programme, so the
  coordinator's Run Scheduler button cannot produce anything.

What this seeds
---------------
For each programme, per the instruction that every programme gets its own
timetable:

* two presentation dates a few weeks out,
* two venues,
* and the date x venue `PresentationSlot` pairs those two produce, which is what
  the scheduler iterates.

`presentation_days` and `venues` are both unique per (programme, value), and
`presentation_slots` is unique per (programme, date, venue_name), so because each
programme rows are distinct there is no collision between cohorts and the
migration is safe to re-run.

No bookings are created. An empty grid is the honest starting state: it shows a
lecturer exactly which cells are free, which is what the grid exists to do.
"""

from datetime import date, timedelta

from django.db import migrations

# (code, [(venue name, ...)])
VENUES_BY_PROGRAMME = {
    'BCS': ('DK1', 'DK2'),
    'BDM': ('DK3', 'DK4'),
    'BMD': ('DK5', 'DK6'),
    'BID': ('DK7', 'DK8'),
}

# Two dates per programme: the second week's Monday and Wednesday following the
# migration, so the window stays in the future however the schema is deployed.
DAYS_AHEAD = (14, 16)


def _presentation_dates(today):
    """The seeded dates, skipping weekends so the grid opens on working days."""
    dates = []
    for offset in DAYS_AHEAD:
        candidate = today + timedelta(days=offset)
        while candidate.weekday() >= 5:
            candidate += timedelta(days=1)
        dates.append(candidate)
    return dates


def seed_timetable_furniture(apps, schema_editor):
    Programme = apps.get_model('api', 'Programme')
    PresentationDay = apps.get_model('api', 'PresentationDay')
    Venue = apps.get_model('api', 'Venue')
    PresentationSlot = apps.get_model('api', 'PresentationSlot')

    # Anchored to the migration's own run date rather than to a literal, so a
    # database migrated in six months' time still gets a future-facing window.
    dates = _presentation_dates(date.today())

    for programme in Programme.objects.order_by('code'):
        venues = VENUES_BY_PROGRAMME.get(programme.code)
        if not venues:
            # A programme added later has no venue naming convention here. It is
            # left for its coordinator to set up rather than guessed at.
            continue

        for day in dates:
            PresentationDay.objects.get_or_create(
                date=day, programme=programme, defaults={}
            )

        for venue_name in venues:
            Venue.objects.get_or_create(
                name=venue_name, programme=programme, defaults={}
            )

        # The date x venue pairs the scheduler iterates, matching
        # `run_auto_scheduler`'s own model of a slot.
        for day in dates:
            for venue_name in venues:
                PresentationSlot.objects.get_or_create(
                    programme=programme,
                    date=day,
                    venue_name=venue_name,
                    defaults={},
                )


def remove_seeded_furniture(apps, schema_editor):
    """Reverse: drop only the rows this migration's naming scheme covers."""
    Programme = apps.get_model('api', 'Programme')
    PresentationDay = apps.get_model('api', 'PresentationDay')
    Venue = apps.get_model('api', 'Venue')
    PresentationSlot = apps.get_model('api', 'PresentationSlot')

    codes = list(VENUES_BY_PROGRAMME)
    venue_names = [name for names in VENUES_BY_PROGRAMME.values() for name in names]

    venues = Venue.objects.filter(programme__code__in=codes, name__in=venue_names)
    # PresentationSlot stores the venue as text, so it is matched by name.
    PresentationSlot.objects.filter(programme__code__in=codes, venue_name__in=venue_names).delete()
    venues.delete()

    dates = _presentation_dates(date.today())
    PresentationDay.objects.filter(programme__code__in=codes, date__in=dates).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0019_per_programme_rubric_templates'),
    ]

    operations = [
        migrations.RunPython(seed_timetable_furniture, remove_seeded_furniture),
    ]
