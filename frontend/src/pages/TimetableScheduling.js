import React, { useState, useEffect } from 'react';
import api from '../api';
import moment from 'moment';
import PresentSchedulePage from './PresentSchedulePage'; // Reuse the results table component
import './Dashboard.css';
import './TimetableScheduling.css';
import { Callout } from '../components';

function TimetableScheduling() {
  const [days, setDays] = useState([]);
  const [venues, setVenues] = useState([]);
  // Days and venues are two independent lists — a day is a date, a venue is a
  // room — so they get one input each rather than a single "add a slot" form.
  // The old two-field form required both on every submit, which made a third
  // presentation day impossible to add without inventing a venue name: reusing
  // an existing one tripped the (programme, name) unique constraint and the
  // whole request failed.
  const [newDay, setNewDay] = useState('');
  const [newVenue, setNewVenue] = useState('');
  const [loading, setLoading] = useState(true);
  const [schedulerLoading, setSchedulerLoading] = useState(false);
  const [notifying, setNotifying] = useState(false);

  // 1. Fetch the base configuration data
  const fetchData = async () => {
    try {
      const [dayRes, venueRes] = await Promise.all([
        api.get('/presentation-days/'),
        api.get('/venues/')
      ]);
      // Sorted here rather than in the table so the panel always reads in
      // calendar order whatever order the API returns.
      setDays([...dayRes.data].sort((a, b) => String(a.date).localeCompare(String(b.date))));
      setVenues([...venueRes.data].sort((a, b) => String(a.name).localeCompare(String(b.name))));
    } catch (err) { console.error("Fetch infrastructure failed", err); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // The API's own explanation ("date or venue already exists") is more useful
  // than a generic failure, so it is surfaced when the server sends one.
  const describeError = (err, fallback) => (
    err?.response?.data?.date?.[0]
    || err?.response?.data?.name?.[0]
    || err?.response?.data?.non_field_errors?.[0]
    || err?.response?.data?.detail
    || err?.response?.data?.error
    || fallback
  );

  // 2. Add/remove infrastructure logic
  const handleAddDay = async (e) => {
    e.preventDefault();
    if (!newDay) return alert("Please pick a presentation day.");
    try {
      await api.post('/presentation-days/', { date: newDay });
      setNewDay('');
      fetchData();
    } catch (err) {
      alert(describeError(err, "Could not add that day. It may already be configured for your programme."));
      console.error("Add Day Error:", err);
    }
  };

  const handleAddVenue = async (e) => {
    e.preventDefault();
    const name = newVenue.trim();
    if (!name) return alert("Please type a venue name.");
    try {
      await api.post('/venues/', { name });
      setNewVenue('');
      fetchData();
    } catch (err) {
      alert(describeError(err, "Could not add that venue. It may already be configured for your programme."));
      console.error("Add Venue Error:", err);
    }
  };

  const handleDeleteItem = async (type, id, label) => {
    if (window.confirm(`Remove ${label}?\n\nAny presentation already booked in this ${type} keeps its booking.`)) {
      const url = type === 'day' ? `/presentation-days/${id}/` : `/venues/${id}/`;
      try {
        await api.delete(url);
        fetchData();
      } catch (err) {
        alert(describeError(err, `Could not remove that ${type}.`));
        console.error("Delete slot error:", err);
      }
    }
  };

  // 3. Core control logic: AI and email
  const handleRunScheduler = async () => {
    if (window.confirm("Run AI Auto-Scheduler? This will fill empty slots...")) {
      setSchedulerLoading(true);
      try {
        // [CORE FIX] The '/api' prefix has been removed
        const res = await api.post('/run-scheduler/');
        alert(res.data.message);
        window.location.reload();
      } catch (err) {
        alert("Scheduling failed: " + (err.response?.data?.error || "Check backend log"));
      } finally {
        setSchedulerLoading(false);
      }
    }
  };

  const handleClearSchedule = async () => {
    if (window.confirm("WARNING: This will delete ALL presentation bookings for your course. Are you sure you want to proceed?")) {
      try {
        const res = await api.post('/clear-schedule/');
        alert(res.data.message);
        window.location.reload(); // Reload the page to clear the table below
      } catch (err) {
        alert("Failed to clear schedule. Check backend log.");
      }
    }
  };

  const handleNotifyLecturers = async () => {
    if (window.confirm("Send email reminders to all scheduled staff?")) {
      setNotifying(true);
      try {
        // [CORE FIX] The '/api' prefix has been removed
        const res = await api.post('/send-notification/');
        alert(res.data.message);
      } catch (err) {
        alert("Email service failed. Check settings.py.");
      } finally {
        setNotifying(false);
      }
    }
  };

  if (loading) return <div className="main-content">Loading Controls...</div>;

  return (
    <div className="dashboard">
      <header className="welcome-header">
        <h1>Timetable Scheduling Control</h1>
        <p className="ui-page-subtitle">
          Set up the presentation infrastructure for your course, run the automated scheduler, and tell the staff
          when it is done. Work through the numbered panels from top to bottom.
        </p>
      </header>

      <Callout tone="next" title="Do these three things in order">
        <strong>1 · Add slots</strong> — every date and venue you will use. <strong>2 · Run the scheduler</strong> — it
        fills empty slots with students who have not been booked yet. <strong>3 · Notify lecturers</strong> — emails
        everyone with a role in the timetable.
        {days.length === 0 && ' The scheduler stays disabled until at least one presentation day exists.'}
      </Callout>

      <div className="scheduling-grid">
        
        {/* === Panel 1: Infrastructure Setup (top left) === */}
        <div className="widget">
          <h3>1. Setup Presentation Slots</h3>
          <p className="ui-hint slot-panel-intro">
            Add the presentation days and the venues you will use. The scheduler pairs every day with
            every venue, so <strong>{days.length}</strong> day{days.length === 1 ? '' : 's'} and{' '}
            <strong>{venues.length}</strong> venue{venues.length === 1 ? '' : 's'} make{' '}
            <strong>{days.length * venues.length}</strong> slot{days.length * venues.length === 1 ? '' : 's'}.
            {days.length === 0 && venues.length === 0 && ' Nothing is configured yet.'}
          </p>

          <div className="slot-add-grid">
            <form className="slot-add-form" onSubmit={handleAddDay}>
              <label htmlFor="slot-day">Add a presentation day</label>
              <div className="slot-add-controls">
                <input
                  id="slot-day"
                  type="date"
                  className="slot-input"
                  value={newDay}
                  onChange={(e) => setNewDay(e.target.value)}
                />
                <button type="submit" className="save-button">Add Day</button>
              </div>
            </form>

            <form className="slot-add-form" onSubmit={handleAddVenue}>
              <label htmlFor="slot-venue">Add a venue</label>
              <div className="slot-add-controls">
                <input
                  id="slot-venue"
                  type="text"
                  className="slot-input"
                  placeholder="Venue name, e.g. CL3"
                  value={newVenue}
                  onChange={(e) => setNewVenue(e.target.value)}
                />
                <button type="submit" className="save-button">Add Venue</button>
              </div>
            </form>
          </div>

          <div className="slot-config-grid">
            <section className="slot-config-column">
              <h4>
                Presentation Days
                <span className="slot-count">{days.length}</span>
              </h4>
              {days.length === 0 ? (
                <p className="slot-empty">No days yet. The scheduler cannot run until you add one.</p>
              ) : (
                <ul className="date-list">
                  {days.map((day) => {
                    const label = moment(day.date).format('ddd, DD MMM YYYY');
                    return (
                      <li key={day.id} className="date-item">
                        <span className="date-info">{label}</span>
                        <button
                          type="button"
                          className="remove-btn"
                          onClick={() => handleDeleteItem('day', day.id, label)}
                          title={`Remove ${label}`}
                          aria-label={`Remove presentation day ${label}`}
                        >
                          Remove
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="slot-config-column">
              <h4>
                Venues
                <span className="slot-count">{venues.length}</span>
              </h4>
              {venues.length === 0 ? (
                <p className="slot-empty">No venues yet. Add the rooms you will present in.</p>
              ) : (
                <ul className="date-list">
                  {venues.map((venue) => (
                    <li key={venue.id} className="date-item">
                      <span className="date-info">{venue.name}</span>
                      <button
                        type="button"
                        className="remove-btn"
                        onClick={() => handleDeleteItem('venue', venue.id, venue.name)}
                        title={`Remove venue ${venue.name}`}
                        aria-label={`Remove venue ${venue.name}`}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>

        {/* === Panel 2: AI Control Center (top right) === */}
        <div className="widget ai-control-widget">
          <h3>2. AI &amp; Communication</h3>
          <p className="ai-control-intro">
            Finalise the schedule and notify the faculty.
            {days.length === 0 && ' The scheduler cannot run until you add at least one presentation day in panel 1.'}
          </p>
          <div className="ai-control-actions">
            <button className="run-scheduler-btn" onClick={handleRunScheduler} disabled={schedulerLoading || days.length === 0}>
              {schedulerLoading ? "Computing AI Logic..." : "🚀 Run AI Auto-Scheduler"}
            </button>
            <p className="ui-hint">
              Places students without a booking into the free slots, avoiding clashes.
            </p>

            <button className="run-scheduler-btn clear-btn" onClick={handleClearSchedule}>
              🗑️ Clear Full Schedule
            </button>
            <p className="ui-hint">
              Deletes every booking for your course. Use it to start the scheduling from scratch.
            </p>
            
            <button className="run-scheduler-btn notify-btn" onClick={handleNotifyLecturers} disabled={notifying}>
              {notifying ? "Sending Emails..." : "✉️ Notify All Lecturers"}
            </button>
            <p className="ui-hint">
              Emails every supervisor and examiner their slots. Send this once the timetable is final.
            </p>
          </div>
        </div>

        {/* === The big table below: Master Schedule === */}
        <div className="widget scheduling-span-2">
           <h3>3. Master Schedule</h3>
           <p className="ui-hint" style={{ marginTop: 0, marginBottom: '16px' }}>
             The result of everything above: every booked presentation for your course.
           </p>
           {/* We reuse PresentSchedulePage but pass a flag that hides its header */}
           <PresentSchedulePage hideHeader={true} />
        </div>
      </div>
    </div>
  );
}

export default TimetableScheduling;