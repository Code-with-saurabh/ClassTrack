const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    console.error(error);
    if (res.headersSent) {
      return next(error);
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = asyncHandler;
