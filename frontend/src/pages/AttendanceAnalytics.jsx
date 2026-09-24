import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { getFacultySubjects } from '../services/facultyService';
import { getAttendanceAnalytics, getStudentAttendance } from '../services/attendanceService';
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

const CATEGORY_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
const FILTERS = [
  { value: 'all', label: 'All Students' },
  { value: 'below75', label: 'Below 75%' },
  { value: '75to80', label: '75% - 80%' },
  { value: '80to90', label: '80% - 90%' },
  { value: 'above90', label: 'Above 90%' },
];

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

  const getErrorMessage = (error) =>
    error?.response?.data?.message || 'Something went wrong. Please try again.';

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const { data } = await getFacultySubjects();
        const subs = data.data || [];
        setSubjects(subs);
        if (subs.length) {
          await loadSubjectAverages(subs);
          handleSubjectChange(subs[0]._id);
        } else {
          toast.error('No subjects are assigned to you yet');
        }
      } catch (error) {
        console.error('Error fetching subjects:', error);
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };
    fetchSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSubjectAverages = async (subs) => {
    try {
      const results = await Promise.allSettled(
        subs.map((s) => getAttendanceAnalytics({ subjectId: s._id }))
      );
      const avgs = results
        .map((r, i) => ({
          name: subs[i]?.code || subs[i]?.name,
          avg: r.status === 'fulfilled' ? r.value?.data?.data?.stats?.avgAttendance || 0 : 0,
        }))
        .filter((r) => r.avg > 0);
      setSubjectAverages(avgs);
    } catch (error) {
      console.error('Error loading subject averages:', error);
    }
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
      if (notify) toast.success(`Analytics loaded for ${data.data?.subject?.code || 'subject'}`);
      return data.data;
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error(getErrorMessage(error));
      throw error;
    } finally {
      setAnalyticsLoading(false);
    }
  };

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
    if (selectedSubject) {
      fetchAnalytics(selectedSubject, filterType, { notify: false }).catch(() => {});
      toast.success(`Filter applied: ${FILTERS.find((f) => f.value === filterType)?.label || filterType}`);
    } else {
      toast.error('Select a subject first');
    }
  };

  const applyDateRange = () => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      toast.error('From date cannot be after To date');
      return;
    }
    if (!selectedSubject) {
      toast.error('Select a subject first');
      return;
    }
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
    if (selectedSubject) {
      fetchAnalytics(selectedSubject, filter, { notify: true }).catch(() => {});
    }
  };

  const clearDateRange = () => {
    setDateFrom('');
    setDateTo('');
    setAppliedFrom('');
    setAppliedTo('');
    toast.success('Date range cleared.');
    if (selectedSubject) {
      fetchAnalytics(selectedSubject, filter).catch(() => {});
    }
  };

  const handleStudentClick = async (student) => {
    setSelectedStudent(student);
    setStudentDetail(null);
    setStudentLoading(true);
    try {
      const { data } = await getStudentAttendance(student.student._id, { subjectId: selectedSubject });
      setStudentDetail(data.data);
    } catch (error) {
      console.error('Error fetching student detail:', error);
      toast.error(getErrorMessage(error));
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

  const filteredStudents = useMemo(() => {
    const students = analytics?.students || [];
    const query = search.trim().toLowerCase();
    if (!query) return students;
    return students.filter((s) => {
      const name = (s.student?.userId?.name || '').toLowerCase();
      const roll = s.student?.rollNumber || '';
      return name.includes(query) || roll.toLowerCase().includes(query);
    });
  }, [analytics, search]);

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
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
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
              <div className="value" style={{ color: 'var(--success)' }}>
                {stats.highest || 0}%
              </div>
              <div className="subtext">Best performer</div>
            </div>
            <div className="stat-card">
              <div className="label">Lowest</div>
              <div className="value" style={{ color: 'var(--danger)' }}>
                {stats.lowest || 0}%
              </div>
              <div className="subtext">Needs attention</div>
            </div>
          </div>

          <div className="charts-grid">
            <div className="card">
              <div className="card-header">
                <h3>Category Breakdown</h3>
              </div>
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
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Class Distribution</h3>
              </div>
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
            </div>
          </div>

          <div className="charts-grid">
            <div className="card">
              <div className="card-header">
                <h3>Student Attendance</h3>
              </div>
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
                    <Bar dataKey="percentage" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Daily Trend</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Attendance % per class date inside the selected range
                </p>
              </div>
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
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Subject Averages</h3>
              </div>
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
            </div>
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
                    onChange={(e) => setSearch(e.target.value)}
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
                    {filteredStudents.map((item) => (
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
          </div>
        </>
      )}

      {selectedStudent && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Student Attendance Detail</h3>
              <button className="modal-close" onClick={closeModal}>
                ×
              </button>
            </div>

            {studentLoading ? (
              <div className="loading-container">
                <div className="spinner"></div>
              </div>
            ) : (
              studentDetail && (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <p><strong>Name:</strong> {selectedStudent.student?.userId?.name}</p>
                    <p><strong>Roll No:</strong> {selectedStudent.student?.rollNumber}</p>
                    <p>
                      <strong>Overall Attendance:</strong>{' '}
                      <span style={{ color: getAttendanceColor(studentDetail.percentage) }}>
                        {studentDetail.percentage}%
                      </span>
                    </p>
                  </div>

                  <h4 style={{ marginBottom: '0.75rem' }}>Subject-wise Attendance</h4>
                  {studentDetail.subjectWise?.length ? (
                    studentDetail.subjectWise.map((sub) => (
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
                        {studentDetail.attendance?.slice(0, 10).map((record) => (
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
      )}
    </div>
  );
};

export default AttendanceAnalytics;