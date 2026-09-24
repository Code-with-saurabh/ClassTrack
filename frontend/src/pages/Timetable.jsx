import { useState, useEffect } from 'react';
import { getTodayTimetable, getAllTimetable } from '../services/timetableService';
import { toastError } from '../utils/toastHelpers';

const Timetable = () => {
  const [todayTimetable, setTodayTimetable] = useState([]);
  const [weeklyTimetable, setWeeklyTimetable] = useState({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('today');

  useEffect(() => {
    const fetchTimetable = async () => {
      try {
        const [todayRes, weeklyRes] = await Promise.all([
          getTodayTimetable(),
          getAllTimetable()
        ]);
        setTodayTimetable(todayRes.data.data);

        const grouped = {};
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        days.forEach(day => { grouped[day] = []; });
        weeklyRes.data.data.forEach(entry => {
          if (grouped[entry.day]) {
            grouped[entry.day].push(entry);
          }
        });
        Object.keys(grouped).forEach(day => {
          grouped[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
        });
        setWeeklyTimetable(grouped);
      } catch (error) {
        console.error('Error fetching timetable:', error);
        toastError(error, 'Failed to load timetable');
      } finally {
        setLoading(false);
      }
    };
    fetchTimetable();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading timetable...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem' }}>Timetable</h2>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            className={`filter-btn ${view === 'today' ? 'active' : ''}`}
            onClick={() => setView('today')}
          >
            Today's Schedule
          </button>
          <button
            className={`filter-btn ${view === 'weekly' ? 'active' : ''}`}
            onClick={() => setView('weekly')}
          >
            Weekly View
          </button>
        </div>
      </div>

      {view === 'today' ? (
        <div className="card">
          <div className="card-header">
            <h3>Today's Classes</h3>
          </div>
          {todayTimetable.length === 0 ? (
            <div className="empty-state">
              <p>No classes scheduled for today</p>
            </div>
          ) : (
            todayTimetable.map((lecture) => (
              <div key={lecture._id} className="lecture-card">
                <div className="lecture-time">
                  {lecture.startTime} - {lecture.endTime}
                </div>
                <div className="lecture-info">
                  <h4>{lecture.subject?.name}</h4>
                  <p>{lecture.room} | {lecture.faculty?.userId?.name}</p>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="timetable-grid">
          {Object.entries(weeklyTimetable).map(([day, lectures]) => (
            <div key={day} className="timetable-day">
              <h4>{day}</h4>
              {lectures.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No classes</p>
              ) : (
                lectures.map((lecture) => (
                  <div key={lecture._id} className="timetable-slot">
                    <div className="time">{lecture.startTime} - {lecture.endTime}</div>
                    <div className="subject">{lecture.subject?.name}</div>
                    <div className="room">{lecture.room}</div>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Timetable;
