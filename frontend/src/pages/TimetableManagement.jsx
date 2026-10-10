import { useState, useEffect } from 'react';
import {
  getAllTimetable,
  createTimetable,
  updateTimetable,
  deleteTimetable,
} from '../services/timetableService';
import { getAllSubjects } from '../services/subjectService';
import { getAllFaculty } from '../services/facultyService';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import { toastError, toastValidation, toastSuccess } from '../utils/toastHelpers';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PER_PAGE = 10;

const emptyForm = () => ({
  subject: '',
  faculty: '',
  division: 'A',
  day: 'Monday',
  startTime: '09:00',
  endTime: '10:00',
  room: '',
  semester: 5,
  department: 'Computer Science',
});

const TimetableFormModal = ({ entry, subjects, facultyList, onClose, onSaved }) => {
  const [formData, setFormData] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // Edit mode me existing data bharo
  useEffect(() => {
    if (entry) {
      setFormData({
        subject: entry.subject?._id || '',
        faculty: entry.faculty?._id || '',
        division: entry.division,
        day: entry.day,
        startTime: entry.startTime,
        endTime: entry.endTime,
        room: entry.room,
        semester: entry.semester,
        department: entry.department,
      });
    }
  }, [entry]);

  const updateField = (field, value) => setFormData({ ...formData, [field]: value });

  const validateForm = () => {
    if (!formData.subject) {
      toastValidation('Please select a subject.');
      return false;
    }
    if (!formData.faculty) {
      toastValidation('Please select a faculty member.');
      return false;
    }
    if (!formData.day) {
      toastValidation('Please select a day.');
      return false;
    }
    if (!formData.room.trim()) {
      toastValidation('Room is required.');
      return false;
    }
    if (formData.startTime >= formData.endTime) {
      toastValidation('End time must be after start time.');
      return false;
    }
    if (formData.semester < 1 || formData.semester > 8) {
      toastValidation('Semester must be between 1 and 8.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);

    try {
      if (entry) {
        await updateTimetable(entry._id, formData);
        toastSuccess('Timetable entry updated.');
      } else {
        await createTimetable(formData);
        toastSuccess('Timetable entry created.');
      }

      onSaved();
    } catch (error) {
      toastError(error, 'Failed to save timetable entry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{entry ? 'Edit Timetable Entry' : 'Add Timetable Entry'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Subject</label>
              <select
                value={formData.subject}
                onChange={(e) => updateField('subject', e.target.value)}
                required
              >
                <option value="">Select Subject</option>
                {subjects.map((s) => (
                  <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Faculty</label>
              <select
                value={formData.faculty}
                onChange={(e) => updateField('faculty', e.target.value)}
                required
              >
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
              <select value={formData.day} onChange={(e) => updateField('day', e.target.value)} required>
                {DAYS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Division</label>
              <input
                type="text"
                value={formData.division}
                onChange={(e) => updateField('division', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Time</label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => updateField('startTime', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>End Time</label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => updateField('endTime', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Room</label>
              <input
                type="text"
                value={formData.room}
                onChange={(e) => updateField('room', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Semester</label>
              <input
                type="number"
                value={formData.semester}
                onChange={(e) => updateField('semester', parseInt(e.target.value))}
                min="1"
                max="8"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Department</label>
            <input
              type="text"
              value={formData.department}
              onChange={(e) => updateField('department', e.target.value)}
              required
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : entry ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const TimetableManagement = () => {
  const [timetable, setTimetable] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [filter, setFilter] = useState({ day: '', semester: '' });

  const fetchData = async () => {
    try {
      const [timetableRes, subjectsRes, facultyRes] = await Promise.all([
        getAllTimetable(),
        getAllSubjects(),
        getAllFaculty(),
      ]);
      setTimetable(timetableRes.data.data);
      setSubjects(subjectsRes.data.data);
      setFacultyList(facultyRes.data.data);
    } catch (error) {
      toastError(error, 'Failed to load timetable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setEditingEntry(null);
    setShowModal(true);
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setShowModal(true);
  };

  const handleSaved = () => {
    setShowModal(false);
    setEditingEntry(null);
    fetchData();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this timetable entry?')) {
      toastValidation('Delete cancelled.');
      return;
    }

    try {
      await deleteTimetable(id);
      toastSuccess('Timetable entry deleted.');
      fetchData();
    } catch (error) {
      toastError(error, 'Failed to delete entry');
    }
  };

  const filteredTimetable = timetable.filter((entry) => {
    if (filter.day && entry.day !== filter.day) return false;
    if (filter.semester && entry.semester !== parseInt(filter.semester)) return false;
    return true;
  });

  const { page, setPage, total, pageItems } = usePagination(filteredTimetable, PER_PAGE);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading timetable...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Timetable Management</h2>
        <button className="btn btn-primary" onClick={openAddModal}>
          + Add Entry
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="form-row">
          <div className="form-group">
            <label>Filter by Day</label>
            <select
              value={filter.day}
              onChange={(e) => {
                setFilter({ ...filter, day: e.target.value });
                setPage(1);
              }}
            >
              <option value="">All Days</option>
              {DAYS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Filter by Semester</label>
            <select
              value={filter.semester}
              onChange={(e) => {
                setFilter({ ...filter, semester: e.target.value });
                setPage(1);
              }}
            >
              <option value="">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
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
              {pageItems.map((entry) => (
                <tr key={entry._id}>
                  <td>{entry.day}</td>
                  <td>{entry.startTime} - {entry.endTime}</td>
                  <td>{entry.subject?.name}</td>
                  <td>{entry.faculty?.userId?.name}</td>
                  <td>{entry.division}</td>
                  <td>{entry.room}</td>
                  <td>{entry.semester}</td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(entry)}>
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(entry._id)}
                      style={{ marginLeft: '0.5rem' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination current={page} total={total} perPage={PER_PAGE} onPageChange={setPage} />
      </div>

      {showModal && (
        <TimetableFormModal
          entry={editingEntry}
          subjects={subjects}
          facultyList={facultyList}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

export default TimetableManagement;
