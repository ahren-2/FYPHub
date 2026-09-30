// --- src/components/pageGuide.js ---------------------------------------------
// Plain-English help content, kept in one file so it is easy to keep accurate.
// Everything here is advisory only: no logic depends on it.
//
// - PAGE_GUIDE  : what the current screen is for, and how to use it
// - ROLE_GUIDE  : the end-to-end journey for each role
// - GLOSSARY    : the acronyms and terms used across FYPHub

export const PAGE_GUIDE = {
  '/dashboard': {
    title: 'Dashboard',
    what: 'Your starting point. It shows the state of your FYP work and the one or two things that need your attention now.',
    steps: [
      'Read the cards from left to right — each one is a different part of your FYP.',
      'Anything marked Pending or Needs Revision is waiting on someone (or on you).',
      'Use the left-hand menu to go to the full page behind any card.',
    ],
  },
  '/announcements': {
    title: 'Announcements',
    what: 'Notices posted by the FYP coordinator for students and lecturers.',
    steps: [
      'Newest announcements appear first.',
      'Announcements can include deadlines, briefing dates and submission rules.',
    ],
  },
  '/submit-trf': {
    title: 'Title Registration Form (TRF)',
    what: 'The official form that registers your FYP title, supervisor and project description.',
    steps: [
      'Fill in Sections 1–3. Fields marked * are required.',
      'Pick a supervisor from the list — only lecturers with free slots appear.',
      'For Section 3, write short bullet points; each box should stay on one printed page.',
      'Submit, then wait for your supervisor to approve it or ask for changes.',
      'You can edit and re-submit while the TRF is still Pending or Needs Revision.',
    ],
    tip: 'Your supervisor can only see the TRF after you submit it — saving is not possible, so finish the form in one go.',
  },
  '/feedback': {
    title: 'Feedback History',
    what: 'Every comment your supervisor has left on your Title Registration Form.',
    steps: [
      'Newest comments appear first; unread ones are highlighted on your dashboard.',
      'If a comment mentions changes, update your TRF from the Submit TRF page.',
    ],
  },
  '/my-schedule': {
    title: 'My Presentation Schedule',
    what: 'The presentation slot booked for your project.',
    steps: [
      'Your date, time and venue are fixed by your supervisor during the booking window.',
      'Download the schedule if you need a copy for your records.',
    ],
  },
  '/trf-review': {
    title: 'My Students’ Submissions',
    what: 'The Title Registration Forms sent to you by the students you supervise.',
    steps: [
      'Filter by status, or search by student name or project title.',
      'Open a Pending form to read it and record your decision.',
      'Approve to register the title, or send it back with comments for revision.',
    ],
  },
  '/all-submissions': {
    title: 'All TRF Submissions',
    what: 'A read-only overview of every TRF in your programme.',
    steps: [
      'Use this to check who has submitted and who is still outstanding.',
      'Statuses update as supervisors approve or return each form.',
    ],
  },
  '/give-feedback': {
    title: 'Review a TRF',
    what: 'Read a student’s Title Registration Form and record your decision.',
    steps: [
      'Read Sections 1 and 2 to check the student’s details and project description.',
      'Write a comment — be specific about what is missing or unclear.',
      'If you are the assigned supervisor, choose Approve or Needs Revision.',
      'Submit. The student sees your comment and the new status immediately.',
    ],
  },
  '/assessment': {
    title: 'Assessment',
    what: 'Open the marking rubric for each student you supervise.',
    steps: [
      'Filter by FYP stage to see the students at that stage.',
      'Press Grade to open the active rubric template for their stage.',
      'If the button reports no active rubric, ask the coordinator to set one.',
    ],
  },
  '/assessment-grade': {
    title: 'Grading screen',
    what: 'Enter marks criterion by criterion; the rubric adds them up for you.',
    steps: [
      'Type a mark from 0–100 in the S column (supervisor). Enter M too if the section is double-marked.',
      'The weight of each criterion is applied automatically — you do not calculate anything.',
      'The totals bar at the top updates as you type.',
      'Save Draft if you need to come back later, or Submit Marks when you are finished.',
    ],
    tip: 'A criterion is counted as attained at 40% or above; that threshold drives the CO attainment figures in the course report.',
  },
  '/milestones': {
    title: 'Milestone Verification',
    what: 'Track and verify each student’s weekly FYP milestones.',
    steps: [
      'Open a student from the list to see their eight milestones.',
      'Enter a score out of the maximum shown, then press Approve to verify that milestone.',
      'Save All Progress when you are done — the student’s progress bar updates.',
      'Use Create New Form when a student is missing from the list.',
    ],
  },
  '/my-availability': {
    title: 'Presentation Booking',
    what: 'Book an empty slot for one of your students’ final presentations.',
    steps: [
      'Pick a date, then click any green Available cell.',
      'Choose the student/project; the examiner is filled in from the project record.',
      'Confirm. The cell turns blue and shows your student’s name.',
      'Cells booked by another lecturer cannot be taken — the tooltip shows who holds them.',
    ],
  },
  '/present-schedule': {
    title: 'Presentation Schedule',
    what: 'The full presentation timetable for the course.',
    steps: [
      'Your role column shows whether you are supervising or examining each slot.',
      'Export to Excel to keep a copy or share it with your students.',
    ],
  },
  '/manage-announcements': {
    title: 'Manage Announcements',
    what: 'Publish notices that every student and lecturer can read.',
    steps: [
      'Write a clear title and the message body, then publish.',
      'Published announcements appear immediately on the Announcements page.',
      'Use Edit or Delete on the right to correct a notice you already posted.',
    ],
  },
  '/student-list': {
    title: 'Student List',
    what: 'Every registered FYP student with their supervisor, examiner and stage.',
    steps: [
      'Filter by FYP stage to narrow the table.',
      'A title of “Pending TRF Submission” means the student has not submitted a TRF yet.',
    ],
  },
  '/project-overview': {
    title: 'Project Overview',
    what: 'A count of where every project currently stands.',
    steps: [
      'Submitted = TRF received. Pending = waiting for a supervisor decision.',
      'Approved = title registered. Needs Revision = returned to the student.',
    ],
  },
  '/supervisor-quota': {
    title: 'Supervisor Quota',
    what: 'How many students each lecturer may supervise.',
    steps: [
      'Total Quota is the maximum; Assigned is how many are taken.',
      'Available Slots is what students can still choose — a lecturer with 0 disappears from the TRF supervisor list.',
      'Use Edit & View to change one lecturer’s quota and see their students.',
      'Bulk Edit applies the same quota to every supervisor.',
    ],
  },
  '/timetable-scheduling': {
    title: 'Timetable Scheduling',
    what: 'Set up the presentation days and venues, then let the scheduler fill them.',
    steps: [
      'Step 1: add every presentation date and venue you will use.',
      'Step 2: run the auto-scheduler to fill the empty slots, then notify staff by email.',
      'The master schedule at the bottom shows the result.',
      'Clear Full Schedule removes all bookings for your course — use it only to start again.',
    ],
  },
  '/rubrics': {
    title: 'Marking Rubrics',
    what: 'The marking templates lecturers use, and which one is active for each FYP stage.',
    steps: [
      'The Active badge marks the template currently in use for that stage.',
      'Set as Active Rubric switches a stage to a different template.',
      'Edit Template opens the rubrics editor; Rename and Delete are in the ⋮ menu.',
    ],
  },
  '/rubrics-editor': {
    title: 'Rubrics Editor',
    what: 'Build or change a marking template: sections, criteria, weights and CLO mapping.',
    steps: [
      'Coloured fields are editable — click, type, and save.',
      'Each section lists its own percentage; keep the section weights adding up to the section marks.',
      'Choose the evaluator columns: Supervisor only, or Supervisor + Moderator.',
      'Save Rubrics when finished; set it active from the Marking Rubrics page.',
    ],
  },
  '/course-report': {
    title: 'Course Performance Report',
    what: 'The course-level marks, grade distribution and CO attainment summary.',
    steps: [
      'Switch between FYP 1 and FYP 2 at the top.',
      'Students with no marks show “Not graded yet” and are excluded from the pass/fail counts.',
      'CO attainment is the share of marked students who reached 40% or more for that outcome.',
      'Download CSV or XLSX to submit the report.',
    ],
  },
  '/users': {
    title: 'User Management',
    what: 'Create accounts in bulk and manage roles.',
    steps: [
      'Upload information creates student accounts from an Excel (.xlsx) file.',
      'Filter by role, then use View for details or Delete to remove an account.',
      'Transferring coordinator access to another lecturer also demotes you — this cannot be undone.',
    ],
  },
  '/archive': {
    title: 'Document Archive',
    what: 'Archived FYP documents for previous sessions.',
    steps: ['This section is not in use yet in this build.'],
  },
};

