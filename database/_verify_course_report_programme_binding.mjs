/**
 * Functional test: does the Course Performance Report give every coordinator of
 * one programme the SAME report?
 *
 * The report is a programme report, so its three inputs must all be read through
 * the signed-in account's programme. This script replays the data flow of
 * frontend/src/pages/CoursePerformanceReport.js against the running stack, once
 * per coordinator of the programme, and compares the results field by field.
 *
 * It exists because the page used to read students from `/projects/`, which
 * `FYPProjectViewSet` scopes to the projects the signed-in lecturer supervises,
 * co-supervises or examines — not to the programme. Two coordinators of one
 * programme therefore produced two different reports for the same course, and a
 * coordinator who supervised nobody saw an empty one:
 *
 *     khairu       (BCS coordinator)  /projects/ = 5 students   report = 5 rows
 *     zahiruddin   (BCS coordinator)  /projects/ = 0 students   report = EMPTY
 *     zahir        (BCS coordinator)  /projects/ = 0 students   report = EMPTY
 *     all three                       /student-list/ = 12 students (the cohort)
 *
 * The other two bindings it checks are the marks (`list_marks.php?programme=`)
 * and the course title, which is read from the rubric that programme has set
 * active for the stage rather than hard-coded to the CSS papers.
 *
 * Needs the whole stack running: Django on :8000, PHP under http://localhost/php,
 * MySQL. Run from the project root:
 *
 *     node database/_verify_course_report_programme_binding.mjs
 *
 * Exit code 0 means every coordinator of the programme got an identical report.
 */

const DJANGO = process.env.FYPHUB_DJANGO || 'http://127.0.0.1:8000';
const PHP = process.env.FYPHUB_PHP || 'http://localhost/php';

// The coordinators of one programme, as seeded in fyp_hub_db (BCS holds three,
// which is what makes it the useful programme to test). Passwords are the same
// local development ones the rest of the tooling assumes.
const PROGRAMME_COORDINATORS = [
  { username: 'khairu', password: 'wow12345' },
  { username: 'zahiruddin', password: 'wow12345' },
  { username: 'zahir', password: 'password5' },
];

const STAGE_ORDER = ['FYP1', 'FYP2', 'PROPOSAL'];
const GRADE_ORDER = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'];

// --- the four helpers below are copied from CoursePerformanceReport.js -------

function normalizeFypStage(value = '') {
  const compact = String(value).toUpperCase().replace(/\s+/g, '').replace(/PROJECT/g, 'FYP');
  if (compact.includes('FYP1') || compact === '1') return 'FYP1';
  if (compact.includes('FYP2') || compact === '2') return 'FYP2';
  return compact;
}

function displayFypStage(value = '') {
  const normalized = normalizeFypStage(value);
  if (normalized === 'FYP1') return 'FYP 1';
  if (normalized === 'FYP2') return 'FYP 2';
  return value || 'N/A';
}

function gradeFromMarks(mark) {
  const score = Number(mark) || 0;
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 75) return 'A-';
  if (score >= 70) return 'B+';
  if (score >= 65) return 'B';
  if (score >= 60) return 'B-';
  if (score >= 55) return 'C+';
  if (score >= 50) return 'C';
  if (score >= 45) return 'C-';
  if (score >= 40) return 'D';
  return 'F';
}

function getSectionTotalsFromMark(mark) {
  if (mark?.section_totals && Object.keys(mark.section_totals).length > 0) return mark.section_totals;
  return mark?.marks_data?.section_totals || {};
}

// ---------------------------------------------------------------------------

