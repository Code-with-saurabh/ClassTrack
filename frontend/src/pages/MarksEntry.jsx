import { useState, useEffect } from 'react';
import { getFacultySubjects } from '../services/facultyService';
import { getAttendanceAnalytics } from '../services/attendanceService';
import { createMarks } from '../services/marksService';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import { toastError, toastSuccess, toastValidation, getApiErrorMessage } from '../utils/toastHelpers';

const EXAM_TYPES = ['Mid-term', 'Assignment', 'Quiz'];
const PER_PAGE = 10;

const MarksEntry = () => {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [students, setStudents] = useState([]);
  const [examType, setExamType] = useState('Mid-term');
  const [maximumMarks, setMaximumMarks] = useState(30);
  const [marksData, setMarksData] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const { data } = await getFacultySubjects();
        setSubjects(data.data);
      } catch (error) {
        console.error('Error fetching subjects:', error);
        toastError(error, 'Failed to load subjects');
      } finally {
        setLoading(false);
      }
    };

    loadSubjects();
  }, []);

  // Subject select karne par uski class ki student list load karo
  const handleSubjectChange = async (subjectId) => {
    setSelectedSubject(subjectId);

    if (!subjectId) {
      setStudents([]);
      setMarksData({});
      return;
    }

    try {
      const { data } = await getAttendanceAnalytics({ subjectId, filter: 'all' });
      const studentList = data.data.students;
      setStudents(studentList);

      const emptyMarks = {};
      studentList.forEach((item) => {
        emptyMarks[item.student?._id] = '';
      });
      setMarksData(emptyMarks);

      toastSuccess(`Class loaded: ${studentList.length} students.`);
    } catch (error) {
      console.error('Error fetching students:', error);
      toastError(error, 'Failed to load class students');
      setStudents([]);
      setMarksData({});
    }
  };

  const handleMarksChange = (studentId, value) => {
    const max = parseInt(maximumMarks, 10);
    const isEmpty = value === '';
    const inRange = parseInt(value, 10) >= 0 && parseInt(value, 10) <= max;

    if (isEmpty || inRange) {
      setMarksData({ ...marksData, [studentId]: value });
    }
  };

  const handleSubmit = async () => {
    if (!selectedSubject) {
      toastValidation('Please select a subject first.');
      return;
    }

    const max = parseInt(maximumMarks, 10);
    if (!max || max < 1) {
      toastValidation('Maximum marks must be at least 1.');
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      // Sirf unhi students ke marks bhejo jinke boxes bhare hain
      const filledEntries = Object.entries(marksData).filter(([, value]) => value !== '');

      if (filledEntries.length === 0) {
        toastValidation('Please enter marks for at least one student.');
        setMessage({ type: 'error', text: 'Please enter marks for at least one student' });
        setSubmitting(false);
        return;
      }

      const hasInvalid = filledEntries.some(([, value]) => {
        const marks = parseInt(value, 10);
        return Number.isNaN(marks) || marks < 0 || marks > max;
      });
      if (hasInvalid) {
        toastValidation(`Marks must be between 0 and ${max}.`);
        setSubmitting(false);
        return;
      }

      const marksArray = filledEntries.map(([studentId, marksObtained]) => ({
        studentId,
        subjectId: selectedSubject,
        examType,
        marksObtained: parseInt(marksObtained, 10),
        maximumMarks: max,
      }));

      // Ek-ek karke save (backend upsert karta hai)
      for (const marks of marksArray) {
        await createMarks(marks);
      }

      const successMsg = `Marks saved for ${marksArray.length} students!`;
      setMessage({ type: 'success', text: successMsg });
      toast.success(successMsg);

      setTimeout(() => {
        setMessage({ type: '', text: '' });
        setMarksData({});
      }, 2000);
    } catch (error) {
      const msg = getApiErrorMessage(error, 'Failed to save marks');
      setMessage({ type: 'error', text: msg });
      toastError(error, 'Failed to save marks');
    } finally {
      setSubmitting(false);
    }
  };

  const { page, setPage, total: studentTotal, pageItems: studentPage } = usePagination(students, PER_PAGE);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading subjects...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem' }}>Enter Mid-Exam Marks</h2>

      {message.text && (
        <div className={message.type === 'success' ? 'success-message' : 'error-state'} style={{ marginBottom: '1rem' }}>
          {message.text}
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="form-row">
          <div className="form-group">
            <label>Select Subject</label>
            <select value={selectedSubject || ''} onChange={(e) => handleSubjectChange(e.target.value)}>
              <option value="">Choose a subject</option>
              {subjects.map((subject) => (
                <option key={subject._id} value={subject._id}>
                  {subject.name} ({subject.code})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Exam Type</label>
            <select value={examType} onChange={(e) => setExamType(e.target.value)}>
              {EXAM_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Maximum Marks</label>
            <input
              type="number"
              value={maximumMarks}
              onChange={(e) => setMaximumMarks(e.target.value)}
              min="1"
            />
          </div>
        </div>
      </div>

      {selectedSubject && students.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Enter Marks</h3>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Roll No.</th>
                  <th>Student Name</th>
                  <th>Marks Obtained (/{maximumMarks})</th>
                </tr>
              </thead>
              <tbody>
                {studentPage.map((item) => (
                  <tr key={item.student?._id}>
                    <td>{item.student?.rollNumber}</td>
                    <td>{item.student?.userId?.name}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max={maximumMarks}
                        value={marksData[item.student?._id] || ''}
                        onChange={(e) => handleMarksChange(item.student?._id, e.target.value)}
                        placeholder="Enter marks"
                        style={{ width: '120px' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination current={page} total={studentTotal} perPage={PER_PAGE} onPageChange={setPage} />

          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Save Marks'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarksEntry;
