// src/pages/StudentFeedback.js
import React, { useState, useEffect } from 'react';
import api from '../api';
import './TeammateStudent.css';
import { Callout, EmptyState } from '../components';

function StudentFeedback() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const res = await api.get('/feedback/');
        // Newest first, so anything requiring action is at the top.
        const sorted = [...res.data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setFeedbacks(sorted);
      } catch (err) { 
        console.error("Failed to fetch feedback:", err); 
      } finally {
        setLoading(false);
      }
    };
    fetchFeedback();
  }, []);

  const unreadCount = feedbacks.filter((fb) => !fb.is_read).length;

  return (
    <div className="main-content">
      <header>
        <h1>Feedback History</h1>
        <p className="ui-page-subtitle">
          Comments your supervisor has recorded against your Title Registration Form, newest first.
          {unreadCount > 0 ? <> You have <strong>{unreadCount}</strong> unread message{unreadCount === 1 ? '' : 's'}.</> : null}
        </p>
      </header>

      {unreadCount > 0 && (
        <Callout tone="next" title="Read the comments marked New first">
          If a comment asks for changes, update your TRF from the <strong>Submit TRF</strong> page and submit it again
          so your supervisor is notified.
        </Callout>
      )}

      <div className="content-card">
        {loading ? (
          <p>Loading feedback...</p>
        ) : feedbacks.length === 0 ? (
          <EmptyState
            icon="💬"
            title="No feedback yet"
            message="When your supervisor reviews your Title Registration Form, their comments appear here."
          />
        ) : (
          feedbacks.map(fb => (
            <div key={fb.id} className={`feedback-item ${!fb.is_read ? 'is-unread' : ''}`}>
              <div className="feedback-header">
                <strong>From: {fb.lecturer_name || 'Supervisor'}</strong>
                <span className="feedback-date">
                  {!fb.is_read && <span className="ui-badge is-info">New</span>}
                  {new Date(fb.created_at).toLocaleString()}
                </span>
              </div>
              <div className="feedback-body">
                <p>{fb.comment}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default StudentFeedback;
