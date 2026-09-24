import { useState, useEffect } from 'react';
import { getAllTimetable, createTimetable, updateTimetable, deleteTimetable } from '../services/timetableService';
import { getAllSubjects } from '../services/subjectService';
import { getAllFaculty } from '../services/facultyService';
import toast from 'react-hot-toast';
import { toastError, toastValidation } from '../utils/toastHelpers';

const TimetableManagement = () => {
  const [timetable, setTimetable] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [filter, setFilter] = useState({ day: '', semester: '' });
  const [formData, setFormData] = useState({
    subject: '', faculty: '', division: 'A', day: 'Monday',
    startTime: '09:00', endTime: '10:00', room: '', semester: 5, department: 'Computer Science'
  });

  const fetchData = async () => {
    try {
      const [timetableRes, subjectsRes, facultyRes] = await Promise.all([
        getAllTimetable(), getAllSubjects(), getAllFaculty()
      ]);
      setTimetable(timetableRes.data.data);
      setSubjects(subjectsRes.data.data);
      setFacultyList(facultyRes.data.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toastError(error, 'Failed to load timetable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const validateForm = () => {
    if (!formData.subject) { toastValidation('Please select a subject.'); return false; }
    if (!formData.faculty) { toastValidation('Please select a faculty member.'); return false; }
    if (!formData.day) { toastValidation('Please select a day.'); return false; }
    if (!formData.room.trim()) { toastValidation('Room is required.'); return false; }
    if (formData.startTime >= formData.endTime) { toastValidation('End time must be after start time.'); return false; }
    if (formData.semester < 1 || formData.semester > 8) { toastValidation('Semester must be between 1 and 8.'); return false; }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      if (editingEntry) {
        await updateTimetable(editingEntry._id, formData);
        toast.success('Timetable entry updated.');
      } else {
        await createTimetable(formData);
        toast.success('Timetable entry created.');
      }
      setShowModal(false);
      setEditingEntry(null);
      setFormData({ subject: '', faculty: '', division: 'A', day: 'Monday', startTime: '09:00', endTime: '10:00', room: '', semester: 5, department: 'Computer Science' });
      fetchData();
    } catch (error) {
      console.error('Error saving timetable:', error);
      toastError(error, 'Failed to save timetable entry');
    }
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setFormData({
      subject: entry.subject?._id || '',
      faculty: entry.faculty?._id || '',
      division: entry.division,
      day: entry.day,
      startTime: entry.startTime,
      endTime: entry.endTime,
      room: entry.room,
      semester: entry.semester,
      department: entry.department
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this timetable entry?')) {
      try {
        await deleteTimetable(id);
        toast.success('Timetable entry deleted.');
        fetchData();
      } catch (error) {
        console.error('Error deleting timetable:', error);
        toastError(error, 'Failed to delete entry');
      }
    } else {
      toastValidation('Delete cancelled.');
    }
  };

  const filteredTimetable = timetable.filter(entry => {
    if (filter.day && entry.day !== filter.day) return false;
    if (filter.semester && entry.semester !== parseInt(filter.semester)) return false;
    return true;
  });

  if (loading) {
    return <div className="loading-container"><div className="spinner"></div><p>Loading timetable...</p></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Timetable Management</h2>
        <button className="btn btn-primary" onClick={() => { setEditingEntry(null); setShowModal(true); }}>
          + Add Entry
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="form-row">
          <div className="form-group">
            <label>Filter by Day</label>
            <select value={filter.day} onChange={(e) => setFilter({ ...filter, day: e.target.value })}>
              <option value="">All Days</option>
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Filter by Semester</label>
            <select value={filter.semester} onChange={(e) => setFilter({ ...filter, semester: e.target.value })}>
              <option value="">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                <option key={s} value={s}>Semester {s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Time</th>
                <th>Subject</th>
                <th>Faculty</th>
                <th>Division</th>
                <th>Room</th>
                <th>Semester</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTimetable.map((entry) => (
                <tr key={entry._id}>
                  <td>{entry.day}</td>
                  <td>{entry.startTime} - {entry.endTime}</td>
                  <td>{entry.subject?.name}</td>
                  <td>{entry.faculty?.userId?.name}</td>
                  <td>{entry.division}</td>
                  <td>{entry.room}</td>
                  <td>{entry.semester}</td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(entry)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(entry._id)} style={{ marginLeft: '0.5rem' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingEntry ? 'Edit Timetable Entry' : 'Add Timetable Entry'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Subject</label>
                  <select value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} required>
                    <option value="">Select Subject</option>
                    {subjects.map((s) => (
                      <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Faculty</label>
                  <select value={formData.faculty} onChange={(e) => setFormData({ ...formData, faculty: e.target.value })} required>
                    <option value="">Select Faculty</option>
                    {facultyList.map((f) => (
                      <option key={f._id} value={f._id}>{f.userId?.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Day</label>
                  <select value={formData.day} onChange={(e) => setFormData({ ...formData, day: e.target.value })} required>
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Division</label>
                  <input type="text" value={formData.division} onChange={(e) => setFormData({ ...formData, division: e.target.value })} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Start Time</label>
                  <input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Room</label>
                  <input type="text" value={formData.room} onChange={(e) => setFormData({ ...formData, room: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Semester</label>
                  <input type="number" value={formData.semester} onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) })} min="1" max="8" required />
                </div>
              </div>
              <div className="form-group">
                <label>Department</label>
                <input type="text" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} required />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingEntry ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimetableManagement;
