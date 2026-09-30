// src/layouts/MainLayout.js
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './MainLayout.css';
import HelpCenter, { NAV_LINKS } from '../components/HelpCenter';
import {
  FiGrid, FiFileText, FiMessageSquare, FiVolume2, FiLogOut, FiClock, FiUsers,
  FiArchive, FiCheckCircle, FiRepeat, FiSettings, FiEdit3, FiBarChart2, FiHelpCircle
} from 'react-icons/fi';

// An icon per destination. The list of destinations itself lives in
// components/HelpCenter.js so the sidebar and the guide can never drift apart.
const ICONS = {
  '/dashboard': <FiGrid />,
  '/announcements': <FiVolume2 />,
  '/submit-trf': <FiFileText />,
  '/feedback': <FiMessageSquare />,
  '/my-schedule': <FiClock />,
  '/manage-announcements': <FiVolume2 />,
  '/student-list': <FiFileText />,
  '/project-overview': <FiArchive />,
  '/supervisor-quota': <FiUsers />,
  '/timetable-scheduling': <FiClock />,
  '/rubrics': <FiSettings />,
  '/course-report': <FiBarChart2 />,
  '/users': <FiUsers />,
  '/trf-review': <FiFileText />,
  '/all-submissions': <FiArchive />,
  '/assessment': <FiEdit3 />,
  '/milestones': <FiCheckCircle />,
  '/my-availability': <FiClock />,
  '/present-schedule': <FiClock />,
};

// Grouping the menu makes it obvious which links belong to which part of the
// job, instead of presenting one long list.
const NAV_SECTIONS = {
  student: [
    { title: 'Overview', paths: ['/dashboard', '/announcements'] },
    { title: 'My FYP', paths: ['/submit-trf', '/feedback', '/my-schedule'] },
  ],
  lecturer: [
    { title: 'Overview', paths: ['/dashboard', '/announcements'] },
    { title: 'My Students', paths: ['/trf-review', '/all-submissions', '/assessment', '/milestones'] },
    { title: 'Presentations', paths: ['/my-availability', '/present-schedule'] },
  ],
  coordinator: [
    { title: 'Overview', paths: ['/dashboard', '/manage-announcements', '/project-overview'] },
    { title: 'Students & Staff', paths: ['/student-list', '/supervisor-quota', '/users'] },
    { title: 'Marking & Presentations', paths: ['/rubrics', '/course-report', '/timetable-scheduling'] },
  ],
};

const ROLE_LABELS = {
  student: 'Student',
  lecturer: 'Lecturer',
  coordinator: 'Coordinator',
};

function buildSections(viewMode) {
  const available = NAV_LINKS[viewMode] || [];
  const sections = NAV_SECTIONS[viewMode] || [];

  return sections
    .map((section) => ({
      ...section,
      items: section.paths
        .map((path) => available.find((link) => link.path === path))
        .filter(Boolean)
        .map((link) => ({ ...link, icon: ICONS[link.path] })),
    }))
    .filter((section) => section.items.length > 0);
}

function MainLayout({ userRole, viewMode, setViewMode, onLogout, children }) {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const sections = buildSections(viewMode);

  const viewLabel = ROLE_LABELS[viewMode] || 'Student';
  const realRoleLabel = ROLE_LABELS[userRole] || 'Student';
  const isPreviewing = userRole !== viewMode;

  return (
    <div className="main-layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <h2>FYPHub</h2>
          <span className="sidebar-subtitle">Final Year Project portal</span>
        </div>

        <div className="nav-scroll">
          {sections.map((section) => (
            <div className="nav-section" key={section.title}>
              <p className="nav-section-title">{section.title}</p>
              <ul className="nav-links">
                {section.items.map((link) => (
                  <li key={link.path}>
                    <NavLink
                      to={link.path}
                      title={link.hint}
                      className={({ isActive }) => (isActive ? 'active' : '')}
                    >
                      {link.icon}
                      <span>{link.name}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="logout-section">
          <button onClick={onLogout} className="logout-button">
            <FiLogOut />
            <span>Logout</span>
          </button>
        </div>
      </nav>

      <div className="content-wrapper">
        <header className="content-header">
          <div className="ui-context">
            <span className={`role-chip role-chip-${viewMode}`}>{viewLabel}</span>
            <div className="ui-context-text">
              <span className="ui-context-title">
                {isPreviewing ? `Previewing the ${viewLabel} view` : `${viewLabel} workspace`}
              </span>
              <span className="ui-context-meta">
                {isPreviewing
                  ? `Signed in as ${realRoleLabel} — switch back any time with the button on the right.`
                  : `Signed in as ${realRoleLabel}`}
              </span>
            </div>
          </div>

          <div className="header-actions">
            {userRole === 'coordinator' && (
              <div className="view-switcher-top">
                {viewMode === 'coordinator' ? (
                  <button onClick={() => setViewMode('lecturer')} title="See FYPHub exactly as a lecturer sees it">
                    <FiRepeat />
                    <span>Switch to Lecturer View</span>
                  </button>
                ) : (
                  <button onClick={() => setViewMode('coordinator')} title="Return to your coordinator tools">
                    <FiRepeat />
                    <span>Switch to Coordinator View</span>
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              className="ui-help-trigger"
              onClick={() => setIsHelpOpen(true)}
              title="Explain this screen, your tasks and the words used in FYPHub"
            >
              <FiHelpCircle />
              <span className="ui-help-trigger-label">Guide</span>
            </button>
          </div>
        </header>

        <main className="content-area">
          {children}
        </main>
      </div>

      <HelpCenter
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        viewMode={viewMode}
      />
    </div>
  );
}

export default MainLayout;
