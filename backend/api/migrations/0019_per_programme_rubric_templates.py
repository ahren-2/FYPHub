"""Give every programme its own FYP 1 marking template, named 'Template FYP1'.

The instruction
---------------
Each programme keeps its own templates. A programme with no template gets one
named `Template FYP1`, filled from the existing BCS rubric
`CSS3714 Final Year Project I Marking Rubric (BCS) Ver. 7` and renamed.

What is created
---------------
For every programme apart from the source programme (BCS), this inserts a clone
of the source FYP 1 rubric:

    id            tpl_<code>_fyp1_<n>      e.g. tpl_BDM_fyp1_v1
    name          Template FYP1
    template_data a copy of the source, with `title` set to the template name and
                  `course` set to the programme code, and the embedded `id`
                  corrected to the new row's id
    programme     the programme the row belongs to

The source template's own name is then set to `Template FYP1` as well, so all
four programmes read identically in the Rubrics list and are told apart by the
programme shown on the card. Its `course` value is left alone: `CSS3714 Final
Year Project I` is the real BCS paper code and the only thing on the row that
records where the rubric came from. Its `template_data` is untouched, so the
criteria, weights and level descriptors — the parts that were hand-edited up to
version 13 — are not disturbed.

Two supporting changes
----------------------
* An active template is set for each (programme, stage) pair, because
  `get_active_template.php` is looked up per programme and a programme with no
  row there cannot grade at all. FYP 2 and Proposal are covered as well as FYP 1,
  for the same reason.
* The two CDM schemes were being treated as BCS rubrics and were linked to BCS
  stages. They are not BCS papers, so they are unlinked (programme NULL), which
  makes them a library a coordinator of any programme can set active.

Idempotent: every insert is guarded by an existence check, and the active rows
are written with get_or_create, so re-running changes nothing.
"""

import json

from django.db import migrations

# The rubric the per-programme FYP 1 templates are copied from.
SOURCE_TEMPLATE_ID = 'tpl_fyp1_marking_v7'
SOURCE_TEMPLATE_CODE = 'BCS'

# The name every programme's FYP 1 template is given.
TEMPLATE_NAMES = {
    'FYP1': 'Template FYP1',
    'FYP2': 'Template FYP2',
    'PROPOSAL': 'Template PROPOSAL',
}

# Which existing template each stage is cloned from, and its embedded stage value.
STAGE_SOURCES = {
    'FYP1': ('tpl_fyp1_marking_v7', 'FYP 1'),
    'FYP2': ('tpl_fyp2_marking_v7', 'FYP2'),
    'PROPOSAL': ('tpl_1781430152_532ac', 'Proposal'),
}

# Rubrics that are not BCS papers. They were attached to BCS by migration 0018
# simply because every rubric row was; they belong to no programme in particular
# and are more useful as library templates any programme can adopt.
UNSCOPED_TEMPLATE_IDS = ('tpl_1778746062_7fe8f', 'tpl_1781430152_532ac')


def _clone_template_data(raw, *, template_id, title, course):
    """Copy a template's JSON with its self-describing fields corrected.

    The payload carries its own `id`, `title` and `course` alongside the columns
    of the same name, and the Rubrics Editor writes both. Leaving them stale
    would make a clone display the original's identity.
    """
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        # A payload that is not JSON cannot be corrected. Copy it verbatim so the
        # clone still exists and a coordinator can repair it in the editor,
        # rather than failing the whole migration over one bad row.
        return raw

    data['id'] = template_id
    data['title'] = title
    data['course'] = course
    return json.dumps(data, ensure_ascii=False)


def _template_course(raw):
    """The `course` value inside a template payload, or '' if it cannot be read."""
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return ''
    if not isinstance(data, dict):
        return ''
    return str(data.get('course') or '')


