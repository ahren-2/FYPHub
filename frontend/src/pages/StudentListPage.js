// --- File: src/pages/StudentListPage.js ---
import React, { useState, useEffect } from 'react';
import api from '../api'; 
import './Dashboard.css';
import { EmptyState } from '../components';

function StudentListPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedStage, setSelectedStage] = useState(null);

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      setError(null);
      
      const queryParams = {};
      if (selectedStage) {
        queryParams['fyp_stage'] = selectedStage;
      }
      
      try {
        // The programme-wide list. '/projects/' is deliberately scoped to the
        // projects a lecturer supervises, so a coordinator with no supervision
        // load of their own saw a near-empty page here.
        const response = await api.get('/student-list/', { params: queryParams });
        setProjects(response.data);
      } catch (err) {
        setError("Unable to load project data. Please check data integrity.");
        console.error("API Request Error:", err.response);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [selectedStage]);

  return (
    <div className="dashboard">
      <div className="welcome-header">
        <h1>Student List</h1>
        <p className="ui-page-subtitle">
          Every registered FYP student with their project, supervisor, examiner and stage. Use the stage filter to
          narrow the list; the numbering restarts from 1 for each filter.
        </p>
      </div>
      
      <div className="filters-wrapper">
        <div className="course-filter-container">
          <span>Filter by Stage: </span>
          {[{ code: 'All', value: null }, { code: 'FYP1', value: 'FYP1' }, { code: 'FYP2', value: 'FYP2' }].map(stage => (
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

      <div className="widget-container" style={{ gridTemplateColumns: '1fr' }}>
        <div className="widget">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <h3>Registered Projects</h3>
            <span style={{ fontSize: '0.9rem', color: '#666' }}>Total: {projects.length} Students</span>
          </div>
          
          {loading ? (
            <p className="loading-text">Loading students...</p>
          ) : error ? (
            <p style={{ color: 'red' }}>{error}</p>
          ) : projects.length === 0 ? (
            <EmptyState
              icon="🎓"
              title="No students to show"
              message="No project records match this filter. Students appear here once their Title Registration Form has been approved."
            />
          ) : (
            <div className="timetable-container"> 
              <table className="schedule-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>No.</th>
                    <th>Student ID</th>
                    <th>Student Name</th>
                    <th>
                      Project Title
                    </th>
                    <th>
                      Supervisor
                    </th>
                    <th>Co-Supervisor</th>
                    <th>
                      Examiner
                    </th>
                    <th>FYP Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project, index) => (
                    <tr key={project.id}>
                      <td style={{ color: '#999' }}>{index + 1}</td>
                      <td style={{ fontWeight: '600' }}>{project.student_matric_id}</td>
                      <td>{project.student_name || 'N/A'}</td>
                      <td title={project.title || ''}>
                        {project.title === 'Pending TRF Submission' ? 
                          <span style={{color: '#888', fontStyle: 'italic'}}>{project.title}</span> : 
                          project.title
                        }
                      </td>
                      <td>{project.supervisor_name || <span style={{color: '#888'}}>Not assigned</span>}</td>
                      <td>{project.co_supervisor_name || <span style={{color: '#888'}}>None</span>}</td>
                      <td>{project.examiner_name || <span style={{color: '#888'}}>Not assigned</span>}</td>
                      <td>
                        <span className={`fyp-stage-tag fyp-stage-${project.fyp_stage?.toLowerCase()}`}>
                          {project.fyp_stage}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StudentListPage;