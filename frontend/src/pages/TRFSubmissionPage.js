// --- src/pages/TRFSubmissionPage.js ---
// Student-facing Title Registration Form (TRF).
// Layout/data contract kept identical to the previous version: same fields,
// same payload shape, same POST/PUT endpoints — only the presentation changed.
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './TeammateStudent.css';
import './TRF.css';

// --- configuration -----------------------------------------------------------

const STUDENT_FIELDS = [
  { name: 'student_name', label: 'Student Name', type: 'text', required: true },
  { name: 'student_id_no', label: 'Student ID', type: 'text', required: true },
  { name: 'phone_no', label: 'Phone Number', type: 'tel', required: false },
  { name: 'programme', label: 'Programme', type: 'text', required: true },
  { name: 'semester', label: 'Semester', type: 'text', required: true },
];

const CATEGORY_OPTIONS = [
  { value: 'system-dev', label: 'System/Application Development' },
  { value: 'research', label: 'Research-Based' },
  { value: 'hybrid', label: 'Hybrid (Research + Development)' },
];

const DETAIL_FIELDS = [
  {
    name: 'detail_description',
    label: 'Project Title & Short Description',
    placeholder: '• Your project title\n• A short summary of the project',
  },
  {
    name: 'detail_problem',
    label: 'Current Problem / Challenges',
    placeholder: '• What is the main problem being addressed?',
  },
  {
    name: 'detail_value',
    label: 'Value Brought by Project',
    placeholder: '• How does it solve the problem?',
  },
  {
    name: 'detail_scope',
    label: 'Scope (Target users, tools, etc.)',
    placeholder: '• Target users are...\n• Tools / technologies used...',
  },
  {
    name: 'detail_similar_system',
    label: 'Similar System / Research',
    placeholder: '• Existing system A does...',
  },
  {
    name: 'detail_features',
    label: 'Proposed Project Features',
    placeholder: '• Feature 1: User login...',
  },
];

const STATUS_NOTICE = {
  pending: {
    tone: 'is-info',
    title: 'Submitted — awaiting supervisor review',
    body: 'You can still update the details below. Your supervisor will review the TRF and let you know the outcome.',
  },
  approved: {
    tone: 'is-success',
    title: 'Your TRF has been approved',
    body: 'Your supervisor accepted this Title Registration Form. Any further change you save here updates the record.',
  },
  revision: {
    tone: 'is-warning',
    title: 'Your supervisor requested revisions',
    body: 'Please update the details below according to your supervisor’s comments, then submit the form again.',
  },
};