export const ROLE_GUIDE = {
  student: {
    label: 'Student journey',
    steps: [
      'Submit your TRF with your proposed title and supervisor.',
      'Wait for your supervisor’s decision; update the form if they ask for changes.',
      'Work through your milestones and check the feedback they leave for you.',
      'Once the schedule is published, check My Schedule for your presentation slot.',
    ],
  },
  lecturer: {
    label: 'Supervisor journey',
    steps: [
      'Review the Title Registration Forms sent to you, then approve or return each one.',
      'Track your students’ milestone progress and verify each milestone as it is completed.',
      'Grade your students in Assessment using the active rubric for their FYP stage.',
      'Book presentation slots in My Availability, then check Present Schedule for your duties.',
    ],
  },
  coordinator: {
    label: 'Coordinator journey',
    steps: [
      'Publish announcements and keep the student list and supervisor quotas up to date.',
      'Monitor TRF submission and approval progress from Project Overview.',
      'Keep one active marking rubric for each FYP stage, and edit templates when criteria change.',
      'Set up presentation dates and venues, run the scheduler, then notify staff.',
      'Use the Course Report for grade distribution and CO attainment.',
    ],
  },
};

export const GLOSSARY = [
  { term: 'TRF', meaning: 'Title Registration Form — registers the FYP title, supervisor and project description.' },
  { term: 'FYP 1 / FYP 2', meaning: 'The two stages of the Final Year Project. Some courses also have a Proposal stage.' },
  { term: 'Supervisor', meaning: 'The lecturer who guides the project and approves the TRF.' },
  { term: 'Examiner', meaning: 'The second lecturer who examines the final presentation; fixed on the project record.' },
  { term: 'Milestone', meaning: 'One of the weekly checkpoints used to track project progress.' },
  { term: 'Rubric', meaning: 'The marking template: sections, criteria, performance levels and weights.' },
  { term: 'Section weight', meaning: 'How much a criterion contributes to the section total, applied automatically.' },
  { term: 'S / M marks', meaning: 'S = supervisor mark, M = moderator mark. M only appears on double-marked sections.' },
  { term: 'CLO', meaning: 'Course Learning Outcome — what the course as a whole must achieve.' },
  { term: 'CO', meaning: 'Course Outcome. A CO is counted as attained when a student reaches 40% or more.' },
  { term: 'Quota', meaning: 'The maximum number of students a lecturer may supervise.' },
  { term: 'Pass mark', meaning: '40 marks out of 100. Below that the attempt is recorded as Fail.' },
];
