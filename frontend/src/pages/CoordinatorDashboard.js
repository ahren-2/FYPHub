// --- File: src/pages/CoordinatorDashboard.js ---
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './TeammateCoordinator.css';
import { Callout, Meter, Term } from '../components';

function CoordinatorDashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState({});
  const [announcements, setAnnouncements] = useState([]);
  const [quotas, setQuotas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const [sumRes, annRes, quoRes] = await Promise.all([
          api.get('/overview/summary/'),
          api.get('/announcements/'),
          api.get('/supervisors/quotas/')
        ]);
        setSummary(sumRes.data.summary || {});
        setAnnouncements(annRes.data.slice(0, 3)); // only the three newest notices
        setQuotas(quoRes.data.quotas.slice(0, 5)); // only the first five supervisors
      } catch (err) {
        console.error("Failed to fetch dashboard hub data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, []);

  if (loading) return <div className="main-content">Loading Hub...</div>;

  const totalStudents = Number(summary.total_students) || 0;
  const submitted = Number(summary.projects_submitted) || 0;
  const pending = Number(summary.pending_reviews) || 0;
  const approved = Number(summary.approved_projects) || 0;
  const revision = Number(summary.revision_needed) || 0;
  const submittedPercent = totalStudents > 0 ? Math.round((submitted / totalStudents) * 100) : 0;
  const approvedPercent = submitted > 0 ? Math.round((approved / submitted) * 100) : 0;
  // Which cohort these figures describe. Every count below is scoped to it, so
  // the page names it rather than leaving the reader to assume a scope.
  const programmeCode = summary.programme_code || '';

  return (
    <div className="main-content">
      <header>
        <h1>Welcome, Coordinator</h1>
        <p className="ui-page-subtitle">
          {programmeCode && (
            <>
              A view of <strong>{programmeCode}</strong>:{' '}
            </>
          )}
          <Term tip="The form students complete to register their project title and supervisor.">TRF</Term> progress,
          supervisor capacity and announcements for your programme. Each panel links to the full page behind it.
        </p>
      </header>

      {totalStudents > 0 && submitted < totalStudents && (
        <Callout tone="info" title={`${totalStudents - submitted} student${totalStudents - submitted === 1 ? '' : 's'} have not submitted a TRF yet`}>
          Remind them before the registration deadline. The Student List shows exactly who is outstanding.
          <div style={{ marginTop: '10px' }}>
            <button className="btn btn-primary" onClick={() => navigate('/student-list')}>Open Student List</button>
          </div>
        </Callout>
      )}

      <div className="coordinator-grid">
        {/* 1. Course-wide counts. Leads the grid: these are the figures a
            coordinator opens the dashboard to read. */}
        <div className="card">
          <div className="ui-section-head">
            <div>
              <h3>Overall Summary</h3>
              <span className="ui-sub">
                {programmeCode
                  ? `Every registered FYP student in ${programmeCode}.`
                  : 'Every registered FYP student in your programme.'}
              </span>
            </div>
          </div>
          <ul className="summary-list">
            <li style={{ display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span>👨‍🎓 Total Students</span>
                <strong>{totalStudents}</strong>
              </div>
            </li>
            <li style={{ display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span>📄 Submitted</span>
                <strong>{submitted}</strong>
              </div>
              <span className="ui-hint is-tight">
                {submittedPercent}% of students have sent a TRF
              </span>
            </li>
            <li style={{ display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span>🕔 Pending</span>
                <strong>{pending}</strong>
              </div>
              <span className="ui-hint is-tight">Waiting for a supervisor to approve or return</span>
            </li>
            <li style={{ display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span>✅ Approved</span>
                <strong>{approved}</strong>
              </div>
              <span className="ui-hint is-tight">
                {approvedPercent}% of submitted forms approved
              </span>
            </li>
            <li style={{ display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span>📝 Needs Revision</span>
                <strong>{revision}</strong>
              </div>
              <span className="ui-hint is-tight">Returned to the student, awaiting a corrected TRF</span>
            </li>
          </ul>
          <button className="btn btn-secondary" onClick={() => navigate('/project-overview')}>
            View full overview
          </button>
        </div>

        {/* 2. Supervisor capacity */}
        <div className="card">
          <div className="ui-section-head">
            <div>
              <h3>
                Supervisor Quota
              </h3>
              <span className="ui-sub">First five supervisors in your programme, with remaining capacity.</span>
            </div>
          </div>
          <table style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Assigned / Quota</th>
                <th>Available</th>
              </tr>
            </thead>
            <tbody>
              {quotas.map(q => {
                const total = Number(q.total_quota) || 0;
                const assigned = Number(q.assigned_count) || 0;
                const available = q.available_quota !== undefined ? Number(q.available_quota) : Math.max(total - assigned, 0);
                return (
                  <tr key={q.id}>
                    <td>{q.name}</td>
                    <td>
                      <Meter value={assigned} max={total} label={`${assigned} / ${total}`} />
                    </td>
                    <td style={{ fontWeight: 'bold', color: available === 0 ? '#dc3545' : '#198754' }}>
                      {available === 0 ? 'Full' : available}
                    </td>
                  </tr>
                );
              })}
              {quotas.length === 0 && (
                <tr><td colSpan="3">No supervisor records found.</td></tr>
              )}
            </tbody>
          </table>
          <button className="btn btn-secondary" onClick={() => navigate('/supervisor-quota')}>
            Manage quotas
          </button>
        </div>

        {/* 3. Announcement digest. Moved to the last slot so the summary reads
            first, where the counts belong. */}
        <div className="card">
          <div className="ui-section-head">
            <div>
              <h3>Announcement Board</h3>
              <span className="ui-sub">Your three most recent notices.</span>
            </div>
          </div>
          <ul className="announcement-list">
            {announcements.map(ann => (
              <li key={ann.id}>📌 {ann.title}</li>
            ))}
            {announcements.length === 0 && <li>No announcements published yet.</li>}
          </ul>
          <button className="btn btn-primary" onClick={() => navigate('/manage-announcements')}>
            + Manage All
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: '30px' }}>
        <div className="ui-section-head">
          <div>
            <h3>Course setup checklist</h3>
            <span className="ui-sub">The four things only a coordinator can do this session.</span>
          </div>
        </div>
        <div className="overview-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div className="overview-item" style={{ textAlign: 'left' }}>
            <h4>1 · Supervisor quotas</h4>
            <span className="ui-sub">Set capacity before students choose a supervisor.</span>{' '}
            <button className="ui-link-btn" onClick={() => navigate('/supervisor-quota')}>Open quotas</button>
          </div>
          <div className="overview-item" style={{ textAlign: 'left' }}>
            <h4>2 · Active rubrics</h4>
            <span className="ui-sub">Keep one active marking template per FYP stage.</span>{' '}
            <button className="ui-link-btn" onClick={() => navigate('/rubrics')}>Open rubrics</button>
          </div>
          <div className="overview-item" style={{ textAlign: 'left' }}>
            <h4>3 · Presentation slots</h4>
            <span className="ui-sub">Add dates and venues, then run the scheduler.</span>{' '}
            <button className="ui-link-btn" onClick={() => navigate('/timetable-scheduling')}>Open scheduling</button>
          </div>
          <div className="overview-item" style={{ textAlign: 'left' }}>
            <h4>4 · Course report</h4>
            <span className="ui-sub">Export grades and CO attainment at the end of the session.</span>{' '}
            <button className="ui-link-btn" onClick={() => navigate('/course-report')}>Open report</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CoordinatorDashboard;
