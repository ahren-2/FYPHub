// --- src/pages/ProfilePage.js ------------------------------------------------
// The signed-in account's own details, plus the one destructive action the
// interface offers: deleting the account.
//
// Deleting is deliberately awkward. It is the only irreversible button in the
// app, so it sits behind a collapse, a typed password, and an explicit
// acknowledgement that the coordinator's duties are not reassigned for them.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './ProfilePage.css';
import { Callout, EmptyState, Term } from '../components';

const ROLE_LABELS = {
  student: 'Student',
  lecturer: 'Lecturer',
  coordinator: 'Coordinator',
  admin: 'Administrator',
};

function ProfilePage() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Danger-zone state
  const [isDangerOpen, setIsDangerOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [actionError, setActionError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await api.get('/user/me/');
        setMe(res.data);
      } catch (err) {
        console.error('Failed to load the profile', err);
        setLoadError('We could not load your account details. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };
    fetchMe();
  }, []);

  const isCoordinator = me?.role === 'coordinator';
  // Both gates are required before the button will fire.
  const canDelete = isCoordinator && password.trim().length > 0 && acknowledged && !isDeleting;

  const handleDelete = async (e) => {
    e.preventDefault();
    if (!canDelete) return;

    setActionError('');
    setIsDeleting(true);

    try {
      await api.post('/users/delete-own-account/', { password });
      // The token now belongs to a deleted account, so the session is cleared
      // rather than left to fail on the next request. `localStorage.clear()`
      // matches what the Logout button does.
      localStorage.clear();
      // A full reload is used on purpose: it drops every cached page and the
      // in-memory user, so nothing of the deleted account is left on screen.
      window.location.replace('/');
    } catch (err) {
      const message = err.response?.data?.error
        || err.response?.data?.detail
        || 'We could not delete your account. Please try again.';
      setActionError(message);
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <div className="main-content">Loading your account…</div>;
  }

  if (loadError || !me) {
    return (
      <div className="main-content">
        <header>
          <h1>My Profile</h1>
        </header>
        <div className="card">
          <EmptyState icon="🔒" title="Account details unavailable" message={loadError} />
        </div>
      </div>
    );
  }

  const facts = [
    { label: 'Full name', value: me.full_name || '—' },
    { label: 'Username', value: me.username || '—' },
    { label: 'Email', value: me.email || '—' },
    {
      label: <Term tip="The cohort this account belongs to. Every list, statistic and marking template is scoped to it.">Programme</Term>,
      value: me.programme_code || me.programme_name || 'Not assigned',
    },
    { label: 'Role', value: ROLE_LABELS[me.role] || me.role },
    { label: 'Phone number', value: me.phone_no || '—' },
    { label: 'Student ID', value: me.student_id_no || '—' },
  ];

  return (
    <div className="main-content profile-page">
      <header>
        <h1>My Profile</h1>
        <p className="ui-page-subtitle">
          Your account details as the system holds them. Everything here is managed by your programme
          coordinator — if something is wrong, ask them to correct it.
        </p>
      </header>

      <section className="card">
        <div className="ui-section-head" style={{ marginBottom: '14px' }}>
          <div>
            <h3>Account details</h3>
            <span className="ui-sub">Read-only. Your role and programme decide what you can see.</span>
          </div>
          <span className={`role-chip role-chip-${me.role}`}>{ROLE_LABELS[me.role] || me.role}</span>
        </div>

        <dl className="profile-facts">
          {facts.map((fact) => (
            <div className="profile-fact" key={String(fact.label)}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {isCoordinator && (
        <section className="card profile-danger">
          <div className="ui-section-head" style={{ marginBottom: '14px' }}>
            <div>
              <h3>Delete my account</h3>
              <span className="ui-sub">Permanent. This cannot be undone from the interface.</span>
            </div>
          </div>

          <Callout tone="warn" title="Read this before you continue">
            Deleting your account removes your sign-in and your profile immediately. Students and
            projects you supervise are <strong>not</strong> reassigned — they keep their record but
            lose their supervisor, so someone else has to be given them. If you are the only
            coordinator left in your programme, nobody will be able to publish announcements, set
            quotas or change rubrics for that cohort until another coordinator is appointed.
            <div style={{ marginTop: '10px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/users')}
              >
                Open User Management first
              </button>{' '}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsDangerOpen((open) => !open)}
              >
                {isDangerOpen ? 'Cancel' : 'I understand — continue'}
              </button>
            </div>
          </Callout>

          {isDangerOpen && (
            <form className="profile-danger-form" onSubmit={handleDelete}>
              <div className="profile-danger-step">
                <span className="profile-danger-step-index" aria-hidden="true">1</span>
                <div className="profile-danger-step-body">
                  <label htmlFor="delete-password">
                    Confirm with your password <span className="trf-req">*</span>
                  </label>
                  <input
                    id="delete-password"
                    className="profile-danger-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Your sign-in password"
                    required
                  />
                  <p className="ui-hint is-tight">
                    Your password is re-checked on the server. Being signed in is not treated as
                    proof that you meant to do this.
                  </p>
                </div>
              </div>

              <div className="profile-danger-step">
                <span className="profile-danger-step-index" aria-hidden="true">2</span>
                <div className="profile-danger-step-body">
                  <label className="profile-danger-check">
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      onChange={(e) => setAcknowledged(e.target.checked)}
                    />
                    <span>
                      I understand this permanently deletes my account, and that anything I supervise
                      is left without a supervisor.
                    </span>
                  </label>
                </div>
              </div>

              {actionError && (
                <div className="trf-banner is-error" role="alert">
                  <div>
                    <strong>Could not delete the account</strong>
                    {actionError}
                  </div>
                </div>
              )}

              <div className="profile-danger-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsDangerOpen(false);
                    setPassword('');
                    setAcknowledged(false);
                    setActionError('');
                  }}
                  disabled={isDeleting}
                >
                  Keep my account
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={!canDelete}
                  title={
                    canDelete
                      ? 'Delete my account permanently'
                      : 'Enter your password and tick the acknowledgement first'
                  }
                >
                  {isDeleting ? 'Deleting…' : 'Delete my account permanently'}
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  );
}

export default ProfilePage;
