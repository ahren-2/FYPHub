import React, { useState, useEffect } from 'react';
import api from '../api'; 
import moment from 'moment';
import './Dashboard.css';
import { EmptyState } from '../components';

function PresentSchedulePage({ hideHeader = false }) {
  const [schedule, setSchedule] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const initData = React.useCallback(async () => {
    try {
      // 【核心修正】: 移除了所有 '/api' 前缀
      const [userRes, schRes] = await Promise.all([
        api.get('/user/me/'),
        api.get('/bookings/')
      ]);
      setCurrentUser(userRes.data);
      setSchedule(schRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { initData(); }, [initData]);

  // 【修复点】：严谨的讲师身份识别
  const getLecturerRole = (slot) => {
    if (!currentUser || !slot.lecturer) return 'Guest';
    const myId = Number(currentUser.id);
    const supervisorId = Number(slot.lecturer.id || slot.lecturer);
    const examinerId = Number(slot.examiner);

    if (myId === supervisorId) return 'Supervisor';
    if (myId === examinerId) return 'Examiner';
    return 'Guest';
  };

  const handleExport = async () => {
    setExporting(true);
    try {
        // 【核心修正】: 调用新的导出接口
        const response = await api.get('/export-students-excel/', { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        // 从响应头获取文件名或使用默认名
        const contentDisposition = response.headers['content-disposition'];
        let filename = 'FYP_Schedule.xlsx';
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="(.+)"/);
            if (filenameMatch.length === 2)
                filename = filenameMatch[1];
        }
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
    } catch (err) { 
        alert("Export failed."); 
        console.error(err);
    } finally { 
        setExporting(false); 
    }
  };

  if (loading) return <div style={{padding:'20px'}}>Loading Presentation Schedule...</div>;

  return (
    <div className={hideHeader ? "" : "main-content"}>
      {!hideHeader && (
        <header>
          <h1>Final Presentation Schedule</h1>
          <p className="ui-page-subtitle">
            The official timetable for the upcoming presentation sessions. Slots are booked by supervisors during the
            booking window or filled automatically by the coordinator’s scheduler.
          </p>
        </header>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>Presentation List</h3>
            <p className="ui-hint" style={{ marginTop: '4px' }}>
              {schedule.length} presentation{schedule.length === 1 ? '' : 's'} scheduled.
              {currentUser?.role !== 'student' && ' The role column shows your part in each slot.'}
            </p>
          </div>
          {/* 所有角色可见的导出按钮 */}
          <button onClick={handleExport} className="btn-submit" disabled={exporting} style={{ backgroundColor: '#28a745', border:'none' }} title="Download this timetable as a spreadsheet">
            {exporting ? 'Generating...' : '📥 Export to Excel'}
          </button>
        </div>

        <div className="timetable-container">
          <table className="schedule-table">
            <thead>
              <tr>
                <th>Date</th><th>Time</th><th>Venue</th><th>ID</th><th>Student</th><th>Project Title</th>
                {/* 核心细节：学生不看角色列 */}
                {currentUser?.role !== 'student' && (
                  <th>
                    Your Role
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {schedule.map(slot => (
                <tr key={slot.id}>
                  <td>{moment(slot.start_time).format('YYYY-MM-DD')}</td>
                  <td>{`${moment(slot.start_time).format('hh:mm A')} - ${moment(slot.end_time).format('hh:mm A')}`}</td>
                  <td>{slot.venue}</td>
                  <td>{slot.student_id}</td>
                  <td style={{ fontWeight: 'bold' }}>{slot.student_name}</td> 
                  <td style={{ maxWidth: '250px', fontSize: '0.85rem' }} title={slot.project_title}>{slot.project_title}</td>
                  
                  {currentUser?.role !== 'student' && (
                    <td>
                      <span className="status submitted" style={{ 
                        background: getLecturerRole(slot) === 'Guest' ? '#f5f5f5' : '#e3f2fd',
                        color: getLecturerRole(slot) === 'Guest' ? '#888' : '#1565c0'
                      }}>
                        {getLecturerRole(slot)}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
              {schedule.length === 0 && (
                <tr>
                  <td colSpan={currentUser?.role === 'student' ? 6 : 7}>
                    <EmptyState
                      icon="📅"
                      title="No presentations scheduled yet"
                      message="The timetable appears once the coordinator publishes the presentation dates and bookings are made. Check back after the booking window opens."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default PresentSchedulePage;