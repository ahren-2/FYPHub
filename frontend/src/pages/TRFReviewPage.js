// --- src/pages/TRFReviewPage.js ---
// List of TRF submissions for lecturers ("My Students") and coordinators ("All Submissions").
// Filtering still uses the same endpoint and the same status values as before.
import React, { useState, useEffect } from 'react';
import api from '../api';
import moment from 'moment';
import { useNavigate } from 'react-router-dom';
import './TeammateLecturer.css';
import './TRF.css';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'revision', label: 'Needs Revision' },
];

const STATUS_LABELS = {
  pending: 'Pending Review',
  approved: 'Approved',
  revision: 'Needs Revision',
};

function TRFReviewPage({ isGlobal = false }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '' === All
  const [searchTerm, setSearchTerm] = useState('');
  const [quota, setQuota] = useState(null);
  const navigate = useNavigate();

  // A lecturer sees how much of their supervision allocation is used, shown at
  // the top right of the card. The endpoint is per-account, so it is only
  // meaningful (and only called) for a lecturer.
  useEffect(() => {
    if (localStorage.getItem('user_role') !== 'lecturer') return undefined;

    let cancelled = false;
    const fetchQuota = async () => {
      try {
        const res = await api.get('/my-quota/');
        if (!cancelled) setQuota(res.data);
      } catch (err) {
        console.error('Failed to fetch supervision quota', err);
      }
    };
    fetchQuota();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const fetchSubmissions = async () => {
      setLoading(true);
      setErrorMessage('');
      try {
        const url = '/submissions/';
        const params = { view: isGlobal ? 'all' : 'mine' };
        const res = await api.get(url, { params });

        // A→Z by student name
        const sortedSubmissions = res.data.sort((a, b) =>
          (a.student_name || '').localeCompare(b.student_name || '')
        );

        setSubmissions(sortedSubmissions);
      } catch (err) {
        console.error('Failed to fetch submissions', err);
        setErrorMessage('We could not load the submission list. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchSubmissions();
  }, [isGlobal]);

  const countFor = (value) =>
    value === '' ? submissions.length : submissions.filter((sub) => sub.status === value).length;

  const query = searchTerm.trim().toLowerCase();
  const filteredSubmissions = submissions.filter((sub) => {
    if (statusFilter && sub.status !== statusFilter) {
      return false;
    }
    if (!query) {
      return true;
    }
    return (
      (sub.student_name || '').toLowerCase().includes(query) ||
      (sub.proposed_project_title || '').toLowerCase().includes(query)
    );
  });

  const columnCount = isGlobal ? 6 : 5;
  const hasAnySubmission = submissions.length > 0;

  return (
    <div className="main-content trf-page">
      <header className="trf-page-header">
        <div>
          <h1>{isGlobal ? 'All TRF Submissions' : "My Students' Submissions"}</h1>
          <p>
            {isGlobal
              ? 'Every Title Registration Form submitted within your programme. Open one to review it.'
              : 'Title Registration Forms submitted by the students you supervise. Open one to review, comment and decide.'}
          </p>
        </div>
        <div className="trf-page-header-side">
          <span className="trf-chip">
            {submissions.length} submission{submissions.length === 1 ? '' : 's'}
          </span>
        </div>
      </header>

      {errorMessage && (
        <div className="trf-banner is-error" role="alert">
          <div>
            <strong>Something went wrong</strong>
            {errorMessage}
          </div>
        </div>
      )}

      <section className="trf-card">
        <div className="trf-toolbar">
          <div className="trf-toolbar-group">
            <span className="trf-toolbar-label">Status</span>
            <div className="trf-segmented" role="group" aria-label="Filter by TRF status">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.value || 'all'}
                  type="button"
                  className={`trf-seg ${statusFilter === filter.value ? 'is-active' : ''}`}
                  aria-pressed={statusFilter === filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                >
                  {filter.label}
                  <span className="trf-seg-count">{countFor(filter.value)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="trf-toolbar-trailing">
            {quota && (
              <span
                className="trf-quota-chip"
                title="Students assigned to you, out of the supervision quota set by the coordinator"
              >
                Supervision quota
                <strong>{quota.assigned_count}/{quota.quota_total}</strong>
              </span>
            )}

            <div className="trf-search">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <line x1="16.5" y1="16.5" x2="21" y2="21" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search student or title…"
                aria-label="Search submissions by student name or project title"
              />
            </div>
          </div>
        </div>

        <div className="trf-table-wrap">
          <table className="trf-table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Project Title</th>
                {isGlobal && <th>Supervisor</th>}
                <th>Date Submitted</th>
                <th>TRF Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columnCount}>
                    <div className="trf-loading">
                      <span className="trf-spinner" aria-hidden="true" />
                      Loading submissions…
                    </div>
                  </td>
                </tr>
              ) : filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={columnCount}>
                    <div className="trf-empty">
                      <strong>{hasAnySubmission ? 'No matching submissions' : 'No submissions yet'}</strong>
                      {hasAnySubmission
                        ? 'Try a different status filter or clear your search.'
                        : isGlobal
                        ? 'No student in your programme has submitted a TRF so far.'
                        : 'None of your students have submitted a TRF yet.'}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => {
                  const status = sub.status || 'pending';
                  const isPending = status === 'pending';
                  return (
                    <tr key={sub.id}>
                      <td className="trf-col-name">{sub.student_name || 'N/A'}</td>
                      <td className="trf-col-title" title={sub.proposed_project_title || ''}>
                        {sub.proposed_project_title || 'N/A'}
                      </td>
                      {isGlobal && <td>{sub.supervisor_name || '—'}</td>}
                      <td className="trf-col-date">
                        {sub.created_at ? moment(sub.created_at).format('DD MMM YYYY') : '—'}
                      </td>
                      <td>
                        <span className={`trf-chip trf-status-chip is-${status}`}>
                          {STATUS_LABELS[status] || status}
                        </span>
                      </td>
                      <td className="is-action">
                        <button
                          type="button"
                          className={`trf-btn trf-btn-sm ${isPending ? 'trf-btn-primary' : 'trf-btn-ghost'}`}
                          onClick={() => navigate(`/give-feedback/${sub.id}`)}
                        >
                          {isPending ? 'Review' : 'View Details'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default TRFReviewPage;
