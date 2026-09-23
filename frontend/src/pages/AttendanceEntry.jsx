import { useState, useEffect, useMemo } from 'react';
import {
  getFacultyLectures,
  getLectureStudents,
  submitAttendance,
} from '../services/attendanceService';
import { todayKey, formatDate } from '../utils/helpers';

const AttendanceEntry = () => {
  const [date, setDate] = useState(todayKey());
  const [lectures, setLectures] = useState([]);
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchLectures = async (d) => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const { data } = await getFacultyLectures(d);
      setLectures(data.data.lectures || []);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to load lectures' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLectures(date);
    setSelectedLecture(null);
    setStudents([]);
    setAttendance({});
  }, [date]);

  const handleLectureSelect = async (lecture) => {
    setSelectedLecture(lecture);
    setMessage({ type: '', text: '' });
    try {
      const { data } = await getLectureStudents(lecture._id, date);
      setStudents(data.data.students);
      const initial = {};
      data.data.students.forEach((s) => {
        initial[s._id] = s.status === 'present' || s.status === 'absent' ? s.status : 'present';
      });
      setAttendance(initial);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to load students' });
    }
  };

  const counts = useMemo(() => {
    const values = Object.values(attendance);
    return {
      present: values.filter((v) => v === 'present').length,
      absent: values.filter((v) => v === 'absent').length,
    };
  }, [attendance]);

  const setAll = (status) => {
    const next = {};
    students.forEach((s) => {
      next[s._id] = status;
    });
    setAttendance(next);
  };

  const handleSubmit = async () => {
    if (!selectedLecture || students.length === 0) return;
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const records = Object.entries(attendance).map(([studentId, status]) => ({
        studentId,
        status,
      }));

      const { data } = await submitAttendance({
        subjectId: selectedLecture.subject._id,
        timetableId: selectedLecture._id,
        date,
        records,
      });

      const s = data.data?.stats;
      const parts = [];
      if (s?.created) parts.push(`${s.created} created`);
      if (s?.updated) parts.push(`${s.updated} updated`);
      if (s?.skipped) parts.push(`${s.skipped} already present`);

      setMessage({
        type: 'success',
        text: `Attendance saved for ${formatDate(date)}. ${parts.join(', ')}.`,
      });
      await fetchLectures(date);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to submit attendance' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && lectures.length === 0) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading lectures...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: '0.5rem' }}>Take Attendance</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Mark who is present and who is absent for a lecture. Attendance is stored per day.
      </p>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="toolbar-row">
          <div className="form-group" style={{ margin: 0 }}>
            <label>Date</label>
            <input
              type="date"
              value={date}
              max={todayKey()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <button className="btn btn-secondary" onClick={() => fetchLectures(date)}>
            Refresh
          </button>
        </div>
      </div>

      {message.text && (
        <div
          className={message.type === 'success' ? 'success-message' : 'error-state'}
          style={{ marginBottom: '1rem' }}
        >
          {message.text}
        </div>
      )}

      {!selectedLecture ? (
        <div className="card">
          <div className="card-header">
            <h3>Select a Lecture</h3>
            <span className="badge badge-secondary">
              {lectures.length} lecture(s) on {formatDate(date)}
            </span>
          </div>
          {lectures.length === 0 ? (
            <div className="empty-state">
              <p>No lectures scheduled for this date</p>
            </div>
          ) : (
            lectures.map((lecture) => (
              <div
                key={lecture._id}
                className="lecture-card"
                style={{ cursor: 'pointer' }}
                onClick={() => handleLectureSelect(lecture)}
              >
                <div className="lecture-time">
                  {lecture.startTime} - {lecture.endTime}
                </div>
                <div className="lecture-info">
                  <h4>{lecture.subject?.name}</h4>
                  <p>{lecture.room} | Division {lecture.division}</p>
                </div>
                {lecture.attendanceTaken && (
                  <span className="badge badge-success">Taken</span>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <div>
              <h3>{selectedLecture.subject?.name}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Division: {selectedLecture.division} | {formatDate(date)} |{' '}
                {selectedLecture.startTime} - {selectedLecture.endTime}
              </p>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSelectedLecture(null);
                setStudents([]);
                setAttendance({});
              }}
            >
              Change Lecture
            </button>
          </div>

          <div className="attendance-toolbar">
            <div className="attendance-counts">
              <span className="count-chip present-chip">Present: {counts.present}</span>
              <span className="count-chip absent-chip">Absent: {counts.absent}</span>
            </div>
            <div className="attendance-actions">
              <button className="btn btn-sm btn-present" onClick={() => setAll('present')}>
                Mark All Present
              </button>
              <button className="btn btn-sm btn-absent" onClick={() => setAll('absent')}>
                Mark All Absent
              </button>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Roll No.</th>
                  <th>Student Name</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student._id}>
                    <td>{student.rollNumber}</td>
                    <td>{student.userId?.name}</td>
                    <td>
                      <div className="attendance-toggle">
                        <button
                          className={`attendance-btn present ${attendance[student._id] === 'present' ? 'active' : ''}`}
                          onClick={() => setAttendance({ ...attendance, [student._id]: 'present' })}
                        >
                          Present
                        </button>
                        <button
                          className={`attendance-btn absent ${attendance[student._id] === 'absent' ? 'active' : ''}`}
                          onClick={() => setAttendance({ ...attendance, [student._id]: 'absent' })}
                        >
                          Absent
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={submitting || students.length === 0}
            >
              {submitting ? 'Submitting...' : `Save Attendance (${counts.present}P / ${counts.absent}A)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceEntry;