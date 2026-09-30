// --- File: src/pages/ProjectOverview.js ---
import React, { useState, useEffect } from 'react';
import api from '../api';
import './TeammateCoordinator.css';

function ProjectOverview() {
    const [summary, setSummary] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let isMounted = true;

        const fetchSummary = async () => {
            try {
                const res = await api.get('/overview/summary/');
                if (isMounted) setSummary(res.data.summary || {});
            } catch (err) {
                console.error('Failed to load project overview', err);
                if (isMounted) setError('Unable to load the overview figures. Please refresh the page.');
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchSummary();
        return () => { isMounted = false; };
    }, []);

    const totalStudents = Number(summary.total_students) || 0;
    const submitted = Number(summary.projects_submitted) || 0;

    const cards = [
        {
            label: 'Total Students',
            value: summary.total_students,
            tip: 'Every student registered for FYP in your course.',
        },
        {
            label: 'Projects Submitted',
            value: summary.projects_submitted,
            tip: 'Students who have sent a Title Registration Form. A form counts as submitted before any supervisor decision.',
            share: totalStudents > 0 ? `${Math.round((submitted / totalStudents) * 100)}% of all students` : null,
        },
        {
            label: 'Pending',
            value: summary.pending_reviews,
            tone: 'pending',
            tip: 'Submitted but not yet approved or returned by a supervisor. These are the ones still needing action.',
        },
        {
            label: 'Approved',
            value: summary.approved_projects,
            tone: 'approved',
            tip: 'The title is registered and the project record has been created.',
        },
        {
            label: 'Needs Revision',
            value: summary.revision_needed,
            tone: 'revision',
            tip: 'Returned to the student, who must correct the TRF and submit it again.',
        },
    ];

    return (
        <div className="main-content">
            <header>
                <h1>Overall Project Overview</h1>
                <p className="ui-page-subtitle">
                    Where every FYP project currently stands in the registration process. The five counts below always
                    add up to the same total number of students.
                </p>
            </header>
            <div className="card">
                {loading ? (
                    <p>Loading overview...</p>
                ) : error ? (
                    <p style={{ color: '#842029' }}>{error}</p>
                ) : (
                    <>
                        <div className="overview-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                            {cards.map((card) => (
                                <div className="overview-item" key={card.label}>
                                    <h4>
                                        {card.label}
                                    </h4>
                                    <span className={`count ${card.tone || ''}`.trim()}>{card.value ?? 0}</span>
                                    {card.share && <span className="ui-hint is-tight">{card.share}</span>}
                                </div>
                            ))}
                        </div>
                        <p className="ui-hint">
                            Need the names behind these numbers? Open the <strong>Student List</strong> and filter by FYP stage.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}

export default ProjectOverview;