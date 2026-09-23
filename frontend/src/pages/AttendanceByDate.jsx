import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAttendanceByDate } from '../services/attendanceService';
import { getAllSubjects } from '../services/subjectService';
import { todayKey, formatDate } from '../utils/helpers';

const AttendanceByDate = () => {
  const { user } = useAuth();
  const [date, setDate] = useState(todayKey());
  const [subjectId, setSubjectId] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.role === 'admin') {
      getAllSubjects()
        .then(({ data }) => setSubjects(data.data || []))
        .catch(() => {});
    }
  }, [user]);

  const fetchReport = async (d, subj) => {
    setLoading(true);
    setError('');
    try {
      const params = { date: d };
      if (subj) params.subjectId = subj;
      const { data } = await getAttendanceByDate(params);
      setReport(data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load register');
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(date, subjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, subjectId]);

  return (
    <div>
      <div className="print-header">
        <h2>Daily Attendance Register</h2>
        <p>{report ? formatDate(report.date) : ''}</p>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        View who was present and absent across every lecture on a chosen date.
      </p>

      <div className="card no-print" style={{ marginBottom: '1.5rem' }}>
        <div className="toolbar-row">
          <div className="form-group" style={{ margin: 0 }}>
            <label>Quick Pick Date</label>
            <select
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-label="Quick pick a recent date"
            >
              <option value="">Pick a recent date...</option>
              {(() => {
                const days = [];
                const today = new Date();
                for (let i = 0; i < 14; i += 1) {
                  const d = new Date(today);
                  d.setDate(d.getDate() - i);
                  days.push(d);
                }
                return days.map((d) => {
                  const key = d.toISOString().slice(0, 10);
                  const label = d.toLocaleDateString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  });
                  return (
                    <option key={key} value={key}>
                      {label} ({key})
                    </option>
                  );
                });
              })()}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {user?.role === 'admin' && (
            <div className="form-group" style={{ margin: 0 }}>
              <label>Subject</label>
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">All Subjects</option>
                {subjects.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          )}
          <button className="btn btn-secondary" onClick={() => window.print()}>
            Download PDF
          </button>
        </div>
      </div>

      {error && <div className="error-state" style={{ marginBottom: '1rem' }}>{error}</div>}

      {loading && !report && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading register...</p>
        </div>
      )}

      {report && (
        <>
          <div className="card-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card">
              <div className="label">Lectures</div>
              <div className="value">{report.lectures.length}</div>
            </div>
            <div className="stat-card">
              <div className="label">Present</div>
              <div className="value" style={{ color: 'var(--success)' }}>{report.totals.present}</div>
            </div>
            <div className="stat-card">
              <div className="label">Absent</div>
              <div className="value" style={{ color: 'var(--danger)' }}>{report.totals.absent}</div>
            </div>
            <div className="stat-card">
              <div className="label">Unmarked</div>
              <div className="value">{report.totals.unmarked}</div>
            </div>
          </div>

          {report.lectures.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <p>No lectures scheduled on this date</p>
              </div>
            </div>
          ) : (
            report.lectures.map((lecture) => (
              <div className="card" key={lecture._id} style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                  <div>
                    <h3>
                      {lecture.subject?.name} ({lecture.subject?.code})
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      {lecture.startTime} - {lecture.endTime} | {lecture.room} | Division {lecture.division}
                      {lecture.faculty?.userId?.name ? ` | ${lecture.faculty.userId.name}` : ''}
                    </p>
                  </div>
                  <span className="badge badge-secondary">
                    P: {lecture.summary.present} A: {lecture.summary.absent} U: {lecture.summary.unmarked}
                  </span>
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
                      {lecture.students.map((student) => (
                        <tr key={student._id}>
                          <td>{student.rollNumber}</td>
                          <td>{student.userId?.name}</td>
                          <td>
                            {student.attendance === 'unmarked' ? (
                              <span className="badge badge-secondary">Unmarked</span>
                            ) : (
                              <span
                                className={`badge ${student.attendance === 'present' ? 'badge-success' : 'badge-danger'}`}
                              >
                                {student.attendance}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
};

export default AttendanceByDate;