"""Read-only audit of programme data. Changes nothing.

Run with:
    python backend/manage.py shell -c "exec(open('database/_programme_audit.py', encoding='utf-8').read())"
"""

from collections import Counter, defaultdict

from django.contrib.auth.models import User

from api.models import FYPProject, Profile, Programme

LINE = "-" * 78


def label(programme):
    return f"{programme.code} (id {programme.id})" if programme else "NOT SET"


print(LINE)
print("1. PROGRAMME ROWS")
print(LINE)
account_counts = Counter(Profile.objects.values_list('programme_id', flat=True))
project_counts = Counter(FYPProject.objects.values_list('programme_id', flat=True))
for programme in Programme.objects.order_by('id'):
    print(
        f"  id {programme.id:<3} {label(programme):<14} "
        f"accounts: {account_counts.get(programme.id, 0):<4} "
        f"projects: {project_counts.get(programme.id, 0)}"
    )

print()
print(LINE)
print("2. ACCOUNTS WITH NO PROGRAMME  (invisible to every programme-wide list)")
print(LINE)
orphans = Profile.objects.filter(programme__isnull=True).select_related('user')
if not orphans:
    print("  none")
for profile in orphans:
    print(f"  {profile.user.username:<20} role: {profile.role}")

print()
print(LINE)
print("3. STUDENT PROFILE vs PROJECT PROGRAMME")
print(LINE)
mismatches = []
for project in FYPProject.objects.select_related('student__profile', 'programme').order_by(
    'student__username'
):
    profile = getattr(project.student, 'profile', None)
    if profile is None:
        continue
    if profile.programme_id != project.programme_id:
        mismatches.append((project.student.username, profile, project))

if not mismatches:
    print("  none")
for username, profile, project in mismatches:
    print(
        f"  {username:<20} profile: {label(profile.programme):<14} "
        f"project: {label(project.programme)}"
    )
print(f"\n  total mismatched students: {len(mismatches)}")

print()
print(LINE)
print("4. SUGGESTED REASSIGNMENT (the project row is the reliable copy)")
print(LINE)
print("  A project row is only ever written with the programme of the account at")
print("  creation and is otherwise untouched, whereas Profile.programme is")
print("  rewritten by every spreadsheet upload. So where the two disagree, the")
print("  project row is treated as the account's real programme.")
print()
proposed = defaultdict(list)
for username, profile, project in mismatches:
    proposed[project.programme].append((username, profile.programme))

for programme in sorted(proposed, key=lambda p: p.code if p else ''):
    people = proposed[programme]
    print(f"  Move {len(people)} account(s) to {label(programme)}:")
    for username, current in people:
        print(f"      {username:<20} (currently {label(current)})")

general = Programme.objects.filter(code__iexact='General').first()
if general:
    # Keyed on (username, current programme) rather than the username alone, so a
    # same-named account in another programme can never be counted as moving out
    # of General.
    moving = {(username, profile.programme_id) for username, profile, _ in mismatches}
    remaining = [
        profile
        for profile in Profile.objects.filter(programme=general)
        .select_related('user')
        .order_by('user__username')
        if (profile.user.username, profile.programme_id) not in moving
    ]
    general_total = Profile.objects.filter(programme=general).count()
    leaving = general_total - len(remaining)
    print()
    print(f"  Programme 'General' (id {general.id}) holds {general_total} account(s); "
          f"{leaving} of them move above, leaving {len(remaining)}:")
    print("  These have no project row to infer a programme from, so they need a")
    print("  human decision - group them by what they actually teach or run.")
    print()
    for profile in remaining:
        print(f"      {profile.user.username:<16} role: {profile.role}")

# What each programme's student list looks like once the moves above are applied,
# so the effect of the repair is visible before anyone commits to it.
print()
print("  Current student totals per programme (NOT the post-move figures; this is")
print("  today's state, shown so the gap between the two columns is visible):")
for programme in Programme.objects.order_by('code'):
    in_profile = Profile.objects.filter(programme=programme, role='student').count()
    in_project = FYPProject.objects.filter(programme=programme).count()
    print(f"      {programme.code:<9} students by profile: {in_profile:<3} by project: {in_project}")

for junk in Programme.objects.filter(code__iexact='None'):
    used = Profile.objects.filter(programme=junk).count() + FYPProject.objects.filter(
        programme=junk
    ).count()
    print(f"\n  Programme id {junk.id} (name/code 'None') is referenced {used} time(s) "
          f"and is unused junk -> safe to delete.")

print()
print(LINE)
print("5. COORDINATORS AND WHAT THEY CAN SEE")
print(LINE)
print("  A coordinator's student list is filtered by their own programme, so a")
print("  coordinator with no programme sees nothing at all.")
print()
for profile in Profile.objects.filter(role='coordinator').select_related(
    'user', 'programme'
).order_by('user__username'):
    if profile.programme is None:
        see = "NOTHING (no programme assigned)"
    else:
        own = FYPProject.objects.filter(programme=profile.programme).count()
        by_profile = FYPProject.objects.filter(
            student__profile__programme=profile.programme
        ).count()
        see = f"{own} project(s) by project programme, {by_profile} by student profile"
    print(f"  {profile.user.username:<16} {label(profile.programme):<14} -> {see}")
print(LINE)
