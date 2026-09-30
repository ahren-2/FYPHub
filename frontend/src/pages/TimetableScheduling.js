import React, { useState, useEffect } from 'react';
import api from '../api';
import moment from 'moment';
import PresentSchedulePage from './PresentSchedulePage'; // 复用结果表格组件
import './Dashboard.css';
import './TimetableScheduling.css';
import { Callout } from '../components';

function TimetableScheduling() {
  const [days, setDays] = useState([]);
  const [venues, setVenues] = useState([]);
  const [newSlot, setNewSlot] = useState({ date: '', name: '' });
  const [loading, setLoading] = useState(true);
  const [schedulerLoading, setSchedulerLoading] = useState(false);
  const [notifying, setNotifying] = useState(false);

  // 1. 获取基础配置数据
  const fetchData = async () => {
    try {
      const [dayRes, venueRes] = await Promise.all([
        api.get('/presentation-days/'),
        api.get('/venues/')
      ]);
      setDays(dayRes.data);
      setVenues(venueRes.data);
    } catch (err) { console.error("Fetch infrastructure failed", err); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // 2. 添加/删除基础设施逻辑
  const handleAddSlot = async (e) => {
    e.preventDefault();
    if (!newSlot.date || !newSlot.name) {
        return alert("Date and Venue name are required.");
    }
    try {
        await api.post('/presentation-days/', { date: newSlot.date });
        
        await api.post('/venues/', { name: newSlot.name });

        setNewSlot({ date: '', name: '' });
        fetchData();
    } catch (err) {
        alert("Error adding slot. The date or venue might already exist for another course, or the input is invalid.");
        console.error("Add Slot Error:", err);
    }
  };

  const handleDeleteItem = async (type, id) => {
    if (window.confirm(`Are you sure you want to delete this ${type}?`)) {
      const url = type === 'day' ? `/presentation-days/${id}/` : `/venues/${id}/`;
      await api.delete(url);
      fetchData();
    }
  };

  // 3. 核心控制逻辑：AI 与 邮件
  const handleRunScheduler = async () => {
    if (window.confirm("Run AI Auto-Scheduler? This will fill empty slots...")) {
      setSchedulerLoading(true);
      try {
        // 【核心修正】: 移除了 '/api' 前缀
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
        window.location.reload(); // 刷新页面以清空下方的表格
      } catch (err) {
        alert("Failed to clear schedule. Check backend log.");
      }
    }
  };

  const handleNotifyLecturers = async () => {
    if (window.confirm("Send email reminders to all scheduled staff?")) {
      setNotifying(true);
      try {
        // 【核心修正】: 移除了 '/api' 前缀
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

      <div className="widget-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
        
        {/* === 格子 1: Infrastructure Setup (左上) === */}
        <div className="widget">
          <h3>1. Setup Presentation Slots</h3>
          <p style={{fontSize:'0.9rem', color:'#6c757d', margin:'0 0 20px 0'}}>
            Add combinations of dates and venues. The same date can have multiple venues.
            {days.length > 0 || venues.length > 0
              ? <> Currently configured: <strong>{days.length}</strong> day{days.length === 1 ? '' : 's'} and <strong>{venues.length}</strong> venue{venues.length === 1 ? '' : 's'}.</>
              : ' Nothing is configured yet.'}
          </p>
          
          <form onSubmit={handleAddSlot} style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
            <input 
              type="date" 
              className="login-input" 
              value={newSlot.date} 
              onChange={e => setNewSlot({...newSlot, date: e.target.value})} 
              required 
            />
            <input 
              type="text" 
              className="login-input" 
              placeholder="Venue Name (e.g., CL3)" 
              value={newSlot.name} 
              onChange={e => setNewSlot({...newSlot, name: e.target.value})} 
              required 
            />
            <button type="submit" className="save-button" style={{ width: '100px' }}>Add Slot</button>
          </form>
          
          <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="mini-list">
              <strong>Configured Slots:</strong>
              {/* 这里可以显示一个整合后的列表 */}
              {days.map(d => (
                  <div key={d.id} className="item-row-parent">
                      <strong>{moment(d.date).format('MMMM DD, YYYY')}</strong>
                      <span className="del-icon" onClick={() => handleDeleteItem('day', d.id)}>Delete Day</span>
                  </div>
              ))}
               {venues.map(v => (
                  <div key={v.id} className="item-row">
                    • Venue: {v.name} 
                    <span className="del-icon" onClick={() => handleDeleteItem('venue', v.id)}>×</span>
                  </div>
                ))}
          </div>
        </div>
        </div>

        {/* === 格子 2: AI Control Center (右上) === */}
        <div className="widget" style={{ backgroundColor: '#f0f7ff', border: '1px dashed #1890ff', textAlign: 'center' }}>
          <h3>2. AI &amp; Communication</h3>
          <p style={{ margin: '18px 0', fontSize: '0.9rem', color: '#555' }}>
            Finalise the schedule and notify the faculty.
            {days.length === 0 && ' The scheduler cannot run until you add at least one presentation day in panel 1.'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '0 30px' }}>
            <button className="run-scheduler-btn" onClick={handleRunScheduler} disabled={schedulerLoading || days.length === 0}>
              {schedulerLoading ? "Computing AI Logic..." : "🚀 Run AI Auto-Scheduler"}
            </button>
            <p className="ui-hint" style={{ margin: '0 0 4px 0', textAlign: 'left' }}>
              Places students without a booking into the free slots, avoiding clashes.
            </p>

            <button className="run-scheduler-btn clear-btn" onClick={handleClearSchedule}>
              🗑️ Clear Full Schedule
            </button>
            <p className="ui-hint" style={{ margin: '0 0 4px 0', textAlign: 'left' }}>
              Deletes every booking for your course. Use it to start the scheduling from scratch.
            </p>
            
            <button className="run-scheduler-btn" onClick={handleNotifyLecturers} disabled={notifying} style={{ background: 'linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)' }}>
              {notifying ? "Sending Emails..." : "✉️ Notify All Lecturers"}
            </button>
            <p className="ui-hint" style={{ margin: 0, textAlign: 'left' }}>
              Emails every supervisor and examiner their slots. Send this once the timetable is final.
            </p>
          </div>
        </div>

        {/* === 下方大表: Master Schedule === */}
        <div className="widget" style={{ gridColumn: 'span 2' }}>
           <h3>3. Master Schedule</h3>
           <p className="ui-hint" style={{ marginTop: 0, marginBottom: '16px' }}>
             The result of everything above: every booked presentation for your course.
           </p>
           {/* 我们复用 PresentSchedulePage，但传入参数隐藏它的 Header */}
           <PresentSchedulePage hideHeader={true} />
        </div>
      </div>
    </div>
  );
}

export default TimetableScheduling;