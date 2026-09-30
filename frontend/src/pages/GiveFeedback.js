// --- File: src/pages/GiveFeedback.js ---
// Lecturer view: read a submitted TRF, leave a comment, then approve it or send it
// back for revision. Same endpoints and payload as before (POST add-feedback).
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import moment from 'moment';
import api from '../api';
import './TeammateLecturer.css';
import './TRF.css';
import { Callout } from '../components';

const CATEGORY_LABELS = {
  'system-dev': 'System/Application Development',
  research: 'Research-Based',
  hybrid: 'Hybrid (Research + Development)',
};

const STATUS_LABELS = {
  pending: 'Pending Review',
  approved: 'Approved',
  revision: 'Needs Revision',
};

const DETAIL_BOXES = [
  { name: 'detail_description', label: 'Project Title & Short Description' },
  { name: 'detail_problem', label: 'Current Problem / Challenges' },
  { name: 'detail_value', label: 'Value Brought by Project' },
  { name: 'detail_scope', label: 'Scope (Target users, tools, etc.)' },
  { name: 'detail_similar_system', label: 'Similar System / Research' },
  { name: 'detail_features', label: 'Proposed Project Features' },
];

function GiveFeedback() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [comment, setComment] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [statusError, setStatusError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const [subRes, userRes] = await Promise.all([
          api.get(`/submissions/${id}/`),
          api.get('/user/me/'),
        ]);

        const submissionData = subRes.data;
        const userData = userRes.data;

        setSubmission(submissionData);
        setCurrentUser(userData);

        // only the assigned supervisor may change the TRF status
        if (submissionData && userData) {
          setIsSupervisor(submissionData.supervisor === userData.id);
        }
      } catch (err) {
        console.error('Failed to load details', err);
        setErrorMessage('We could not load this submission. Please go back and try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!comment.trim()) {
      setErrorMessage('Please write a comment before submitting your feedback.');
      return;
    }

    // a status decision must be explicit — never approve by accident
    if (isSupervisor && !newStatus) {
      setStatusError(true);
      setErrorMessage('Choose whether to approve the TRF or send it back for revision.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = { comment };
      if (isSupervisor) {
        payload.new_status = newStatus;
      }

      await api.post(`submissions/${id}/add-feedback/`, payload);
      navigate(-1);
    } catch (err) {
      console.error('Submit Feedback Error:', err.response?.data || err);
      setErrorMessage('Submitting your feedback failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="main-content trf-page">
        <div className="trf-card">
          <div className="trf-loading">
            <span className="trf-spinner" aria-hidden="true" />
            Loading submission details…
          </div>
        </div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="main-content trf-page">
        <div className="trf-card">
          <div className="trf-empty">
            <strong>Submission not found</strong>
            The TRF you are looking for is unavailable or you no longer have access to it.
            <div style={{ marginTop: '18px' }}>
              <button type="button" className="trf-btn trf-btn-ghost" onClick={() => navigate(-1)}>
                ← Back to list
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const status = submission.status || 'pending';
  const reviewerName = currentUser?.profile?.full_name || currentUser?.username || 'you';

  return (
    <div className="main-content trf-page">
      <div className="trf-back-row">
        <button type="button" className="trf-btn trf-btn-ghost trf-btn-sm" onClick={() => navigate(-1)}>
          ← Back to list
        </button>
      </div>

      <header className="trf-page-header">
        <div>
          <h1>Review Title Registration Form</h1>
          <p>
            Student: <strong>{submission.student_name || 'N/A'}</strong>
          </p>
        </div>
        <div className="trf-page-header-side">
          <span className={`trf-chip trf-status-chip is-${status}`}>{STATUS_LABELS[status] || status}</span>
          <div className="trf-chip-row">
            {submission.student_id_no && <span className="trf-chip">{submission.student_id_no}</span>}
            {submission.programme && <span className="trf-chip">{submission.programme}</span>}
            {submission.semester && <span className="trf-chip">{submission.semester}</span>}
            {submission.created_at && (
              <span className="trf-chip">Submitted {moment(submission.created_at).format('DD MMM YYYY')}</span>
            )}
          </div>
        </div>
      </header>

      {errorMessage && (
        <div className="trf-banner is-error" role="alert">
          <div>
            <strong>Please check</strong>
            {errorMessage}
          </div>
        </div>
      )}

      {!isSupervisor && (
        <div className="trf-banner is-info" role="status">
          <div>
            <strong>Read-only review</strong>
            You are not the assigned supervisor for this student, so you cannot change the TRF status. Your comment
            will still be recorded.
          </div>
        </div>
      )}

      {isSupervisor && status === 'approved' && (
        <Callout tone="warn" title="This TRF has already been approved">
          Submitting again replaces the current decision. Only send it back for revision if something in the form is
          genuinely wrong — the student will see the change immediately.
        </Callout>
      )}

      {/* ============ 1. Details of Student ============ */}
      <section className="trf-card">
        <div className="trf-section-head">
          <span className="trf-step" aria-hidden="true">1</span>
          <div>
            <h2>Details of Student</h2>
            <p>Particulars declared by the student on the TRF.</p>
          </div>
        </div>

        <dl className="trf-detail-grid">
          <div className="trf-detail">
            <dt>Student Name</dt>
            <dd className="is-strong">{submission.student_name || 'N/A'}</dd>
          </div>
          <div className="trf-detail">
            <dt>Student ID</dt>
            <dd>{submission.student_id_no || 'N/A'}</dd>
          </div>
          <div className="trf-detail">
            <dt>Phone Number</dt>
            <dd>{submission.phone_no || '—'}</dd>
          </div>
          <div className="trf-detail">
            <dt>Programme</dt>
            <dd>{submission.programme || 'N/A'}</dd>
          </div>
          <div className="trf-detail">
            <dt>Semester</dt>
            <dd>{submission.semester || 'N/A'}</dd>
          </div>
          <div className="trf-detail">
            <dt>Supervisor</dt>
            <dd>{submission.supervisor_name || 'Not assigned'}</dd>
          </div>
          <div className="trf-detail">
            <dt>Project Category</dt>
            <dd>{CATEGORY_LABELS[submission.project_category] || submission.project_category || 'N/A'}</dd>
          </div>
          <div className="trf-detail">
            <dt>Proposed Project Title</dt>
            <dd className="is-strong">{submission.proposed_project_title || 'N/A'}</dd>
          </div>
        </dl>
      </section>

      {/* ============ 2. Project Details ============ */}
      <section className="trf-card">
        <div className="trf-section-head">
          <span className="trf-step" aria-hidden="true">2</span>
          <div>
            <h2>Project Details</h2>
            <p>The six sections of the TRF, exactly as written by the student.</p>
          </div>
        </div>

        <div className="trf-grid-3">
          {DETAIL_BOXES.map((box) => {
            const value = submission[box.name];
            return (
              <div className="trf-detail-box" key={box.name}>
                <h4>{box.label}</h4>
                {value && String(value).trim() ? (
                  <p title={String(value)}>{value}</p>
                ) : (
                  <p className="is-empty">No content provided</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ============ 3. Feedback & Evaluation ============ */}
      <section className="trf-card">
        <div className="trf-section-head">
          <span className="trf-step" aria-hidden="true">3</span>
          <div>
            <h2>Your Feedback &amp; Evaluation</h2>
            <p>Your comment is visible to the student together with the TRF status.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <p className="trf-reviewing-as">
            Reviewing as <strong>{reviewerName}</strong>
          </p>

          <div className="trf-field">
            <label htmlFor="trf-comment">
              Comments <span className="trf-req">*</span>
            </label>
            <textarea
              id="trf-comment"
              className="trf-textarea"
              rows="6"
              placeholder="Provide constructive feedback here…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <p className="trf-hint">
              Be specific: mention what is unclear or missing so the student can act on it directly.
            </p>
          </div>

          {isSupervisor && (
            <fieldset className="trf-decision">
              <legend>
                Set New Status <span className="trf-req">*</span>
              </legend>
              <p className="trf-hint">Choose one option — the student is notified of your decision.</p>

              <div className="trf-decision-options">
                <label
                  className={`trf-decision-option is-approve ${newStatus === 'approved' ? 'is-checked' : ''} ${
                    statusError && !newStatus ? 'is-invalid' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="new_status"
                    value="approved"
                    checked={newStatus === 'approved'}
                    onChange={() => {
                      setNewStatus('approved');
                      setStatusError(false);
                    }}
                  />
                  <span className="trf-decision-icon" aria-hidden="true">✓</span>
                  <span className="trf-decision-text">
                    <strong>Approve</strong>
                    <small>Accept this TRF. The project title is registered as submitted.</small>
                  </span>
                </label>

                <label
                  className={`trf-decision-option is-revision ${newStatus === 'revision' ? 'is-checked' : ''} ${
                    statusError && !newStatus ? 'is-invalid' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="new_status"
                    value="revision"
                    checked={newStatus === 'revision'}
                    onChange={() => {
                      setNewStatus('revision');
                      setStatusError(false);
                    }}
                  />
                  <span className="trf-decision-icon" aria-hidden="true">✕</span>
                  <span className="trf-decision-text">
                    <strong>Needs Revision</strong>
                    <small>Send it back. The student must update the TRF using your comments.</small>
                  </span>
                </label>
              </div>

              {statusError && !newStatus && (
                <p className="trf-decision-error" role="alert">
                  Please select Approve or Needs Revision.
                </p>
              )}
            </fieldset>
          )}

          <div className="trf-form-actions">
            <p className="trf-hint">
              {isSupervisor
                ? 'Approving finalises the title; Needs Revision lets the student edit and submit again.'
                : 'Your comment will be attached to this submission.'}
            </p>
            <div className="trf-action-buttons">
              <button
                type="button"
                className="trf-btn trf-btn-ghost"
                onClick={() => navigate(-1)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button type="submit" className="trf-btn trf-btn-primary" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <span className="trf-spinner" aria-hidden="true" />
                    Submitting…
                  </>
                ) : (
                  'Submit Feedback'
                )}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

export default GiveFeedback;