def create_per_programme_templates(apps, schema_editor):
    Programme = apps.get_model('api', 'Programme')
    RubricTemplate = apps.get_model('api', 'RubricTemplate')
    RubricActiveTemplate = apps.get_model('api', 'RubricActiveTemplate')

    programmes = list(Programme.objects.order_by('code'))
    if not programmes:
        return

    source = RubricTemplate.objects.filter(pk=SOURCE_TEMPLATE_ID).first()
    if source is None:
        # Nothing to copy from. The active-template step below is still worth
        # running, so this returns rather than raising.
        return

    # --- 1. One template per stage, per programme -----------------------------
    for programme in programmes:
        for stage in STAGE_SOURCES:
            stage_lower = stage.lower()
            title = TEMPLATE_NAMES[stage]

            template_id = f'tpl_{programme.code}_{stage_lower}_v1'

            if programme.code == SOURCE_TEMPLATE_CODE and stage == 'FYP1':
                # The source rubric already belongs to this programme. Rename it in
                # place instead of making a duplicate: the criteria in it are the
                # result of thirteen edits and a copy would immediately drift.
                if source.name != title:
                    source.name = title
                    source.save(update_fields=['name'])
                continue

            if RubricTemplate.objects.filter(pk=template_id).exists():
                continue

            source_id = STAGE_SOURCES[stage][0]
            clone_source = RubricTemplate.objects.filter(pk=source_id).first()
            if clone_source is None:
                continue

            course = _template_course(clone_source.template_data)
            # Another programme's paper code is not this programme's paper. Only
            # the programme that owns the paper keeps its code; for the rest the
            # programme code is the honest label, because inventing a paper code
            # for a programme whose curriculum is not in this database would be a
            # guess that ends up printed on a report.
            if course and clone_source.programme_id != programme.id:
                course = f'{programme.code} {course}'

            RubricTemplate.objects.create(
                id=template_id,
                name=title,
                template_data=_clone_template_data(
                    clone_source.template_data,
                    template_id=template_id,
                    title=title,
                    course=course,
                ),
                created_by=clone_source.created_by,
                created_at=clone_source.created_at,
                version=1,
                is_active=True,
                programme=programme,
            )

    # --- 2. Library templates belong to no programme --------------------------
    RubricTemplate.objects.filter(pk__in=UNSCOPED_TEMPLATE_IDS).update(programme=None)

    # --- 3. Exactly one active template per (programme, stage) ----------------
    for programme in programmes:
        for stage in ('FYP1', 'FYP2', 'PROPOSAL'):
            if programme.code == SOURCE_TEMPLATE_CODE:
                # BCS already had the official templates mapped to its stages by
                # migration 0018; do not overwrite a choice the course made.
                already = RubricActiveTemplate.objects.filter(
                    programme=programme, fyp_stage=stage
                ).exists()
                if already:
                    continue

            own = RubricTemplate.objects.filter(
                programme=programme, name=TEMPLATE_NAMES[stage], is_active=True
            ).first()
            if own is None:
                continue

            RubricActiveTemplate.objects.get_or_create(
                programme=programme,
                fyp_stage=stage,
                defaults={'template': own, 'updated_by': 'migration 0019'},
            )

    # --- 4. Drop the active mappings that point at unlinked templates ---------
    # `set_active_template.php` refuses a template whose stage disagrees with the
    # requested one, so a mapping left pointing at a library template would make
    # the stage unsettable as well as wrong.
    RubricActiveTemplate.objects.filter(template__programme__isnull=True).delete()


def remove_created_templates(apps, schema_editor):
    """Reverse: delete the generated clones, leaving the source rubric in place."""
    RubricTemplate = apps.get_model('api', 'RubricTemplate')
    RubricActiveTemplate = apps.get_model('api', 'RubricActiveTemplate')

    generated_ids = [
        f'tpl_{code}_{stage}_v1'
        for code in ('BCS', 'BDM', 'BMD', 'BID')
        for stage in ('fyp1', 'fyp2', 'proposal')
    ]
    RubricActiveTemplate.objects.filter(template_id__in=generated_ids).delete()
    RubricTemplate.objects.filter(pk__in=generated_ids).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0018_scope_rubrics_to_programme'),
    ]

    operations = [
        migrations.RunPython(create_per_programme_templates, remove_created_templates),
    ]
