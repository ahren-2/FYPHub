// --- src/components/HelpCenter.js --------------------------------------------
// A slide-over panel that explains the current screen, the role's whole journey,
// and the jargon used across the portal. Opened from the "Guide" button in the
// top bar, so the help is always one click away and never in the way.
import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PAGE_GUIDE, ROLE_GUIDE, GLOSSARY } from './pageGuide';

export const NAV_LINKS = {
  student: [
    { name: 'Dashboard', path: '/dashboard', hint: 'Your FYP at a glance' },
    { name: 'Announcements', path: '/announcements', hint: 'Notices from the coordinator' },
    { name: 'Submit TRF', path: '/submit-trf', hint: 'Register your project title' },
    { name: 'Feedback', path: '/feedback', hint: 'Comments from your supervisor' },
    { name: 'My Schedule', path: '/my-schedule', hint: 'Your presentation slot' },
    { name: 'My Profile', path: '/profile', hint: 'Your account details' },
  ],
  lecturer: [
    { name: 'Dashboard', path: '/dashboard', hint: 'Your students and duties' },
    { name: 'Announcements', path: '/announcements', hint: 'Notices from the coordinator' },
    { name: 'My Students', path: '/trf-review', hint: 'TRFs sent to you' },
    { name: 'All Submissions', path: '/all-submissions', hint: 'Every TRF in the programme' },
    { name: 'Assessment', path: '/assessment', hint: 'Mark your students' },
    { name: 'Milestones', path: '/milestones', hint: 'Verify weekly progress' },
    { name: 'My Availability', path: '/my-availability', hint: 'Book presentation slots' },
    { name: 'Present Schedule', path: '/present-schedule', hint: 'Full timetable' },
    { name: 'My Profile', path: '/profile', hint: 'Your account details' },
  ],
  coordinator: [
    { name: 'Dashboard', path: '/dashboard', hint: 'Course status at a glance' },
    { name: 'Manage Announcements', path: '/manage-announcements', hint: 'Publish notices' },
    { name: 'Student List', path: '/student-list', hint: 'Every registered student' },
    { name: 'Project Overview', path: '/project-overview', hint: 'Submission counts' },
    { name: 'Supervisor Quota', path: '/supervisor-quota', hint: 'Supervision limits' },
    { name: 'Timetable Scheduling', path: '/timetable-scheduling', hint: 'Dates, venues, scheduler' },
    { name: 'Marking Rubrics', path: '/rubrics', hint: 'Active marking templates' },
    { name: 'Course Report', path: '/course-report', hint: 'Grades and CO attainment' },
    { name: 'User Management', path: '/users', hint: 'Accounts and roles' },
    { name: 'My Profile', path: '/profile', hint: 'Your account, and deleting it' },
  ],
  // One destination: the administrator maintains accounts and nothing else yet.
  // This list is what the sidebar is built from, so leaving it out would give the
  // role an empty menu.
  admin: [
    { name: 'User Management', path: '/users', hint: 'Every account, in every programme' },
  ],
};

// The longest matching guide entry wins, so '/all-submissions' is not confused
// with a shorter prefix, and '/give-feedback/12' still finds '/give-feedback'.
function findGuide(pathname) {
  const entries = Object.keys(PAGE_GUIDE).sort((a, b) => b.length - a.length);
  const match = entries.find((route) => pathname === route || pathname.startsWith(`${route}/`));
  return match ? PAGE_GUIDE[match] : null;
}

function HelpCenter({ isOpen, onClose, viewMode = 'student' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const guide = findGuide(location.pathname);
  const roleGuide = ROLE_GUIDE[viewMode] || ROLE_GUIDE.student;
  const links = NAV_LINKS[viewMode] || [];

  // Close on Escape so the panel never traps the user.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const goTo = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      <div className="ui-help-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="ui-help-panel" role="dialog" aria-modal="true" aria-label="Help and guide">
        <div className="ui-help-head">
          <div>
            <h2>Guide &amp; help</h2>
            <p>How this screen works, and what the words mean.</p>
          </div>
          <button type="button" className="ui-help-close" onClick={onClose} aria-label="Close help">✕</button>
        </div>

        <div className="ui-help-body">
          {guide && (
            <section className="ui-help-section">
              <h3>Where you are — {guide.title}</h3>
              <p className="ui-sub">{guide.what}</p>
              {guide.steps?.length > 0 && (
                <ol className="ui-help-steps" style={{ marginTop: '14px' }}>
                  {guide.steps.map((step) => <li key={step}>{step}</li>)}
                </ol>
              )}
              {guide.tip && (
                <p className="ui-hint" style={{ marginTop: '12px' }}>
                  <strong>Good to know: </strong>{guide.tip}
                </p>
              )}
            </section>
          )}

          <section className="ui-help-section">
            <h3>{roleGuide.label}</h3>
            <ol className="ui-help-steps">
              {roleGuide.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </section>

          <section className="ui-help-section">
            <h3>Go to</h3>
            <div className="ui-help-links">
              {links.map((link) => (
                <button
                  type="button"
                  key={link.path}
                  className="ui-help-link"
                  onClick={() => goTo(link.path)}
                >
                  <span>
                    <strong>{link.name}</strong>
                    <small>{link.hint}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="ui-help-section">
            <h3>Words used in FYPHub</h3>
            <dl className="ui-help-glossary">
              {GLOSSARY.map((entry) => (
                <React.Fragment key={entry.term}>
                  <dt>{entry.term}</dt>
                  <dd>{entry.meaning}</dd>
                </React.Fragment>
              ))}
            </dl>
          </section>
        </div>
      </aside>
    </>
  );
}

export default HelpCenter;
