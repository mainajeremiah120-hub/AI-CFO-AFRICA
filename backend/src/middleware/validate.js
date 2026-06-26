// ── Operational error (safe to show to client) ───────────────────────────────
export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
    this.isOperational = true;
  }
}

// ── Amount validation ─────────────────────────────────────────────────────────
export function assertPositiveAmount(value, label = 'Amount') {
  const n = Number(value);
  if (!isFinite(n) || isNaN(n)) throw new AppError(`${label} must be a valid number`);
  if (n <= 0) throw new AppError(`${label} must be greater than zero`);
  if (n > 999_999_999) throw new AppError(`${label} exceeds maximum allowed value`);
}

export function assertPositiveQty(value, label = 'Quantity') {
  const n = Number(value);
  if (!isFinite(n) || isNaN(n)) throw new AppError(`${label} must be a valid number`);
  if (n <= 0) throw new AppError(`${label} must be greater than zero`);
  if (n > 10_000_000) throw new AppError(`${label} exceeds maximum allowed value`);
}

// ── String length guards ──────────────────────────────────────────────────────
export function assertStringLength(value, label, max = 500) {
  if (value && String(value).length > max) {
    throw new AppError(`${label} must be ${max} characters or fewer`);
  }
}

// ── Required fields guard ────────────────────────────────────────────────────
export function assertRequired(value, label) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new AppError(`${label} is required`);
  }
}

// ── Password strength ─────────────────────────────────────────────────────────
export function assertPasswordStrength(password) {
  if (!password || password.length < 8) {
    throw new AppError('Password must be at least 8 characters');
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new AppError('Password must contain both letters and numbers');
  }
}

// ── Rate: must be 0–100 (percentage) ─────────────────────────────────────────
export function assertRate(value, label) {
  const n = Number(value);
  if (!isFinite(n) || n < 0 || n > 100) {
    throw new AppError(`${label} must be a percentage between 0 and 100`);
  }
}

// ── Express error handler helper ─────────────────────────────────────────────
export function handleError(res, err) {
  if (err.isOperational) {
    return res.status(err.status || 400).json({ error: err.message });
  }
  console.error('[DB/SYSTEM ERROR]', err);
  return res.status(500).json({ error: 'An internal error occurred' });
}
