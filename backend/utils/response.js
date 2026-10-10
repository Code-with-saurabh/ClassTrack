const sendData = (res, data, message) => {
  const body = { success: true };
  if (message) body.message = message;
  body.data = data;
  return res.json(body);
};

const sendCreated = (res, message, data) => {
  return res.status(201).json({ success: true, message, data });
};

const sendMessage = (res, message) => {
  return res.json({ success: true, message });
};

const sendError = (res, status, message) => {
  return res.status(status).json({ success: false, message });
};

module.exports = { sendData, sendCreated, sendMessage, sendError };
