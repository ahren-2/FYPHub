// src/pages/MilestoneVerification.js
// Lecturers verify each student's weekly milestones here. Scores are entered per
// milestone; approving a milestone marks it as verified.
import React, { useState, useEffect } from 'react';
import api from '../api';
import './TeammateLecturer.css';
import { Callout, EmptyState, Meter, Term } from '../components';

function CreateNewForm({ onBack, onFormCreated, user }) {
    const [formData, setFormData] = useState({
        student_name: '',
        student_id_no: '',
        fyp_title: '',
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                supervisor_name: user?.full_name || 'My Self'
            };

            await api.post('/milestones/', payload);
            alert("New form created successfully!");
            onFormCreated();
        } catch (err) {
            alert("Failed to create form. Please check the data.");
            console.error("Create form error:", err);
        }
    };

    return (
        <div className="card">
            <button className="btn btn-view back-button" onClick={onBack} style={{ marginBottom: '20px' }}>← Back to List</button>

            <Callout tone="plain" title="When to use this form">
                A milestone form is created automatically when a project is registered. Use this page only when a
                student is missing from the list, or when you need to track a project manually.
            </Callout>

            <form onSubmit={handleCreate}>
                <div className="trf-grid" style={{ marginBottom: '20px' }}>
                    <div className="form-group">
                        <label>
                            FYP Title
                        </label>
                        <input type="text" name="fyp_title" value={formData.fyp_title} onChange={handleChange} required />
                    </div>
                     <div className="form-group">
                        <label>
                            Supervisor
                        </label>
                        <input type="text" name="supervisor_name" value={user?.full_name || 'You'} disabled />
                    </div>
                    <div className="form-group">
                        <label>Student Name</label>
                        <input type="text" name="student_name" value={formData.student_name} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label>
                            Student ID
                        </label>
                        <input type="text" name="student_id_no" value={formData.student_id_no} onChange={handleChange} />
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <button type="submit" className="btn btn-review">Create Form</button>
                </div>
            </form>
        </div>
    );
}

