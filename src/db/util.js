'use strict';

const { ValidationError } = require('./errors');

// Compute the next sequential document number from the previous one.
// e.g. computeNextNumber('SAL', 'SAL-000007') => 'SAL-000008'
function computeNextNumber(prefix, last) {
  let n = 0;
  if (last) {
    const match = String(last).match(/(\d+)\s*$/);
    if (match) n = parseInt(match[1], 10);
  }
  const next = String(n + 1).padStart(6, '0');
  return `${prefix}-${next}`;
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function requireText(value, label) {
  const text = value === null || value === undefined ? '' : String(value).trim();
  if (!text) throw new ValidationError(`الحقل "${label}" مطلوب`);
  return text;
}

function requireNonNegative(value, label) {
  const n = toNumber(value, 0);
  if (n < 0) throw new ValidationError(`الحقل "${label}" لا يمكن أن يكون سالبًا`);
  return n;
}

function round2(value) {
  return Math.round((toNumber(value, 0) + Number.EPSILON) * 100) / 100;
}

module.exports = { computeNextNumber, toNumber, requireText, requireNonNegative, round2 };

