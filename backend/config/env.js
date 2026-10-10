const dotenv = require('dotenv');

dotenv.config();

const env = Object.freeze({
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRE: process.env.JWT_EXPIRE,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
});

module.exports = env;
module.exports.env = env;
