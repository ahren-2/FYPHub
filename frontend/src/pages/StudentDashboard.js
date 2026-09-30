import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api'; 
import './TeammateStudent.css'; 
import { StatusBadge, Callout, StepTrail } from '../components';

// The student journey, shown as a step trail so it is always obvious where the
// student is and what comes next.
const JOURNEY = [
  'Submit your TRF',
  'Supervisor review',
  'Approved title',
  'Milestones & grading',
  'Presentation',
];

const JOURNEY_INDEX = {
  'not submitted': 0,
  'pending review': 1,
  'needs revision': 1,
  approved: 2,
};

// Backend status values mapped onto the wording used on this page.
const STATUS_KEY = {
  pending: 'pending review',
  submitted: 'pending review',
  approved: 'approved',
  revision: 'needs revision',
  'needs revision': 'needs revision',
};

const NEXT_STEP = {
  'not submitted': {
    tone: 'next',
    title: 'Start here: submit your Title Registration Form',
    body: 'Your FYP title, supervisor and project description are registered through the TRF. Nothing else can move forward until your supervisor receives it.',
    action: 'Submit TRF',
    to: '/submit-trf',
  },
  'pending review': {
    tone: 'info',
    title: 'Waiting for your supervisor',
    body: 'Your TRF has been submitted. You will see your supervisor’s decision here as soon as they review it. You can still correct the details while it is pending.',
    action: 'View / edit TRF',
    to: '/submit-trf',
  },
  'needs revision': {
    tone: 'warn',
    title: 'Your supervisor asked for changes',
    body: 'Open the TRF, apply the changes described in your feedback, then submit it again for a second review.',
    action: 'Update my TRF',
    to: '/submit-trf',
  },
  approved: {
    tone: 'success',
    title: 'Your title is approved',
    body: 'Keep your milestones up to date and check Feedback regularly — that is where your supervisor records progress notes.',
    action: 'View my feedback',
    to: '/feedback',
  },
};