function TRFSubmissionPage() {
  const navigate = useNavigate();
  const [lecturers, setLecturers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState({
    student_name: '',
    student_id_no: '',
    phone_no: '',
    programme: '',
    semester: '',
    project_category: 'system-dev',
    proposed_project_title: '',
    supervisor_id: '',
    co_supervisor_id: '',
    // Section 3 — the six boxes
    detail_description: '',
    detail_problem: '',
    detail_value: '',
    detail_scope: '',
    detail_similar_system: '',
    detail_features: '',
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Parallel: eligible supervisors, current user, and any existing submission
        const [lecturersRes, userRes, submissionRes] = await Promise.all([
          api.get('/eligible-supervisors/'),
          api.get('/user/me/'),
          api.get('/submissions/'), // students only ever receive their own rows
        ]);

        setLecturers(lecturersRes.data);

        const currentUser = userRes.data;
        const existingSubmission = submissionRes.data.length > 0 ? submissionRes.data[0] : null;

        if (existingSubmission) {
          // Pre-fill the whole form when the student already submitted a TRF
          setFormData({
            ...existingSubmission,
            // the API returns supervisor IDs; map them onto the select values
            supervisor_id: existingSubmission.supervisor || '',
            co_supervisor_id: existingSubmission.co_supervisor || '',
          });
        } else {
          setFormData((prev) => ({
            ...prev,
            student_name: currentUser.full_name || '',
            student_id_no: currentUser.username || '',
          }));
        }
      } catch (error) {
        console.error('Failed to load TRF page data:', error);
        setErrorMessage(
          'We could not load your TRF data. Please refresh the page, and contact your coordinator if the problem continues.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []); // run once on mount

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const submissionId = formData.id; // present when editing an existing TRF

      const payload = {
        ...formData,
        supervisor: formData.supervisor_id,
        co_supervisor: formData.co_supervisor_id || null,
      };
      // strip front-end-only helper fields
      delete payload.supervisor_id;
      delete payload.co_supervisor_id;

      if (submissionId) {
        await api.put(`/submissions/${submissionId}/`, payload);
        setSuccessMessage('Your TRF has been updated. Redirecting to your dashboard…');
      } else {
        await api.post('/submissions/', payload);
        setSuccessMessage('Your TRF has been submitted. Redirecting to your dashboard…');
      }

      window.setTimeout(() => navigate('/dashboard'), 900);
    } catch (err) {
      console.error('Submission failed:', err.response?.data || err);
      setErrorMessage(
        'Submission failed. Please check that every required field is filled in, then try again.'
      );
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="main-content trf-page">
        <div className="trf-card">
          <div className="trf-loading">
            <span className="trf-spinner" aria-hidden="true" />
            Loading your Title Registration Form…
          </div>
        </div>
      </div>
    );
  }

  const isExisting = Boolean(formData.id);
  const status = formData.status || 'pending';
  const notice = isExisting ? STATUS_NOTICE[status] || STATUS_NOTICE.pending : null;

  return (
    <div className="main-content trf-page">
      <header className="trf-page-header">
        <div>
          <h1>Title Registration Form</h1>
          <p>
            Final Year Project &middot; Complete every required field exactly as it should appear on the official
            TRF document. Fields marked <span className="trf-req">*</span> cannot be left empty.
          </p>
        </div>
        {isExisting && (
          <div className="trf-page-header-side">
            <span className={`trf-chip trf-status-chip is-${status}`}>
              {status === 'approved' ? 'Approved' : status === 'revision' ? 'Needs Revision' : 'Pending Review'}
            </span>
            <span className="trf-hint">Editing your existing TRF</span>
          </div>
        )}
        {!isExisting && (
          <div className="trf-page-header-side">
            <span className="trf-chip">3 sections</span>
            <span className="trf-hint">About 10 minutes to complete</span>
          </div>
        )}
      </header>

      {notice && (
        <div className={`trf-banner ${notice.tone}`} role="status">
          <div>
            <strong>{notice.title}</strong>
            {notice.body}
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="trf-banner is-error" role="alert">
          <div>
            <strong>Something went wrong</strong>
            {errorMessage}
          </div>
        </div>
      )}

      {successMessage && (
        <div className="trf-banner is-success" role="status">
          <div>
            <strong>Saved</strong>
            {successMessage}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* ============ 1. Details of Student ============ */}
        <section className="trf-card">
          <div className="trf-section-head">
            <span className="trf-step" aria-hidden="true">1</span>
            <div>
              <h2>Details of Student</h2>
              <p>Your particulars and the category of project you are proposing.</p>
            </div>
          </div>

          <div className="trf-grid-2">
            {/* left column — student particulars */}
            <div className="trf-field-group">
              <div className="trf-subcard">
                <h3>Student particulars</h3>
                {STUDENT_FIELDS.map((field) => (
                  <div className="trf-field" key={field.name}>
                    <label htmlFor={`trf-${field.name}`}>
                      {field.label}
                      {field.required ? <span className="trf-req">*</span> : <span className="trf-optional"> (optional)</span>}
                    </label>
                    <input
                      id={`trf-${field.name}`}
                      className="trf-input"
                      type={field.type}
                      name={field.name}
                      value={formData[field.name] || ''}
                      onChange={handleChange}
                      required={field.required}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* right column — project particulars */}
            <div className="trf-field-group">
              <div className="trf-subcard">
                <h3>Project particulars</h3>

                <div className="trf-field">
                  <span className="trf-label" id="trf-category-label">
                    Project Category <span className="trf-req">*</span>
                    <span className="trf-optional"> (tick one)</span>
                  </span>
                  <div className="trf-radio-cards" role="radiogroup" aria-labelledby="trf-category-label">
                    {CATEGORY_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={`trf-radio-card ${
                          formData.project_category === option.value ? 'is-checked' : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name="project_category"
                          value={option.value}
                          checked={formData.project_category === option.value}
                          onChange={handleChange}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="trf-field is-grow">
                  <label htmlFor="trf-proposed_project_title">
                    Proposed Project Title <span className="trf-req">*</span>
                  </label>
                  <textarea
                    id="trf-proposed_project_title"
                    className="trf-textarea"
                    name="proposed_project_title"
                    rows="4"
                    value={formData.proposed_project_title || ''}
                    onChange={handleChange}
                    placeholder="Type the full working title of your project"
                    required
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ 2. Details of Supervisor ============ */}
        <section className="trf-card">
          <div className="trf-section-head">
            <span className="trf-step" aria-hidden="true">2</span>
            <div>
              <h2>Details of Supervisor</h2>
              <p>Choose the lecturer who will supervise this project.</p>
            </div>
          </div>

          <div className="trf-grid-2">
            <div className="trf-field">
              <label htmlFor="trf-supervisor_id">
                Supervisor <span className="trf-req">*</span>
              </label>
              <select
                id="trf-supervisor_id"
                className="trf-select"
                name="supervisor_id"
                value={formData.supervisor_id || ''}
                onChange={handleChange}
                required
              >
                <option value="">— Select a supervisor —</option>
                {lecturers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.full_name}
                  </option>
                ))}
              </select>
              <p className="trf-hint">Only lecturers with available supervision slots are listed.</p>
            </div>

            <div className="trf-field">
              <label htmlFor="trf-co_supervisor_id">
                Co-Supervisor <span className="trf-optional">(optional)</span>
              </label>
              <select
                id="trf-co_supervisor_id"
                className="trf-select"
                name="co_supervisor_id"
                value={formData.co_supervisor_id || ''}
                onChange={handleChange}
              >
                <option value="">— None —</option>
                {lecturers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.full_name}
                  </option>
                ))}
              </select>
              <p className="trf-hint">Leave as “None” if your project has a single supervisor.</p>
            </div>
          </div>
        </section>

        {/* ============ 3. Project Details ============ */}
        <section className="trf-card">
          <div className="trf-section-head">
            <span className="trf-step" aria-hidden="true">3</span>
            <div>
              <h2>Project Details</h2>
              <p>
                Use short bullet points that fit on <strong>one page</strong> when printed. Every box is optional but
                strongly recommended — your supervisor uses them to evaluate the proposed title.
              </p>
            </div>
          </div>

          <div className="trf-grid-3">
            {DETAIL_FIELDS.map((field) => (
              <div className="trf-field is-textarea" key={field.name}>
                <label htmlFor={`trf-${field.name}`}>{field.label}</label>
                <textarea
                  id={`trf-${field.name}`}
                  className="trf-textarea"
                  name={field.name}
                  value={formData[field.name] || ''}
                  onChange={handleChange}
                  placeholder={field.placeholder}
                />
              </div>
            ))}
          </div>
        </section>

        {/* ============ Actions ============ */}
        <div className="trf-form-actions">
          <p className="trf-hint">
            Submitting notifies your supervisor for review. You can edit and re-submit the form while it is still
            pending.
          </p>
          <div className="trf-action-buttons">
            <button
              type="button"
              className="trf-btn trf-btn-ghost"
              onClick={() => navigate('/dashboard')}
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
              ) : isExisting ? (
                'Save Changes'
              ) : (
                'Submit TRF'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default TRFSubmissionPage;
