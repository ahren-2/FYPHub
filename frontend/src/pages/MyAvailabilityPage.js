// --- File: src/pages/MyAvailabilityPage.js (Phase 3 增强版) ---
import React, { useState, useEffect } from 'react';
import api from '../api'; 
import moment from 'moment';
import './MyAvailabilityPage.css';
import { Callout, EmptyState, Legend } from '../components';

const generateTimeSlots = () => {
  const slots = [];
  let time = moment().startOf('day').hour(8);
  const endTime = moment().startOf('day').hour(17);
  while (time.isBefore(endTime)) {
    slots.push(time.format('HH:mm'));
    time.add(30, 'minutes');
  }
  return slots;
};

function MyAvailabilityPage() {
  const [bookings, setBookings] = useState([]);
  const [myProjects, setMyProjects] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [availableDates, setAvailableDates] = useState([]); 
  const [venues, setVenues] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null); 
  const [loading, setLoading] = useState(true);
  
  // 弹窗状态
  const [showModal, setShowModal] = useState(false);
  const [modalDetails, setModalDetails] = useState(null);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedExaminer, setSelectedExaminer] = useState('');

  const timeSlots = generateTimeSlots();

  // 1. 获取所有必要数据
  const fetchData = async () => {
    try {
      // 【修正】移除所有 API 请求的 '/api' 前缀
      const [bookRes, projRes, userRes, meRes, dayRes, venueRes] = await Promise.all([
        api.get('/bookings/'),
        api.get('/projects/'),
        api.get('/users/?profile__role=lecturer'),
        api.get('/user/me/'),
        api.get('/presentation-days/'),
        api.get('/venues/')
      ]);

      setBookings(bookRes.data);
      setMyProjects(projRes.data);
      setLecturers(userRes.data);
      setCurrentUserId(meRes.data.id);

      const datesFromDb = dayRes.data.map(d => d.date);
      setAvailableDates(datesFromDb);

      setVenues(venueRes.data);

      if (datesFromDb.length > 0 && !selectedDate) {
        setSelectedDate(datesFromDb[0]);
      }
    } catch (err) {
      console.error("Initialization error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // 2. 自动填入考官逻辑
  const handleProjectChange = (projectId) => {
    setSelectedProject(projectId);
    const project = myProjects.find(p => p.id === parseInt(projectId));
    if (project && project.examiner) {
      setSelectedExaminer(project.examiner); 
    } else {
      setSelectedExaminer('');
    }
  };

  // 3. 点击格子逻辑
  const handleSlotClick = (time, venueName, booking) => {
    if (booking) {
      // 检查是否是当前用户的预约
      const isMine = booking.lecturer === currentUserId || booking.examiner === currentUserId;
      if (!isMine) {
        // 满足老师要求：告知是谁预约了
        alert(`This slot is already booked by Lecturer: ${booking.lecturer_name}`);
      } else {
        alert(`Your Appointment: ${booking.student_name}\nProject: ${booking.project_title}`);
      }
      return;
    } 
    setModalDetails({ time, venue: venueName });
    setShowModal(true);
  };

  // 4. 提交预约
  const handleConfirmBooking = async () => {
        if (!selectedProject) { // 检查 examiner 是可选的
            alert("Please select a project.");
            return;
        }

        const start = moment.utc(`${selectedDate} ${modalDetails.time}`, 'YYYY-MM-DD HH:mm');
        const end = moment(start).add(30, 'minutes');

        const data = {
            project: selectedProject,
            examiner: selectedExaminer, // 如果为空，后端应能处理
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            venue: modalDetails.venue
        };

        try {
            await api.post('/bookings/', data);
            alert("Booking Successful!");
            setShowModal(false);
            setSelectedProject(''); 
            setSelectedExaminer('');
            fetchData(); // 调用 fetchData 刷新数据
        } catch (err) {
            alert("Booking failed - Conflict detected.");
        }
    };

  if (loading) return <div className="dashboard">Loading Booking System...</div>;

  return (
    <div className="grid-timetable-page">
      <div className="welcome-header">
        <h1>Presentation Booking System</h1>
        <p className="ui-page-subtitle">
          Pick a date, then click an <strong>Available</strong> cell to book a 30-minute presentation slot for one of
          your students. Each cell is one venue at one time.
        </p>
      </div>

      <Callout tone="plain" title="How booking works">
        The examiner is filled in automatically from the student’s project record, so you only need to choose the
        student. A slot can hold one presentation only — if a cell is taken, the tooltip shows which lecturer holds it.
        Contact the coordinator if you need a date or venue that is not listed.
      </Callout>
      
      <div className="date-selector">
        {availableDates.length > 0 ? (
          availableDates.map(date => (
            <button 
              key={date} 
              className={selectedDate === date ? 'active' : ''} 
              onClick={() => setSelectedDate(date)}
            >
              {moment(date).format('ddd, MMM Do')}
            </button>
          ))
        ) : (
          <div className="no-dates-alert">Waiting for Coordinator to set dates...</div>
        )}
      </div>

      {availableDates.length === 0 && (
        <EmptyState
          icon="🗓️"
          title="No presentation dates have been published yet"
          message="The FYP coordinator sets the presentation days and venues. Once they are published, the booking grid appears here and you can reserve a slot for each of your students."
        />
      )}

      {availableDates.length > 0 && (
        <>
          <Legend
            title="Cell colours"
            items={[
              { colour: '#ffffff', label: 'Available — click to book', tip: 'Empty. Click to open the booking form for this venue and time.' },
              { colour: '#e6f7ff', label: 'Your booking', tip: 'Booked by you, for one of your students.' },
              { colour: '#fafafa', label: 'Booked by another lecturer', tip: 'Already taken. The cell shows who booked it.' },
            ]}
          />
          <div className="timetable-grid-container">
            <div className="timetable-grid" style={{'--venue-count': venues.length}}>
              <div className="header-cell top-left-cell">Time / Venue</div>
              {venues.map(v => <div key={v.id} className="header-cell venue-header">{v.name}</div>)}

            {timeSlots.map(time => (
              <React.Fragment key={time}>
                <div className="header-cell time-header">{moment(time, 'HH:mm').format('hh:mm A')}</div>
                {/* 【优化】使用从 state 获取的 venues 渲染格子 */}
                {venues.map(venue => {
                  const booking = bookings.find(b => 
                      moment.utc(b.start_time).format('YYYY-MM-DD') === selectedDate && 
                      moment.utc(b.start_time).format('HH:mm') === time && 
                      b.venue === venue.name // 匹配 venue 名称
                  );

                  // 这里的 booking.lecturer 可能是一个 ID 或一个对象，取决于 Serializer 深度
                  const isMine = booking && (
                    (typeof booking.lecturer === 'object' ? booking.lecturer.id === currentUserId : booking.lecturer === currentUserId) || 
                    booking.examiner === currentUserId
                  );

                  return (
                    <div 
                      key={`${time}-${venue.id}`} 
                      className={`slot-cell ${booking ? (isMine ? 'booked-mine' : 'booked-others') : 'available'}`}
                      onClick={() => handleSlotClick(time, venue.name, booking)}
                    >
                      {booking ? (
                        isMine ? (
                          <div className="booking-info">
                            <strong>{booking.student_name}</strong>
                            <div className="booking-sub" title={booking.examiner_name ? `Examiner: ${booking.examiner_name}` : 'No examiner recorded'}>
                              {booking.examiner_name ? `Examiner: ${booking.examiner_name}` : 'Examiner: —'}
                            </div>
                          </div>
                        ) : (
                          // 【核心修改点】：根据老师建议，显示预约人的姓名
                          <div className="occupied-info">
                            <small>Booked by:</small>
                            <div className="lecturer-name-tag">{booking.lecturer_name || "Lecturer"}</div>
                          </div>
                        )
                      ) : (
                        <span className="available-text">Available</span>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          </div>
        </>
      )}

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2>New Booking</h2>
            <div className="modal-summary">
              <p><strong>Venue:</strong> {modalDetails.venue}</p>
              <p><strong>Time:</strong> {modalDetails.time}</p>
              <p><strong>Date:</strong> {selectedDate}</p>
            </div>
            
            <div className="form-group">
              <label>Select Project (Student):</label>
              <select value={selectedProject} onChange={e => handleProjectChange(e.target.value)}>
                <option value="">-- Choose Project --</option>
                {myProjects.map(p => <option key={p.id} value={p.id}>{p.student_name} - {p.title}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Examiner (Auto-filled):</label>
              <select value={selectedExaminer} disabled style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}>
                <option value="">-- Predefined by Project --</option>
                {lecturers.map(l => <option key={l.id} value={l.id}>{l.full_name}</option>)}
              </select>
            </div>

            <div className="modal-actions">
              <button className="save-button" onClick={handleConfirmBooking}>Confirm</button>
              <button className="cancel-button" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyAvailabilityPage;