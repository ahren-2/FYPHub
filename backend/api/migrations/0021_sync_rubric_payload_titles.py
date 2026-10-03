"""Make a renamed template's own payload agree with its row.

Migration 0019 renamed the BCS FYP 1 rubric to `Template FYP1` so all four
programmes read the same in the Rubrics list. The `name` column was updated, but
the JSON in `template_data` still carries its original `title`
('CSS3714 Final Year Project I Marking Rubric (BCS) Ver. 7'), and the Rubrics
Editor writes both from the same form.

Two copies of one value is the drift this project keeps paying for, so the clone
path in 0019 already writes them together. This migration brings the rows that
predate that into line: every template whose row name and payload title disagree
is updated so the payload follows the row, which is the copy the UI displays and
the one a coordinator edits.

`course` is deliberately left alone. It holds the paper code (`CSS3714 Final Year
Project I`), which is the only thing on the row recording that the BCS rubric is
the source the other programmes' copies were made from.
"""

import json

from django.db import migrations


def sync_payload_titles(apps, schema_editor):
    RubricTemplate = apps.get_model('api', 'RubricTemplate')

    for template in RubricTemplate.objects.all():
        try:
            data = json.loads(template.template_data)
        except (TypeError, ValueError):
            # A payload that is not JSON cannot be corrected here; the Rubrics
            # Editor will surface it and a coordinator can repair it.
            continue
        if not isinstance(data, dict):
            continue

        if data.get('title') != template.name:
            data['title'] = template.name
        # Keep the self-reference correct too: the editor reads `id` back out of
        # the payload when it decides which row it is editing.
        if data.get('id') != template.id:
            data['id'] = template.id

        template.template_data = json.dumps(data, ensure_ascii=False)
        template.save(update_fields=['template_data'])


def noop_reverse(apps, schema_editor):
    """Nothing to undo: the previous payload titles are not worth restoring."""
    return


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0020_seed_presentation_furniture'),
    ]

    operations = [
        migrations.RunPython(sync_payload_titles, noop_reverse),
    ]
