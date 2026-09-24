import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getClassReport } from '../services/attendanceService';
import { getFacultySubjects } from '../services/facultyService';
import { getAllSubjects } from '../services/subjectService';
import { getAttendanceColor } from '../utils/helpers';
import { toastError, toastSuccess, toastValidation, getApiErrorMessage } from '../utils/toastHelpers';

const AttendanceReport = () => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [sortBy, setSortBy] = useState('percentage');
  const [order, setOrder] = useState('asc');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = user?.role === 'admin' ? getAllSubjects() : getFacultySubjects();
    load
      .then(({ data }) => {
        setSubjects(data.data || []);
        if (data.data?.length) {
          setSubjectId(data.data[0]._id);
        } else {
          toastValidation('No subjects available for report.');
        }
      })
      .catch((err) => toastError(err, 'Failed to load subjects'));
  }, [user]);

  useEffect(() => {
    if (!subjectId) return;
    const minN = min === '' ? null : Number(min);
    const maxN = max === '' ? null : Number(max);
    if (minN !== null && (minN < 0 || minN > 100)) {
      toastValidation('Min % must be between 0 and 100.');
      return;
    }
    if (maxN !== null && (maxN < 0 || maxN > 100)) {
      toastValidation('Max % must be between 0 and 100.');
      return;
    }
    if (minN !== null && maxN !== null && minN > maxN) {
      toastValidation('Min % cannot be greater than Max %.');
      return;
    }
    setLoading(true);
    setError('');
    getClassReport({ subjectId, min: min || undefined, max: max || undefined, sortBy, order })
      .then(({ data }) => setReport(data.data))
      .catch((err) => {
        const msg = getApiErrorMessage(err, 'Failed to load report');
        setError(msg);
        toastError(err, 'Failed to load report');
      })
      .finally(() => setLoading(false));
  }, [subjectId, min, max, sortBy, order]);

  const stats = report?.stats;

  return (
    <div>
      <div className="print-header">
        <h2>Attendance Report</h2>
        <p>{report?.subject?.name || ''}</p>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Filter the class by attendance percentage and export a formatted PDF.
      </p>

      <div className="card no-print" style={{ marginBottom: '1.5rem' }}>
        <div className="toolbar-row">
          <div className="form-group" style={{ margin: 0 }}>
            <label>Subject</label>
            <select value={subjectId || ''} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Choose a subject</option>
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, width: '110px' }}>
            <label>Min %</label>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="0"
              value={min}
              onChange={(e) => setMin(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ margin: 0, width: '110px' }}>
            <label>Max %</label>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="100"
              value={max}
              onChange={(e) => setMax(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Sort By</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="percentage">Percentage</option>
              <option value="rollNumber">Roll Number</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Order</label>
            <select value={order} onChange={(e) => setOrder(e.target.value)}>
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
          <button className="btn btn-secondary" onClick={() => {
            toastSuccess('Opening print dialog — choose "Save as PDF" to export.');
            setTimeout(() => window.print(), 300);
          }} disabled={!report}>
            Download PDF
          </button>
        </div>
      </div>

      {error && <div className="error-state" style={{ marginBottom: '1rem' }}>{error}</div>}

      {loading && !report && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading report...</p>
        </div>
      )}

      {report && (
        <>
          <div className="card-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card">
              <div className="label">Students Shown</div>
              <div className="value">{stats.totalStudents}</div>
            </div>
            <div className="stat-card">
              <div className="label">Average</div>
              <div className="value">{stats.avgAttendance}%</div>
            </div>
            <div className="stat-card">
              <div className="label">Above Threshold</div>
              <div className="value" style={{ color: 'var(--success)' }}>{stats.above75}</div>
            </div>
            <div className="stat-card">
              <div className="label">Below 75% (At Risk)</div>
              <div className="value" style={{ color: 'var(--danger)' }}>{stats.below75}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Class Performance</h3>
              <span className="badge badge-secondary">{report.students.length} student(s)</span>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Roll No.</th>
                    <th>Student Name</th>
                    <th>Present</th>
                    <th>Total</th>
                    <th>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {report.students.map((item, index) => (
                    <tr key={item.student?._id}>
                      <td>{index + 1}</td>
                      <td>{item.student?.rollNumber}</td>
                      <td>{item.student?.userId?.name}</td>
                      <td>{item.present}</td>
                      <td>{item.total}</td>
                      <td>
                        <div className="progress-cell">
                          <div className="progress-bar">
                            <div
                              className="progress-fill"
                              style={{ width: `${item.percentage}%`, background: getAttendanceColor(item.percentage) }}
                            ></div>
                          </div>
                          <span style={{ fontWeight: 600, color: getAttendanceColor(item.percentage), minWidth: '3rem' }}>
                            {item.percentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AttendanceReport;