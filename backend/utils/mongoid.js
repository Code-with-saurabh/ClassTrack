const mongoose = require('mongoose');

const objectId = (id) => {
  if (id === undefined || id === null || id === '') return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (typeof id === 'number') return null;
  const s = String(id);
  if (!mongoose.Types.ObjectId.isValid(s)) return null;
  return new mongoose.Types.ObjectId(s);
};

const objectIds = (arr) => (Array.isArray(arr) ? arr.map(objectId).filter(Boolean) : []);

module.exports = { objectId, objectIds };