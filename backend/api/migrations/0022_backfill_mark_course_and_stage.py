"""Fill in the missing `course` and `fyp_stage` on existing mark rows.

Four of the six rows in `rubrics_marks` have `course` and `fyp_stage` set to NULL.
Those columns are what the course performance report groups by, so a row without
them is a mark that exists but appears in no report — it is counted in nothing
and attributed to no stage.

Both values are derivable from the template the mark was recorded against, which
is the only thing that legitimately decides them:
    course      <- the template's own `course` value
    fyp_stage   <- the template's own `fyp_stage`, normalised to FYP1/FYP2/PROPOSAL

The template is read through the ORM rather than hard-coded per row, so a
template edited since the mark was saved contributes its current values — which
is the same behaviour as a fresh save, where the frontend sends `template.course`
and `template.fyp_stage` straight from the loaded template.

Only rows with a NULL column are touched. A row that already carries a value is
left exactly as it is, including one whose value disagrees with its template:
that disagreement is real history and silently rewriting it would hide it.
"""

import json

from django.db import migrations


def normalize_stage(value):
    """Mirror of `normalize_stage` in php/save_mark.php and the frontend."""
    compact = str(value or '').upper().replace(' ', '').replace('PROJECT', 'FYP')
    if 'PROPOSAL' in compact:
        return 'PROPOSAL'
    if 'FYP1' in compact or compact == '1':
        return 'FYP1'
    if 'FYP2' in compact or compact == '2':
        return 'FYP2'
    return ''


def backfill_mark_course_and_stage(apps, schema_editor):
    RubricMarks = apps.get_model('api', 'RubricMarks')
    RubricTemplate = apps.get_model('api', 'RubricTemplate')

    rows = RubricMarks.objects.filter(course__isnull=True) | \
        RubricMarks.objects.filter(fyp_stage__isnull=True)
    if not rows.exists():
        return

    # One read per distinct template rather than per row.
    templates = {
        template.id: template
        for template in RubricTemplate.objects.filter(
            id__in=set(rows.values_list('template_id', flat=True))
        )
    }

    for mark in rows:
        template = templates.get(mark.template_id)
        if template is None:
            continue

        try:
            data = json.loads(template.template_data)
        except (TypeError, ValueError):
            data = {}
        if not isinstance(data, dict):
            data = {}

        updates = []
        if mark.course is None:
            course = data.get('course') or ''
            if course:
                mark.course = course
                updates.append('course')

        if mark.fyp_stage is None:
            # The template stores the stage in its payload, not as a column.
            stage = normalize_stage(data.get('fyp_stage'))
            if stage:
                mark.fyp_stage = stage
                updates.append('fyp_stage')

        if updates:
            mark.save(update_fields=updates)


def noop_reverse(apps, schema_editor):
    """Nothing to undo: these columns were NULL, and NULL is not worth restoring."""
    return


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0021_sync_rubric_payload_titles'),
    ]

    operations = [
        migrations.RunPython(backfill_mark_course_and_stage, noop_reverse),
    ]
