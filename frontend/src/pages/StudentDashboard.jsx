import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getTodayTimetable } from '../services/timetableService';
import { getStudentAttendance } from '../services/attendanceService';
import { getStudentMarks } from '../services/marksService';
import { getStudentProfile } from '../services/studentService';
import { getGreeting, getAttendanceColor } from '../utils/helpers';

const StudentDashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [timetable, setTimetable] = useState([]);
  const [attendance, setAttendance] = useState({ percentage: 0, subjectWise: [] });
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, timetableRes, attendanceRes, marksRes] = await Promise.all([
          getStudentProfile(),
          getTodayTimetable(),
          getStudentAttendance(user?.id || user?.profile?.userId),
          getStudentMarks(user?.id || user?.profile?.userId)
        ]);
        setProfile(profileRes.data.data);
        setTimetable(timetableRes.data.data);
        setAttendance(attendanceRes.data.data);
        setMarks(marksRes.data.data);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const lowAttendance = attendance.subjectWise?.filter(s => s.percentage < 75) || [];

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
          {getGreeting()}, {user?.name?.split(' ')[0]}
        </h2>
        <p style={{ opacity: 0.9 }}>
          Semester {profile?.semester} | {profile?.department} | Division {profile?.division}
        </p>
      </div>

      <div className="card-grid">
        <div className="stat-card">
          <div className="label">Overall Attendance</div>
          <div className="value" style={{ color: getAttendanceColor(attendance.percentage) }}>
            {attendance.percentage}%
          </div>
          <div className="subtext">Across all subjects</div>
        </div>

        <div className="stat-card">
          <div className="label">Roll Number</div>
          <div className="value">{profile?.rollNumber}</div>
          <div className="subtext">Academic Year: {profile?.academicYear}</div>
        </div>

        <div className="stat-card">
          <div className="label">Today's Classes</div>
          <div className="value">{timetable.length}</div>
          <div className="subtext">Lectures scheduled</div>
        </div>

        <div className="stat-card">
          <div className="label">Subjects</div>
          <div className="value">{attendance.subjectWise?.length || 0}</div>
          <div className="subtext">Active this semester</div>
        </div>
      </div>

      {lowAttendance.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h3>⚠️ Attendance Warning</h3>
          </div>
          {lowAttendance.map((sub) => (
            <div key={sub._id} className="warning-card">
              <div className="title">Low Attendance Alert</div>
              <div className="detail">
                Attendance: {sub.percentage}% (Required: 75%)
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h3>Today's Timetable</h3>
          </div>
          {timetable.length === 0 ? (
            <div className="empty-state">
              <p>No classes scheduled for today</p>
            </div>
          ) : (
            timetable.map((lecture) => (
              <div key={lecture._id} className="lecture-card">
                <div className="lecture-time">
                  {lecture.startTime} - {lecture.endTime}
                </div>
                <div className="lecture-info">
                  <h4>{lecture.subject?.name}</h4>
                  <p>{lecture.room}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Subject Attendance</h3>
          </div>
          {attendance.subjectWise?.length === 0 ? (
            <div className="empty-state">
              <p>No attendance records yet</p>
            </div>
          ) : (
            attendance.subjectWise?.map((sub) => (
              <div key={sub._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                <span>{sub.subject?.name || 'Unknown Subject'}</span>
                <span style={{ fontWeight: 600, color: getAttendanceColor(sub.percentage) }}>
                  {sub.percentage}%
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {marks.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h3>Mid-Exam Marks</h3>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Exam Type</th>
                  <th>Marks</th>
                  <th>Maximum</th>
                  <th>Percentage</th>
                </tr>
              </thead>
              <tbody>
                {marks.map((mark) => (
                  <tr key={mark._id}>
                    <td>{mark.subject?.name}</td>
                    <td>{mark.examType}</td>
                    <td>{mark.marksObtained}</td>
                    <td>{mark.maximumMarks}</td>
                    <td style={{ fontWeight: 600 }}>
                      {Math.round((mark.marksObtained / mark.maximumMarks) * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