function StudentDashboard({ user }) {
    const navigate = useNavigate();
    const [dashboardData, setDashboardData] = useState({
        submissionStatus: 'not-submitted',
        statusKey: 'not submitted',
        hasSubmission: false,
        unreadFeedbackCount: 0,
        latestAnnouncement: null,
        project: null
    });
    const [loading, setLoading] = useState(true);

    const fetchDashboardData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [submissionRes, announcementRes, projectRes, feedbackRes] = await Promise.all([
                api.get('/submissions/'),
                api.get('/announcements/'),
                api.get('/projects/'),
                api.get('/feedback/')
            ]);
            
            const mySubmission = submissionRes.data.length > 0 ? submissionRes.data[0] : null;
            const backendStatus = mySubmission ? String(mySubmission.status || 'pending').toLowerCase().trim() : 'not-submitted';
            const statusKey = mySubmission ? (STATUS_KEY[backendStatus] || backendStatus.replace(/_/g, ' ')) : 'not submitted';
            const latestAnn = announcementRes.data.length > 0 ? announcementRes.data[0] : null;
            const myProject = projectRes.data.length > 0 ? projectRes.data[0] : null;
            const unreadCount = feedbackRes.data.filter(fb => !fb.is_read).length;

            setDashboardData({
                submissionStatus: backendStatus,
                statusKey,
                hasSubmission: Boolean(mySubmission),
                unreadFeedbackCount: unreadCount,
                latestAnnouncement: latestAnn,
                project: myProject
            });

        } catch (error) {
            console.error("Failed to load dashboard data", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const handleTrfButtonClick = () => {
        navigate('/submit-trf');
    };

    if (loading) {
        return <div className="main-content">Loading Dashboard...</div>;
    }

    const project = dashboardData.project;
    const nextStep = NEXT_STEP[dashboardData.statusKey] || NEXT_STEP['not submitted'];
    const journeyStep = JOURNEY_INDEX[dashboardData.statusKey] ?? 0;
    const projectFacts = [
        { label: 'Proposed title', value: project ? project.title : 'Pending assignment' },
        { label: 'Main supervisor', value: project ? project.supervisor_name : 'To be assigned' },
        { label: 'Co-supervisor', value: project && project.co_supervisor_name ? project.co_supervisor_name : 'None' },
        { label: 'FYP stage', value: project ? project.fyp_stage : 'FYP1' },
        { label: 'Examiner', value: project ? project.examiner_name : 'To be assigned' },
        { label: 'Presentation', value: project && project.status === 'Scheduled' ? 'Scheduled' : 'Not scheduled yet' },
    ];

    return (
        <div className="main-content">
            <header>
                <h1>Welcome, {user?.full_name || 'Student'}</h1>
                <p className="ui-page-subtitle">
                    This is your FYP home page. Everything below is read from your own record — if something looks
                    wrong, talk to your supervisor or the FYP coordinator.
                </p>
            </header>

            <StepTrail steps={JOURNEY} current={journeyStep} title="Where you are in the FYP process" />

            <Callout tone={nextStep.tone} title={nextStep.title}>
                {nextStep.body}
                <div style={{ marginTop: '10px' }}>
                    <button className="btn-submit" onClick={() => navigate(nextStep.to)}>
                        {nextStep.action}
                    </button>
                </div>
            </Callout>

            <div className="ui-section-head">
                <div>
                    <h2>Your status at a glance</h2>
                    <span className="ui-sub">The three cards below cover everything that needs your attention.</span>
                </div>
            </div>

            <section className="cards">
                <div className="card">
                    <h3>Title Registration Form</h3>
                    <p className="ui-sub">The form that registers your project title and supervisor.</p>
                    <p style={{ marginTop: '14px' }}>
                        Current status: <StatusBadge status={dashboardData.submissionStatus} kind="trf" />
                    </p>

                    <button className="btn-submit" onClick={handleTrfButtonClick}>
                        {dashboardData.hasSubmission ? 'View / Edit TRF' : 'Submit TRF'}
                    </button>
                </div>
                <div className="card">
                    <h3>Feedback</h3>
                    <p className="ui-sub">Comments your supervisor has left for you.</p>
                    <p style={{ marginTop: '14px' }}>
                        {dashboardData.unreadFeedbackCount > 0 ? (
                            <>You have <strong>{dashboardData.unreadFeedbackCount}</strong> unread message
                                {dashboardData.unreadFeedbackCount === 1 ? '' : 's'}.</>
                        ) : (
                            <>Nothing unread — you are up to date.</>
                        )}
                    </p>
                    <button className="btn-submit" onClick={() => navigate('/feedback')} style={{ backgroundColor: '#6c757d' }}>
                        {dashboardData.unreadFeedbackCount > 0 ? 'Read feedback' : 'History'}
                    </button>
                </div>
                <div className="card">
                    <h3>Latest Announcement</h3>
                    <p className="ui-sub">Notices posted by the FYP coordinator.</p>
                    {dashboardData.latestAnnouncement ? (
                        <div style={{ marginTop: '14px' }}>
                            <p style={{ fontWeight: '500' }}>"{dashboardData.latestAnnouncement.title}"</p>
                            <small style={{ color: '#666' }}>
                                Posted {new Date(dashboardData.latestAnnouncement.created_at).toLocaleDateString()}
                            </small>
                        </div>
                    ) : (
                        <p style={{ marginTop: '14px' }}>No announcements have been posted yet.</p>
                    )}
                    <button className="btn-submit" onClick={() => navigate('/announcements')} style={{ backgroundColor: '#6c757d' }}>
                        All announcements
                    </button>
                </div>
            </section>

            <div className="content-card" style={{ marginTop: '30px' }}>
                <div className="ui-section-head">
                    <div>
                        <h2>My FYP Project Details</h2>
                        <span className="ui-sub">
                            Read-only. Contact your supervisor or the coordinator if a value is incorrect.
                        </span>
                    </div>
                </div>
                <div className="ui-facts">
                    {projectFacts.map((fact) => (
                        <div key={fact.label}>
                            <div className="ui-fact-label">{fact.label}</div>
                            <div className="ui-fact-value">{fact.value || '—'}</div>
                        </div>
                    ))}
                </div>

                {!project && (
                    <Callout tone="plain" title="Your project record is not created yet" className="is-tight-top">
                        The project record appears once your Title Registration Form is approved. Until then, the
                        values above show what is still to be assigned.
                    </Callout>
                )}            </div>
        </div>
    );
}

export default StudentDashboard;
