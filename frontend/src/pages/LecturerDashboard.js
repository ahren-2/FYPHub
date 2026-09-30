// --- src/pages/LecturerDashboard.js ---
// Supervisor landing page: the students you supervise, and your presentation duties.
import React, { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import './LecturerDashboard.css';
import { Callout, EmptyState, Legend, Meter, Term } from '../components';

function LecturerDashboard() {
  const navigate = useNavigate();
  const [myProjects, setMyProjects] = useState([]);
  const [mySchedule, setMySchedule] = useState([]);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, projectsRes, bookingsRes, quotaRes] = await Promise.all([
          api.get('/user/me/'),
          api.get('/projects/'),
          api.get('/bookings/'),
          // Supervision allocation set by the coordinator. Not fatal if missing.
          api.get('/my-quota/').catch(() => null)
        ]);

        const user = userRes.data;
        setCurrentUser(user);
        if (quotaRes) setQuota(quotaRes.data);

        // Only projects where this lecturer is the supervisor.
        const supervisedProjects = projectsRes.data
          .filter(p => p.supervisor === user.id)
          .sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''));
        setMyProjects(supervisedProjects);

        // Bookings where this lecturer is either the supervisor or the examiner.
        const allBookings = bookingsRes.data;
        const relevantBookings = allBookings
          .filter(b => b.lecturer === user.id || b.examiner === user.id)
          .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        setMySchedule(relevantBookings);

      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const upcoming = mySchedule.filter((booking) => moment.utc(booking.start_time).isSameOrAfter(moment().startOf('day')));
  const examinerCount = mySchedule.filter((booking) => booking.lecturer !== currentUser?.id).length;
  const fyp1Count = myProjects.filter((p) => (p.fyp_stage || '').toUpperCase().includes('FYP1') || p.fyp_stage === '1').length;
  const fyp2Count = myProjects.filter((p) => (p.fyp_stage || '').toUpperCase().includes('FYP2') || p.fyp_stage === '2').length;

  return (
    <div className="main-content lecturer-dashboard">
      <header className="welcome-header">
        <h1>Welcome, {currentUser?.full_name || 'Supervisor'}</h1>
        <p className="ui-page-subtitle">
          You have <strong>{myProjects.length}</strong> project{myProjects.length === 1 ? '' : 's'} to supervise
          {fyp1Count || fyp2Count
            ? <> ({fyp1Count} at <Term tip="First stage of the Final Year Project.">FYP 1</Term>, {fyp2Count} at <Term tip="Second stage of the Final Year Project.">FYP 2</Term>)</>
            : null}
          {' '}and <strong>{mySchedule.length}</strong> presentation dut{mySchedule.length === 1 ? 'y' : 'ies'} on the timetable.
        </p>
      </header>

      {!loading && myProjects.length === 0 && (
        <Callout tone="info" title="No students assigned to you yet">
          Students pick a supervisor when they submit their <Term tip="Title Registration Form — registers the FYP title and supervisor.">TRF</Term>,
          and only lecturers with free quota appear in that list. Check your quota, or ask the coordinator to confirm
          your allocation.
        </Callout>
      )}

      {quota && (
        <div className="card quota-card">
          <div className="quota-card-head">
            <div>
              <h3>Supervision Quota</h3>
              <span className="ui-sub">
                Students assigned to you, out of the places the coordinator has allocated.
              </span>
            </div>
            <div className="quota-figure">
              <strong>
                {quota.assigned_count}<span className="quota-figure-of">/{quota.quota_total}</span>
              </strong>
              <small>students</small>
            </div>
          </div>

          <Meter
            value={quota.assigned_count}
            max={quota.quota_total}
            label={quota.has_quota_set
              ? `${quota.available_quota} place${quota.available_quota === 1 ? '' : 's'} left`
              : 'No quota set'}
          />

          {!quota.has_quota_set && (
            <p className="ui-hint quota-hint">
              The coordinator has not allocated you a quota yet. Until one is set, students cannot pick you
              as a supervisor — ask the coordinator to confirm your allocation.
            </p>
          )}
        </div>
      )}

      <div className="lecturer-grid">
        <div className="card my-students-card">
          <div className="ui-section-head">
            <div>
              <h3>My Supervised Students</h3>
              <span className="ui-sub">
                Students who chose you as their main supervisor.
              </span>
            </div>
            <button className="ui-btn" onClick={() => navigate('/trf-review')}>Review TRFs</button>
          </div>

          {loading ? (
            <p>Loading projects...</p>
          ) : myProjects.length > 0 ? (
            <ul className="student-task-list">
              {myProjects.map(project => (
                <li key={project.id} className="student-task-item">
                  <span className="student-name">{project.student_name}</span>
                  <span className="student-id">({project.student_matric_id})</span>
                  <span className="project-title" title={project.title}>{project.title}</span>
                  <span className={`fyp-stage-tag fyp-stage-${project.fyp_stage?.toLowerCase()}`}>
                    {project.fyp_stage}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon="👩‍🎓"
              title="No students yet"
              message="Nothing to show until a student selects you as supervisor, or the coordinator assigns one to you."
            />
          )}
        </div>

        <div className="card my-schedule-card">
          <div className="ui-section-head">
            <div>
              <h3>My Upcoming Schedule</h3>
              <span className="ui-sub">
                Next {Math.min(upcoming.length, 5)} of {upcoming.length} upcoming presentation
                {upcoming.length === 1 ? '' : 's'} you are involved in.
              </span>
            </div>
          </div>

          {loading ? (
            <p>Loading schedule...</p>
          ) : upcoming.length > 0 ? (
            <>
              <ul className="schedule-list">
                {upcoming.slice(0, 5).map(booking => (
                  <li key={booking.id}>
                    <span className="schedule-date">{moment.utc(booking.start_time).format('MMM DD')}</span>
                    <span className="schedule-time">{moment.utc(booking.start_time).format('hh:mm A')}</span>
                    <span className="schedule-venue">{booking.venue}</span>
                    <span className={`role-tag ${booking.lecturer === currentUser?.id ? 'role-supervisor' : 'role-examiner'}`}>
                      {booking.lecturer === currentUser?.id ? 'Supervisor' : 'Examiner'}
                    </span>
                  </li>
                ))}
              </ul>
              {examinerCount > 0 && (
                <Legend
                  title="Your role"
                  items={[
                    { colour: '#dcfce7', label: 'Supervisor — the student is yours', tip: 'You guide the project and grade this student.' },
                    { colour: '#e0f2fe', label: 'Examiner — second marker', tip: 'You examine the presentation of another supervisor’s student.' },
                  ]}
                />
              )}
            </>
          ) : (
            <EmptyState
              icon="📅"
              title="No presentation duties booked"
              message="Once the coordinator runs the scheduler, your slots appear here. You can also book a slot yourself in My Availability."
            >
              <button className="ui-btn" onClick={() => navigate('/my-availability')}>Book a slot</button>
            </EmptyState>
          )}

          <button onClick={() => navigate('/present-schedule')} className="ui-btn is-ghost">
            View Full Schedule
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: '30px' }}>
        <div className="ui-section-head">
          <div>
            <h3>What to do next</h3>
            <span className="ui-sub">The usual order of work for a supervisor.</span>
          </div>
        </div>
        <div className="ui-facts">
          <div>
            <div className="ui-fact-label">1 · Approve TRFs</div>
            <div className="ui-fact-value">
              Read each student’s TRF and either approve it or send it back with comments.{' '}
              <button className="ui-link-btn" onClick={() => navigate('/trf-review')}>Open My Students</button>
            </div>
          </div>
          <div>
            <div className="ui-fact-label">2 · Verify milestones</div>
            <div className="ui-fact-value">
              Score and approve each completed weekly milestone.{' '}
              <button className="ui-link-btn" onClick={() => navigate('/milestones')}>Open Milestones</button>
            </div>
          </div>
          <div>
            <div className="ui-fact-label">3 · Grade</div>
            <div className="ui-fact-value">
              Mark the final assessment using the active rubric for the student’s stage.{' '}
              <button className="ui-link-btn" onClick={() => navigate('/assessment')}>Open Assessment</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LecturerDashboard;
