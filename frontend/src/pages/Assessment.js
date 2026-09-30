import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './TeammateLecturer.css';
import { Callout, Term } from '../components';

const PHP_API_URL = process.env.REACT_APP_PHP_API_URL || 'http://localhost/php';

function normalizeFypStage(value = '') {
  const compact = String(value).toUpperCase().replace(/\s+/g, '').replace(/PROJECT/g, 'FYP');
  if (compact.includes('PROPOSAL')) return 'PROPOSAL';
  if (compact.includes('FYP1') || compact === '1') return 'FYP1';
  if (compact.includes('FYP2') || compact === '2') return 'FYP2';
  return compact;
}

function displayFypStage(value = '') {
  const normalized = normalizeFypStage(value);
  if (normalized === 'FYP1') return 'FYP 1';
  if (normalized === 'FYP2') return 'FYP 2';
  if (normalized === 'PROPOSAL') return 'Proposal';
  return value || 'N/A';
}

function stageClass(value = '') {
  return normalizeFypStage(value).toLowerCase();
}

function Assessment() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [selectedStage, setSelectedStage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gradingId, setGradingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAssessmentData = async () => {
      setLoading(true);
      setError('');

      try {
        const [userRes, projectsRes] = await Promise.all([
          api.get('/user/me/'),
          api.get('/projects/')
        ]);

        const user = userRes.data;
        const supervisedProjects = projectsRes.data
          .filter((project) => project.supervisor === user.id)
          .sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''));

        setProjects(supervisedProjects);
      } catch (err) {
        console.error('Failed to load assessment data', err);
        setError('Unable to load assessment data. Please check the API and PHP backend.');
      } finally {
        setLoading(false);
      }
    };

    fetchAssessmentData();
  }, []);

  const filteredProjects = useMemo(() => {
    if (!selectedStage) return projects;
    return projects.filter((project) => normalizeFypStage(project.fyp_stage) === selectedStage);
  }, [projects, selectedStage]);

  const findTemplateForStage = async (stage) => {
    const normalizedStage = normalizeFypStage(stage);

    if (!['FYP1', 'FYP2', 'PROPOSAL'].includes(normalizedStage)) {
      return null;
    }

    try {
      const response = await fetch(`${PHP_API_URL}/get_active_template.php?fyp_stage=${encodeURIComponent(normalizedStage)}`);
      const result = await response.json();

      if (result.success && result.template) {
        return result.template;
      }
    } catch (err) {
      console.error('Failed to load active rubric template', err);
    }

    return null;
  };

  const handleGrade = async (project) => {
    setGradingId(project.id);

    const matchedTemplate = await findTemplateForStage(project.fyp_stage);

    setGradingId(null);

    if (!matchedTemplate) {
      alert(`No active rubric template found for ${displayFypStage(project.fyp_stage)}. Please ask the coordinator to set an active rubric first.`);
      return;
    }

    navigate(`/assessment-grade?projectId=${encodeURIComponent(project.id)}&templateId=${encodeURIComponent(matchedTemplate.id)}`);
  };

  return (
    <div className="main-content">
      <header>
        <h1>Assessment</h1>
        <p className="ui-page-subtitle">
          Grade the students you supervise. Pressing <strong>Grade</strong> opens the
          <Term tip="The marking template: sections, criteria, performance levels and weights."> rubric</Term> that is
          currently active for that student’s FYP stage, with their marks already loaded if you started before.
        </p>
      </header>

      <Callout tone="plain" title="How marking works">
        Each stage has one active rubric maintained by the coordinator. If no rubric is set for a stage, ask the
        coordinator to activate one before you try to grade — the marks cannot be saved without it.
      </Callout>

      <div className="card">
        <div className="filters-wrapper">
          <div className="course-filter-container">
            <span>
              Filter by Stage:
            </span>
            {[{ code: 'All', value: null }, { code: 'FYP 1', value: 'FYP1' }, { code: 'FYP 2', value: 'FYP2' }, { code: 'Proposal', value: 'PROPOSAL' }].map((stage) => (
              <button
                key={stage.code}
                className={`course-filter-btn ${selectedStage === stage.value ? 'active' : ''}`}
                onClick={() => setSelectedStage(stage.value)}
              >
                {stage.code}
              </button>
            ))}
          </div>
        </div>

        <p className="ui-hint">
          Showing {filteredProjects.length} student{filteredProjects.length === 1 ? '' : 's'}
          {selectedStage ? ' at the selected stage' : ' across all stages'}.
        </p>

        <table>
          <thead>
            <tr>
              <th>Student ID</th>
              <th>Student Name</th>
              <th>Project Title</th>
              <th>FYP Stage</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ textAlign: 'center' }}>Loading...</td></tr>
            ) : error ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', color: '#842029' }}>{error}</td></tr>
            ) : filteredProjects.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center' }}>
                {projects.length === 0
                  ? 'No students are assigned to you as supervisor.'
                  : 'No students match the selected stage. Choose “All” to see every student you supervise.'}
              </td></tr>
            ) : (
              filteredProjects.map((project) => (
                <tr key={project.id}>
                  <td style={{ fontWeight: 600 }}>{project.student_matric_id || 'N/A'}</td>
                  <td>{project.student_name || 'N/A'}</td>
                  <td title={project.title || ''}>{project.title || 'N/A'}</td>
                  <td>
                    <span className={`fyp-stage-tag fyp-stage-${stageClass(project.fyp_stage)}`}>
                      {displayFypStage(project.fyp_stage)}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-review"
                      onClick={() => handleGrade(project)}
                      disabled={gradingId === project.id}
                      title="Open the active rubric for this student’s FYP stage"
                    >
                      {gradingId === project.id ? 'Checking...' : 'Grade'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Assessment;
