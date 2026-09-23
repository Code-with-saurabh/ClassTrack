const DAY_MS = 86400000;

const normalizeDate = (input) => {
  if (!input && input !== 0) return null;
  let d;
  if (input instanceof Date) {
    d = input;
  } else if (typeof input === 'number') {
    d = new Date(input);
  } else {
    const s = String(input).trim();
    if (!s) return null;
    d = new Date(s);
  }
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const toDateKey = (input) => {
  const d = normalizeDate(input);
  if (!d) return null;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const dayNameFromDate = (input) => {
  const d = normalizeDate(input);
  if (!d) return null;
  return d.toLocaleDateString('en-US', { weekday: 'long' });
};

module.exports = { normalizeDate, toDateKey, dayNameFromDate, DAY_MS };