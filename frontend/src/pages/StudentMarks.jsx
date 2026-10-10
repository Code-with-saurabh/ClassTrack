import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getStudentMarks } from '../services/marksService';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import { toastError } from '../utils/toastHelpers';

const PER_PAGE = 10;

const StudentMarks = () => {
  const { user } = useAuth();
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMarks = async () => {
      try {
        const { data } = await getStudentMarks(user?.id || user?.profile?.userId);
        setMarks(data.data);
      } catch (error) {
        console.error('Error fetching marks:', error);
        toastError(error, 'Failed to load marks');
      } finally {
        setLoading(false);
      }
    };

    loadMarks();
  }, [user]);

  const { page, setPage, total, pageItems } = usePagination(marks, PER_PAGE);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading marks...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem' }}>My Marks</h2>

      <div className="card">
        <div className="card-header">
          <h3>Mid-Examination Results</h3>
        </div>

        {marks.length === 0 ? (
          <div className="empty-state">
            <p>No marks available yet</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Code</th>
                  <th>Exam Type</th>
                  <th>Marks Obtained</th>
                  <th>Maximum Marks</th>
                  <th>Percentage</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((mark) => {
                  const percentage = Math.round((mark.marksObtained / mark.maximumMarks) * 100);
                  const isPass = percentage >= 50;

                  return (
                    <tr key={mark._id}>
                      <td>{mark.subject?.name}</td>
                      <td>{mark.subject?.code}</td>
                      <td>{mark.examType}</td>
                      <td style={{ fontWeight: 600 }}>{mark.marksObtained}</td>
                      <td>{mark.maximumMarks}</td>
                      <td style={{ fontWeight: 600, color: isPass ? 'var(--success)' : 'var(--danger)' }}>
                        {percentage}%
                      </td>
                      <td>
                        <span className={`badge ${isPass ? 'badge-success' : 'badge-danger'}`}>
                          {isPass ? 'Pass' : 'Fail'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {marks.length > 0 && (
          <Pagination current={page} total={total} perPage={PER_PAGE} onPageChange={setPage} />
        )}
      </div>
    </div>
  );
};

export default StudentMarks;