function MilestoneVerification() {
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const fetchList = async () => {
    try {
        const [userRes, formsRes] = await Promise.all([
            api.get('/user/me/'),
            api.get('/milestones/')
        ]);
        setCurrentUser(userRes.data);
        setForms(formsRes.data);
    } catch (err) {
        console.error(err);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, []);

  const handleOpenForm = async (id) => {
    try {
      const res = await api.get(`/milestones/${id}/`);
      setSelectedForm(res.data);
    } catch (err) { alert("Failed to load form details"); }
  };

  const handleUpdateEntry = (index, field, value) => {
    const updatedEntries = [...selectedForm.entries];

    if (field === 'score') {
        const scoreValue = value === '' ? null : parseInt(value, 10);
        if (!isNaN(scoreValue) || scoreValue === null) {
            updatedEntries[index][field] = scoreValue;
        }
    } else {
        updatedEntries[index][field] = value;
    }

    setSelectedForm({ ...selectedForm, entries: updatedEntries });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = {
          entries: selectedForm.entries
      };

      await api.patch(`/milestones/${selectedForm.id}/`, payload);
      alert("Progress saved successfully!");
      setSelectedForm(null);
      fetchList();
    } catch (err) {
      alert("Save failed");
      console.error("Save Milestone Error:", err.response?.data);
    }
  };

   if (isCreating) {
      return (
          <div className="main-content">
              <header>
                  <h1>Create New Milestone Form</h1>
                  <p className="ui-page-subtitle">
                      Start a new progress record for one student. You will be able to score each
                      <Term tip="One of the weekly checkpoints used to track project progress."> milestone</Term> once it is created.
                  </p>
              </header>
              <CreateNewForm
                  user={currentUser}
                  onBack={() => setIsCreating(false)}
                  onFormCreated={() => {
                      setIsCreating(false);
                      fetchList();
                  }}
              />
          </div>
      );
  }

  if (selectedForm) {
    const entries = selectedForm.entries || [];
    const approvedCount = entries.filter((entry) => entry.status === 'approved').length;
    const totalMax = entries.reduce((sum, entry) => sum + (Number(entry.max_marks) || 0), 0);
    const totalScore = entries.reduce((sum, entry) => sum + (Number(entry.score) || 0), 0);

    return (
      <div className="main-content">
        <header>
            <h1>Milestones Verification</h1>
            <p className="ui-page-subtitle">
                Managing milestones for <strong>{selectedForm.student_name}</strong>. Enter a score for each
                completed milestone, tick it as verified, then save.
            </p>
        </header>
        <div className="card">
          <button className="btn btn-view back-button" onClick={() => setSelectedForm(null)} style={{ marginBottom: '20px' }}>← Back to List</button>

          <div className="ui-facts" style={{ marginBottom: '22px' }}>
            <div>
              <div className="ui-fact-label">FYP Title</div>
              <div className="ui-fact-value">{selectedForm.fyp_title || '—'}</div>
            </div>
            <div>
              <div className="ui-fact-label">Student ID</div>
              <div className="ui-fact-value">{selectedForm.student_id_no || '—'}</div>
            </div>
            <div>
              <div className="ui-fact-label">
                Verified
              </div>
              <div className="ui-fact-value">{approvedCount} of {entries.length} milestones</div>
              <Meter
                value={approvedCount}
                max={entries.length || 1}
                label={`${entries.length ? Math.round((approvedCount / entries.length) * 100) : 0}%`}
              />
            </div>
            <div>
              <div className="ui-fact-label">
                Marks entered
              </div>
              <div className="ui-fact-value">{totalScore} / {totalMax} marks</div>
            </div>
          </div>

          <form onSubmit={handleSave}>
            <table className="milestone-table">
              <thead>
                <tr>
                  <th>
                    Week
                  </th>
                  <th>Milestone</th>
                  <th>
                    Max marks
                  </th>
                  <th>
                    Score
                  </th>
                  <th>
                    Verification
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => (
                  <tr key={entry.id} className={entry.status === 'approved' ? 'is-verified' : ''}>
                    <td>{entry.milestone_number}</td>
                    <td style={{ fontSize: '0.85rem' }}>
                      <strong>{entry.milestone_name}</strong>
                    </td>
                    <td>
                      {entry.max_marks}
                    </td>
                    <td>
                      <input
                        type="number"
                        className="score-input"
                        value={entry.score ?? ''}
                        max={entry.max_marks}
                        min="0"
                        aria-label={`Score for ${entry.milestone_name}`}
                        placeholder="—"
                        onChange={(e) => handleUpdateEntry(idx, 'score', e.target.value)}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`btn-verify ${entry.status === 'approved' ? 'approved' : ''}`}
                        onClick={() => handleUpdateEntry(idx, 'status', entry.status === 'approved' ? 'pending' : 'approved')}
                      >
                        {entry.status === 'approved' ? 'Approved ✓' : 'Approve'}
                      </button>
                    </td>
                    </tr>
                  ))}
                </tbody>
            </table>

            <Callout tone="plain" title="Remember to save" className="is-tight-top">
              Approving a milestone only changes it on this screen. Press <strong>Save All Progress</strong> to
              store the scores and verifications, then the student’s progress bar updates.
            </Callout>

            <div style={{ textAlign: 'right', marginTop: '20px' }}>
                <button type="submit" className="btn btn-review">Save All Progress</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <header>
        <h1>Milestones Verification</h1>
        <p className="ui-page-subtitle">
          Every student you supervise, with the share of their milestones you have verified so far. Open a student
          to score and approve their progress.
        </p>
      </header>

      <div className="card">
        <div className="ui-section-head" style={{ marginBottom: '20px' }}>
            <div>
              <h3>Student Progress List</h3>
              <span className="ui-sub">
                {forms.length} student record{forms.length === 1 ? '' : 's'}.
              </span>
            </div>
            <button className="btn btn-review" onClick={() => setIsCreating(true)}>
                + Create New Form
            </button>
        </div>
        <div className="student-list">
          {loading ? (
            <p>Loading students...</p>
          ) : forms.length === 0 ? (
            <EmptyState
              icon="📈"
              title="No milestone records yet"
              message="Records are created automatically when a project is registered. Create one manually if a student is missing."
            >
              <button className="btn btn-review" onClick={() => setIsCreating(true)}>Create a milestone form</button>
            </EmptyState>
          ) : (
            forms.map(f => {
              const progress = parseInt(f.progress, 10) || 0;
              return (
                <div key={f.id} className="student-list-item" onClick={() => handleOpenForm(f.id)}>
                  <div className="student-info">
                    <strong>{f.student_name}</strong>
                    <span>{f.fyp_title}</span>
                  </div>
                  <div className="student-progress">
                    <span>{progress} of 8 milestones verified</span>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${Math.min((progress / 8) * 100, 100)}%` }}></div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default MilestoneVerification;
