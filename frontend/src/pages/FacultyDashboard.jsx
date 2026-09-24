import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getFacultySubjects } from '../services/facultyService';
import { getFacultyLectures } from '../services/attendanceService';
import { getGreeting } from '../utils/helpers';
import { toastError } from '../utils/toastHelpers';

const FacultyDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [subjectsRes, lecturesRes] = await Promise.all([
          getFacultySubjects(),
          getFacultyLectures()
        ]);
        setSubjects(subjectsRes.data.data);
        setLectures(lecturesRes.data.data.lectures);
      } catch (error) {
        console.error('Error fetching faculty data:', error);
        toastError(error, 'Failed to load faculty dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', color: 'white' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
          {getGreeting()}, {user?.name?.split(' ')[0]}
        </h2>
        <p style={{ opacity: 0.9 }}>Faculty Dashboard</p>
      </div>

      <div className="card-grid">
        <div className="stat-card">
          <div className="label">Assigned Subjects</div>
          <div className="value">{subjects.length}</div>
          <div className="subtext">Active courses</div>
        </div>

        <div className="stat-card">
          <div className="label">Today's Lectures</div>
          <div className="value">{lectures.length}</div>
          <div className="subtext">Scheduled today</div>
        </div>

        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/faculty/attendance')}>
          <div className="label">Take Attendance</div>
          <div className="value" style={{ color: 'var(--primary)' }}>→</div>
          <div className="subtext">Mark attendance for your lectures</div>
        </div>

        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/faculty/marks')}>
          <div className="label">Enter Marks</div>
          <div className="value" style={{ color: 'var(--primary)' }}>→</div>
          <div className="subtext">Manage mid-exam marks</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h3>Assigned Subjects</h3>
          </div>
          {subjects.length === 0 ? (
            <div className="empty-state">
              <p>No subjects assigned</p>
            </div>
          ) : (
            subjects.map((subject) => (
              <div key={subject._id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600 }}>{subject.name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {subject.code} | Semester {subject.semester}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Today's Lectures</h3>
          </div>
          {lectures.length === 0 ? (
            <div className="empty-state">
              <p>No lectures scheduled for today</p>
            </div>
          ) : (
            lectures.map((lecture) => (
              <div key={lecture._id} className="lecture-card" style={{ cursor: 'pointer' }}
                   onClick={() => navigate('/faculty/attendance')}>
                <div className="lecture-time">
                  {lecture.startTime} - {lecture.endTime}
                </div>
                <div className="lecture-info">
                  <h4>{lecture.subject?.name}</h4>
                  <p>{lecture.room} | Division {lecture.division}</p>
                </div>
                {lecture.attendanceTaken && <span className="badge badge-success">Taken</span>}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h3>Quick Actions</h3>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => navigate('/faculty/attendance')}>
            Take Attendance
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/faculty/analytics')}>
            View Analytics
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/faculty/marks')}>
            Enter Marks
          </button>
        </div>
      </div>
    </div>
  );
};

export default FacultyDashboard;
