import { useState, useEffect, useMemo } from 'react';
import {
  getFacultyLectures,
  getLectureStudents,
  submitAttendance,
} from '../services/attendanceService';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import { todayKey, formatDate } from '../utils/helpers';
import { toastError, toastSuccess, toastValidation, toastWarning, getApiErrorMessage } from '../utils/toastHelpers';

const LECTURES_PER_PAGE = 5;
const STUDENTS_PER_PAGE = 10;

const AttendanceEntry = () => {
  const [date, setDate] = useState(todayKey());
  const [lectures, setLectures] = useState([]);
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Date ki lectures load karo
  const fetchLectures = async (targetDate) => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const { data } = await getFacultyLectures(targetDate);
      const lectureList = data.data.lectures || [];
      setLectures(lectureList);

      if (lectureList.length === 0) {
        toastWarning(`No lectures scheduled on ${formatDate(targetDate)}.`);
      }
    } catch (error) {
      const msg = getApiErrorMessage(error, 'Failed to load lectures');
      setMessage({ type: 'error', text: msg });
      toastError(error, 'Failed to load lectures');
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

  // Lecture chunte hi uski class ki student list + default "present" load karo
  const handleLectureSelect = async (lecture) => {
    setSelectedLecture(lecture);
    setMessage({ type: '', text: '' });

    try {
      const { data } = await getLectureStudents(lecture._id, date);
      const studentList = data.data.students;
      setStudents(studentList);

      const initialAttendance = {};
      studentList.forEach((student) => {
        const saved = student.status;
        initialAttendance[student._id] = saved === 'present' || saved === 'absent' ? saved : 'present';
      });
      setAttendance(initialAttendance);

      toastSuccess(`Loaded ${studentList.length} students for ${lecture.subject?.name || 'lecture'}.`);
    } catch (error) {
      const msg = getApiErrorMessage(error, 'Failed to load students');
      setMessage({ type: 'error', text: msg });
      toastError(error, 'Failed to load students');
    }
  };

  const counts = useMemo(() => {
    const values = Object.values(attendance);
    return {
      present: values.filter((v) => v === 'present').length,
      absent: values.filter((v) => v === 'absent').length,
    };
  }, [attendance]);

  const {
    page: lecturePageNum,
    setPage: setLecturePage,
    total: lectureTotal,
    pageItems: lecturePageItems,
  } = usePagination(lectures, LECTURES_PER_PAGE);

  const {
    page: studentPageNum,
    setPage: setStudentPage,
    total: studentTotal,
    pageItems: studentPageItems,
  } = usePagination(students, STUDENTS_PER_PAGE);

  // Ek click me sabko present / absent
  const setAll = (status) => {
    if (students.length === 0) {
      toastValidation('No students loaded yet. Select a lecture first.');
      return;
    }

    const next = {};
    students.forEach((student) => {
      next[student._id] = status;
    });
    setAttendance(next);
    toast.success(`All ${students.length} students marked ${status}.`, { id: 'mark-all-status' });
  };

  const clearLectureSelection = () => {
    setSelectedLecture(null);
    setStudents([]);
    setAttendance({});
  };

  const validateSubmit = () => {
    if (!selectedLecture || students.length === 0) {
      toastValidation('Select a lecture with students first.');
      return false;
    }
    if (new Date(date) > new Date(todayKey())) {
      toastValidation('Attendance cannot be marked for a future date.');
      return false;
    }

    const unmarked = students.filter((s) => !attendance[s._id]).length;
    if (unmarked > 0) {
      toastValidation(`Please set a status for all students (${unmarked} still unmarked).`);
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateSubmit()) return;

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

      // Server ka stats dikhao: kitne created / updated / skipped
      const stats = data.data?.stats;
      const parts = [];
      if (stats?.created) parts.push(`${stats.created} created`);
      if (stats?.updated) parts.push(`${stats.updated} updated`);
      if (stats?.skipped) parts.push(`${stats.skipped} already present`);

      const successMsg = `Attendance saved for ${formatDate(date)}. ${parts.join(', ')}.`;
      setMessage({ type: 'success', text: successMsg });
      toast.success(successMsg);

      await fetchLectures(date);
    } catch (error) {
      const msg = getApiErrorMessage(error, 'Failed to submit attendance');
      setMessage({ type: 'error', text: msg });
      toastError(error, 'Failed to submit attendance');
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
            <button className="btn btn-secondary" onClick={clearLectureSelection}>
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
