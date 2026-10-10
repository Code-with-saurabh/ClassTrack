import { useState, useEffect, useMemo } from 'react';
import {
  getFacultySubjects,
} from '../services/facultyService';
import {
  getAttendanceAnalytics,
  getStudentAttendance,
} from '../services/attendanceService';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { getAttendanceColor } from '../utils/helpers';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import { toastError, toastSuccess, getApiErrorMessage } from '../utils/toastHelpers';

const CATEGORY_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
const PER_PAGE = 10;

const FILTERS = [
  { value: 'all', label: 'All Students' },
  { value: 'below75', label: 'Below 75%' },
  { value: '75to80', label: '75% - 80%' },
  { value: '80to90', label: '80% - 90%' },
  { value: 'above90', label: 'Above 90%' },
];

const ChartCard = ({ title, subtitle, children }) => (
  <div className="card">
    <div className="card-header">
      <h3>{title}</h3>
      {subtitle && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{subtitle}</p>
      )}
    </div>
    {children}
  </div>
);

const StudentDetailModal = ({ student, detail, loading, onClose }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h3>Student Attendance Detail</h3>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      ) : (
        detail && (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <p><strong>Name:</strong> {student.student?.userId?.name}</p>
              <p><strong>Roll No:</strong> {student.student?.rollNumber}</p>
              <p>
                <strong>Overall Attendance:</strong>{' '}
                <span style={{ color: getAttendanceColor(detail.percentage) }}>
                  {detail.percentage}%
                </span>
              </p>
            </div>

            <h4 style={{ marginBottom: '0.75rem' }}>Subject-wise Attendance</h4>
            {detail.subjectWise?.length ? (
              detail.subjectWise.map((sub) => (
                <div key={sub._id} className="modal-row">
                  <span>{sub.subject?.name || 'Unknown Subject'}</span>
                  <span style={{ fontWeight: 600, color: getAttendanceColor(sub.percentage) }}>
                    {sub.percentage}%
                  </span>
                </div>
              ))
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>No subject-wise data</p>
            )}

            <h4 style={{ marginTop: '1rem', marginBottom: '0.75rem' }}>Recent History</h4>
            <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Subject</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.attendance?.slice(0, 10).map((record) => (
                    <tr key={record._id}>
                      <td>{new Date(record.date).toLocaleDateString()}</td>
                      <td>{record.subject?.name}</td>
                      <td>
                        <span
                          className={`badge ${record.status === 'present' ? 'badge-success' : 'badge-danger'}`}
                        >
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      )}
    </div>
  </div>
);

const AttendanceAnalytics = () => {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [subjectAverages, setSubjectAverages] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [studentLoading, setStudentLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Saare subject averages ek saath load karo (Subject Averages chart ke liye)
  const loadSubjectAverages = async (subjectList) => {
    const results = await Promise.allSettled(
      subjectList.map((s) => getAttendanceAnalytics({ subjectId: s._id }))
    );

    const averages = results
      .map((result, index) => ({
        name: subjectList[index]?.code || subjectList[index]?.name,
        avg: result.status === 'fulfilled'
          ? result.value?.data?.data?.stats?.avgAttendance || 0
          : 0,
      }))
      .filter((item) => item.avg > 0);

    setSubjectAverages(averages);
  };

  const fetchAnalytics = async (subjectId, filterType, { notify = false } = {}) => {
    setAnalyticsLoading(true);

    try {
      const { data } = await getAttendanceAnalytics({
        subjectId,
        filter: filterType,
        date: appliedFrom && appliedFrom === appliedTo ? appliedFrom : undefined,
        from: appliedFrom && appliedFrom !== appliedTo ? appliedFrom : undefined,
        to: appliedTo && appliedFrom !== appliedTo ? appliedTo : undefined,
      });

      setAnalytics(data.data);

      if (notify) {
        toastSuccess(`Analytics loaded for ${data.data?.subject?.code || 'subject'}`);
      }

      return data.data;
    } catch (error) {
      toastError(error, 'Failed to load analytics');
      throw error;
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const { data } = await getFacultySubjects();
        const subjectList = data.data || [];

        setSubjects(subjectList);

        if (subjectList.length === 0) {
          toastError(null, 'No subjects are assigned to you yet');
          return;
        }

        await loadSubjectAverages(subjectList);
        await handleSubjectChange(subjectList[0]._id);
      } catch (error) {
        toastError(error, 'Failed to load subjects');
      } finally {
        setLoading(false);
      }
    };

    fetchSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubjectChange = (subjectId) => {
    setSelectedSubject(subjectId);
    setSelectedStudent(null);
    setStudentDetail(null);
    setAnalytics(null);

    if (subjectId) {
      fetchAnalytics(subjectId, filter, { notify: true }).catch(() => {});
    }
  };

  const handleFilterChange = (filterType) => {
    setFilter(filterType);

    if (!selectedSubject) {
      toastError(null, 'Select a subject first');
      return;
    }

    fetchAnalytics(selectedSubject, filterType, { notify: false }).catch(() => {});
    const label = FILTERS.find((f) => f.value === filterType)?.label || filterType;
    toastSuccess(`Filter applied: ${label}`);
  };

  const applyDateRange = () => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      toastError(null, 'From date cannot be after To date');
      return;
    }
    if (!selectedSubject) {
      toastError(null, 'Select a subject first');
      return;
    }

    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
    fetchAnalytics(selectedSubject, filter, { notify: true }).catch(() => {});
  };

  const clearDateRange = () => {
    setDateFrom('');
    setDateTo('');
    setAppliedFrom('');
    setAppliedTo('');
    toastSuccess('Date range cleared.');

    if (selectedSubject) {
      fetchAnalytics(selectedSubject, filter).catch(() => {});
    }
  };

  const handleStudentClick = async (item) => {
    setSelectedStudent(item);
    setStudentDetail(null);
    setStudentLoading(true);

    try {
      const { data } = await getStudentAttendance(item.student._id, { subjectId: selectedSubject });
      setStudentDetail(data.data);
    } catch (error) {
      toastError(error, 'Failed to load student detail');
      setSelectedStudent(null);
    } finally {
      setStudentLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedStudent(null);
    setStudentDetail(null);
  };

  const chartData = useMemo(() => {
    if (!analytics) return null;

    const stats = analytics.stats;

    return {
      categoryData: [
        { name: 'Below 75%', value: stats?.categories?.below75 || 0 },
        { name: '75-80%', value: stats?.categories?.['75to80'] || 0 },
        { name: '80-90%', value: stats?.categories?.['80to90'] || 0 },
        { name: 'Above 90%', value: stats?.categories?.above90 || 0 },
      ],
      studentBars: (analytics.students || []).map((s) => ({
        name: s.student?.rollNumber || 'N/A',
        percentage: s.percentage,
      })),
      dailyTrend: (analytics?.dailyTrend || []).map((d) => ({
        name: new Date(d.date).toLocaleDateString(),
        value: d.percentage,
      })),
    };
  }, [analytics]);

  // Search sirf name / roll number par
  const filteredStudents = useMemo(() => {
    const studentList = analytics?.students || [];
    const query = search.trim().toLowerCase();

    if (!query) return studentList;

    return studentList.filter((s) => {
      const name = (s.student?.userId?.name || '').toLowerCase();
      const roll = s.student?.rollNumber || '';
      return name.includes(query) || roll.toLowerCase().includes(query);
    });
  }, [analytics, search]);

  const { page, setPage, total, pageItems } = usePagination(filteredStudents, PER_PAGE);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading subjects...</p>
      </div>
    );
  }

  const stats = analytics?.stats;

  return (
    <div>
      <h2 style={{ marginBottom: '0.5rem' }}>Attendance Analytics</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Track performance across your subjects like a data analyst.
      </p>

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
            <label>From Date</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>

          <div className="form-group">
            <label>To Date</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>

          <div className="form-group">
            <label>&nbsp;</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-sm" onClick={applyDateRange} disabled={!selectedSubject}>
                Apply Range
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={clearDateRange}
                disabled={!selectedSubject}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {!selectedSubject && (
        <div className="empty-state">
          <p>Select a subject to view attendance analytics</p>
        </div>
      )}

      {selectedSubject && analyticsLoading && !analytics && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading analytics...</p>
        </div>
      )}

      {selectedSubject && !analyticsLoading && (!analytics || !stats) && (
        <div className="empty-state">
          <p>No analytics available for this subject</p>
        </div>
      )}

      {analytics && stats && (
        <>
          <div className="card-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card">
              <div className="label">Total Students</div>
              <div className="value">{stats.totalStudents}</div>
              <div className="subtext">Enrolled in this subject</div>
            </div>
            <div className="stat-card">
              <div className="label">Average Attendance</div>
              <div className="value">{stats.avgAttendance}%</div>
              <div className="subtext">Class average</div>
            </div>
            <div className="stat-card">
              <div className="label">Highest</div>
              <div className="value" style={{ color: 'var(--success)' }}>{stats.highest || 0}%</div>
              <div className="subtext">Best performer</div>
            </div>
            <div className="stat-card">
              <div className="label">Lowest</div>
              <div className="value" style={{ color: 'var(--danger)' }}>{stats.lowest || 0}%</div>
              <div className="subtext">Needs attention</div>
            </div>
          </div>

          <div className="charts-grid">
            <ChartCard title="Category Breakdown">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={chartData.categoryData}
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    dataKey="value"
                    label={(e) => `${e.name}: ${e.value}`}
                  >
                    {chartData.categoryData.map((entry, index) => (
                      <Cell key={index} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Class Distribution">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData.categoryData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="Students" radius={[6, 6, 0, 0]}>
                    {chartData.categoryData.map((entry, index) => (
                      <Cell key={index} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="charts-grid">
            <ChartCard title="Student Attendance">
              {chartData.studentBars.length === 0 ? (
                <div className="empty-state">
                  <p>No attendance records yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData.studentBars}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="percentage" fill="#1f4e8c" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard
              title="Daily Trend"
              subtitle="Attendance % per class date inside the selected range"
            >
              {!chartData.dailyTrend || chartData.dailyTrend.length === 0 ? (
                <div className="empty-state">
                  <p>No dated attendance records in this range</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="value"
                      name="Att. %"
                      stroke="#0f7f86"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Subject Averages">
              {subjectAverages.length === 0 ? (
                <div className="empty-state">
                  <p>No data yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={subjectAverages}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="avg" name="Avg %" stroke="#10b981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Student List</h3>
              <div className="toolbar-row" style={{ gap: '0.75rem' }}>
                <div className="search-input" style={{ marginBottom: 0, width: '250px' }}>
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="filter-buttons" style={{ marginBottom: '1rem' }}>
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  className={`filter-btn ${filter === f.value ? 'active' : ''}`}
                  onClick={() => handleFilterChange(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {analyticsLoading ? (
              <div className="loading-container">
                <div className="spinner"></div>
              </div>
            ) : filteredStudents.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Roll No.</th>
                      <th>Name</th>
                      <th>Total</th>
                      <th>Present</th>
                      <th>Attendance</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((item) => (
                      <tr key={item.student?._id}>
                        <td>{item.student?.rollNumber || '—'}</td>
                        <td>{item.student?.userId?.name || '—'}</td>
                        <td>{item.total}</td>
                        <td>{item.present}</td>
                        <td style={{ fontWeight: 600, color: getAttendanceColor(item.percentage) }}>
                          {item.percentage}%
                        </td>
                        <td>
                          <span
                            className={`badge ${item.percentage >= 75 ? 'badge-success' : 'badge-danger'}`}
                          >
                            {item.percentage >= 75 ? 'OK' : 'Low'}
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-sm btn-secondary" onClick={() => handleStudentClick(item)}>
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <p>{search.trim() ? 'No students match your search' : 'No students in this category'}</p>
              </div>
            )}

            {!analyticsLoading && filteredStudents.length > 0 && (
              <Pagination current={page} total={total} perPage={PER_PAGE} onPageChange={setPage} />
            )}
          </div>
        </>
      )}

      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          detail={studentDetail}
          loading={studentLoading}
          onClose={closeModal}
        />
      )}
    </div>
  );
};

export default AttendanceAnalytics;
