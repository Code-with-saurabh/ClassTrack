const Notification = require('../models/Notification');
const User = require('../models/User');

const listNotifications = async (userId, { limit = 20, unreadOnly = false }) => {
  const filter = { user: userId };
  if (unreadOnly) filter.read = false;
  return Notification.find(filter).sort({ createdAt: -1 }).limit(Number(limit)).lean();
};

const getMyNotifications = async (req, res) => {
  try {
    const { limit = 20, unreadOnly } = req.query;
    const notifications = await listNotifications(req.user._id, {
      limit: unreadOnly === 'true' ? 50 : limit,
      unreadOnly: unreadOnly === 'true',
    });
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ user: req.user._id, read: false });
    res.json({ success: true, data: { count } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    const count = await Notification.countDocuments({ user: req.user._id, read: false });
    res.json({ success: true, data: { notification, unread: count } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.json({ success: true, data: { unread: 0 } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createNotification = async (userId, { title, body, type = 'info', link = '' }) => {
  await Notification.create({ user: userId, title, body, type, link });
};

const createNotifications = async (userIds, { title, body, type = 'info', link = '' }) => {
  const uniq = Array.from(new Set(userIds.map((id) => String(id))));
  if (!uniq.length) return;
  const docs = uniq.map((id) => ({ user: id, title, body, type, link }));
  await Notification.insertMany(docs);
};

const broadcast = async (req, res) => {
  try {
    const { title, body, type = 'info', link, recipients = 'all-students' } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    let query = {};
    if (recipients === 'students') query = { role: 'student' };
    else if (recipients === 'faculty') query = { role: 'faculty' };
    else query = {};

    const users = await User.find(query).select('_id').lean();
    await createNotifications(users.map((u) => u._id), { title, body, type, link });

    res.status(201).json({
      success: true,
      message: `Notification sent to ${users.length} user(s)`,
      data: { count: users.length },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllRead,
  broadcast,
  createNotification,
  createNotifications,
};