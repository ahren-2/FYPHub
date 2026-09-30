// src/pages/StudentAnnouncements.js
import React, { useState, useEffect } from 'react';
import api from '../api';
import './TeammateStudent.css';
import { EmptyState } from '../components';

function StudentAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await api.get('/announcements/');
        // Newest first — the notice a student needs is usually the most recent.
        const sorted = [...res.data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setAnnouncements(sorted);
      } catch (err) { 
        console.error("Failed to fetch announcements:", err); 
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  return (
    <div className="main-content">
      <header>
        <h1>All Announcements</h1>
      </header>

      {loading ? (
        <p>Loading announcements...</p>
      ) : announcements.length === 0 ? (
        <div className="content-card">
          <EmptyState
            icon="📣"
            title="No announcements yet"
            message="When the FYP coordinator publishes a notice, it will appear here and on your dashboard."
          />
        </div>
      ) : (
        announcements.map((ann, index) => (
          <div key={ann.id} className="announcement-item">
            <h3>
              {ann.title}
              {index === 0 && <span className="ui-badge is-info" style={{ marginLeft: '10px' }}>Latest</span>}
            </h3>
            <p className="announcement-meta">
              Posted by {ann.coordinator_name || 'the coordinator'} on {new Date(ann.created_at).toLocaleDateString()}
            </p>
            <p>{ann.content}</p>
          </div>
        ))
      )}
    </div>
  );
}

export default StudentAnnouncements;