async function json(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function login({ username, password }) {
  const res = await fetch(`${DJANGO}/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`sign-in failed for ${username} (HTTP ${res.status})`);
  return (await res.json()).access;
}

async function buildReport(credentials) {
  const { username } = credentials;
  const auth = { Authorization: `Bearer ${await login(credentials)}` };

  // 1. Which programme this account administers.
  const me = await json(`${DJANGO}/user/me/`, auth);
  const programmeCode = String(me.programme_code || '').trim();

  // 2. The cohort. `/student-list/` is programme-scoped; `/projects/` is not.
  const cohort = await json(`${DJANGO}/student-list/`, auth);

  // 3. The programme's marks.
  const marksParams = new URLSearchParams();
  if (programmeCode) marksParams.set('programme', programmeCode);
  const marksRes = await json(`${PHP}/list_marks.php?${marksParams}`, auth);
  const marks = marksRes.success ? marksRes.marks || [] : [];

  // 4. The stage tabs, and the course the programme marks for each of them.
  const stages = STAGE_ORDER.filter((stage) => cohort.some(
    (project) => normalizeFypStage(project.fyp_stage) === stage
  ));
  const courseByStage = {};
  for (const stage of stages) {
    const params = new URLSearchParams({ fyp_stage: stage });
    if (programmeCode) params.set('programme', programmeCode);
    const res = await json(`${PHP}/get_active_template.php?${params}`, auth);
    const course = String(res?.template?.data?.course || '').trim();
    if (course) courseByStage[stage] = course;
  }

  // 5. The rows, exactly as the page builds them.
  const perStage = {};
  for (const selectedStage of stages) {
    const courseForStage = courseByStage[selectedStage] || '';
    const isProgrammeCourse = (candidate) => !courseForStage || !candidate.course
      || String(candidate.course).trim() === courseForStage;

    const latestMarksByStudent = new Map();
    marks
      .filter((mark) => normalizeFypStage(mark.fyp_stage) === selectedStage)
      .forEach((mark) => {
        const studentId = String(mark.student_id || '').trim();
        if (!studentId) return;

        const existing = latestMarksByStudent.get(studentId);
        if (!existing) { latestMarksByStudent.set(studentId, mark); return; }

        const candidatePreferred = isProgrammeCourse(mark);
        if (candidatePreferred !== isProgrammeCourse(existing)) {
          if (candidatePreferred) latestMarksByStudent.set(studentId, mark);
          return;
        }

        const existingDate = new Date(existing.updated_at || existing.evaluated_at || 0).getTime();
        const nextDate = new Date(mark.updated_at || mark.evaluated_at || 0).getTime();
        if (nextDate >= existingDate) latestMarksByStudent.set(studentId, mark);
      });

    perStage[selectedStage] = cohort
      .filter((project) => normalizeFypStage(project.fyp_stage) === selectedStage)
      .sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''))
      .map((project, index) => {
        const studentId = String(project.student_matric_id || project.student || '').trim();
        const mark = latestMarksByStudent.get(studentId);
        const totalScore = mark ? Number(mark.total_score || 0) : null;
        return {
          no: index + 1,
          studentId: project.student_matric_id || 'N/A',
          studentName: project.student_name || mark?.student_name || 'N/A',
          fypStage: displayFypStage(project.fyp_stage || mark?.fyp_stage),
          course: courseForStage || mark?.course || '',
          sectionTotals: mark ? getSectionTotalsFromMark(mark) : {},
          totalScore: totalScore === null ? null : Number(totalScore.toFixed(2)),
          grade: mark ? gradeFromMarks(totalScore) : '',
          overallStatus: mark ? (totalScore >= 40 ? 'Pass' : 'Fail') : 'I',
        };
      });
  }

  const programmeOwnProjects = await json(`${DJANGO}/projects/`, auth);

  return {
    who: `${username} (${me.full_name || '—'})`,
    programmeCode,
    courseByStage,
    stages,
    perStage,
    gradeDistribution: Object.fromEntries(stages.map((stage) => [stage,
      GRADE_ORDER.map((grade) => ({ grade, count: perStage[stage].filter((r) => r.grade === grade).length }))
        .filter((entry) => entry.count > 0)
    ])),
    // What the old binding would have produced, kept as evidence of the bug.
    ownProjectCount: Array.isArray(programmeOwnProjects) ? programmeOwnProjects.length : 0,
  };
}

const reports = [];
for (const credentials of PROGRAMME_COORDINATORS) {
  reports.push(await buildReport(credentials));
}

const programme = reports[0]?.programmeCode;
console.log(`Programme under test: ${programme || '(none resolved)'}\n`);

for (const report of reports) {
  console.log(`${report.who}  programme=${report.programmeCode}`);
  console.log(`  course per stage : ${JSON.stringify(report.courseByStage)}`);
  console.log(`  old binding would have shown ${report.ownProjectCount} student(s) from /projects/`);
  for (const stage of report.stages) {
    const rows = report.perStage[stage];
    const graded = rows.filter((row) => row.totalScore !== null).length;
    console.log(`  ${stage}: students=${rows.length} graded=${graded}`
      + ` pass=${rows.filter((r) => r.overallStatus === 'Pass').length}`
      + ` fail=${rows.filter((r) => r.overallStatus === 'Fail').length}`);
    console.log(`    ${rows.map((row) => `${row.studentId}=${row.totalScore === null ? '-' : row.totalScore}${row.grade ? `(${row.grade})` : ''}`).join(' ')}`);
  }
  console.log('');
}

// Everything except the account's own identity must match across coordinators.
const canonical = (report) => JSON.stringify({
  courseByStage: report.courseByStage,
  stages: report.stages,
  perStage: report.perStage,
  gradeDistribution: report.gradeDistribution,
});

const expected = canonical(reports[0]);
const failures = [];

for (const report of reports) {
  for (const other of reports) {
    if (canonical(report) !== canonical(other)) {
      failures.push(`${report.who} differs from ${other.who}`);
    }
  }
}

if (new Set(reports.map((r) => r.programmeCode)).size > 1) {
  failures.push('the coordinators under test are not all in the same programme');
}
if (!reports[0]?.stages.length) {
  failures.push('no FYP stage resolved for the programme — nothing was compared');
}

console.log('=== result ===');
if (failures.length) {
  for (const failure of [...new Set(failures)]) console.log(`FAIL: ${failure}`);
  console.log('\nFAIL — the report is still bound to something other than the programme.');
  process.exit(1);
}
console.log(`PASS — all ${reports.length} coordinators of ${programme} produce an identical report`);
console.log(`(${expected.length} bytes of compared report data per coordinator).`);
