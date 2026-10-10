const Notification = require('../models/Notification');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const { sendData, sendCreated, sendError } = require('../utils/response');

const listNotifications = async (userId, { limit = 20, unreadOnly = false }) => {
  const filter = { user: userId };
  if (unreadOnly) filter.read = false;
  return Notification.find(filter).sort({ createdAt: -1 }).limit(Number(limit)).lean();
};

const countUnread = async (userId) => {
  return Notification.countDocuments({ user: userId, read: false });
};

exports.getMyNotifications = asyncHandler(async (req, res) => {
  const { limit = 20, unreadOnly } = req.query;
  const showUnreadOnly = unreadOnly === 'true';

  const notifications = await listNotifications(req.user._id, {
    limit: showUnreadOnly ? 50 : limit,
    unreadOnly: showUnreadOnly,
  });

  return sendData(res, notifications);
});

exports.getUnreadCount = asyncHandler(async (req, res) => {
  const count = await countUnread(req.user._id);
  return sendData(res, { count });
});

exports.markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { read: true },
    { new: true }
  );

  if (!notification) {
    return sendError(res, 404, 'Notification not found');
  }

  const unread = await countUnread(req.user._id);
  return sendData(res, { notification, unread });
});

exports.markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  return sendData(res, { unread: 0 });
});

const createNotification = async (userId, { title, body, type = 'info', link = '' }) => {
  await Notification.create({ user: userId, title, body, type, link });
};

const createNotifications = async (userIds, { title, body, type = 'info', link = '' }) => {
  const uniqueIds = Array.from(new Set(userIds.map((id) => String(id))));
  if (uniqueIds.length === 0) return;

  const documents = uniqueIds.map((id) => ({ user: id, title, body, type, link }));
  await Notification.insertMany(documents);
};

const buildRecipientQuery = (recipients) => {
  if (recipients === 'students') return { role: 'student' };
  if (recipients === 'faculty') return { role: 'faculty' };
  return {};
};

exports.broadcast = asyncHandler(async (req, res) => {
  const { title, body, type = 'info', link, recipients = 'all-students' } = req.body;

  if (!title) {
    return sendError(res, 400, 'Title is required');
  }

  const query = buildRecipientQuery(recipients);
  const users = await User.find(query).select('_id').lean();

  await createNotifications(users.map((user) => user._id), { title, body, type, link });

  return sendCreated(res, `Notification sent to ${users.length} user(s)`, { count: users.length });
});

exports.createNotification = createNotification;
exports.createNotifications = createNotifications;
