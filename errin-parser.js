/**
 * errin-parser.js
 * Simple Node module to parse / normalize / validate task objects ("errin" parser).
 *
 * Usage:
 *   const { parseTask, parseTasks, validateTask } = require('./errin-parser');
 *
 * Inputs should be plain objects (JSON). Output is normalized Task object.
 */

const { randomUUID } = require('crypto');

const DEFAULTS = {
  status: 'pending',
  attempts: 0,
  max_attempts: 5,
  priority: 'medium',
  created_at: () => new Date().toISOString(),
  updated_at: () => new Date().toISOString(),
  next_retry_base_seconds: 60 // base for exponential backoff
};

function nowISO() {
  return new Date().toISOString();
}

function ensureUUID(id) {
  if (!id) return randomUUID ? randomUUID() : 'id-' + Math.floor(Math.random()*1e9);
  return id;
}

function validateTask(raw) {
  const errors = [];
  if (!raw) {
    errors.push('task is empty');
    return errors;
  }
  if (!raw.type || typeof raw.type !== 'string') errors.push('type is required and must be string');
  if (!raw.payload) {
    // payload can be empty but warn
  }
  if (raw.attempts != null && typeof raw.attempts !== 'number') errors.push('attempts must be a number');
  if (raw.max_attempts != null && typeof raw.max_attempts !== 'number') errors.push('max_attempts must be a number');
  if (raw.priority && !['low','medium','high'].includes(raw.priority)) errors.push('priority must be low|medium|high');
  return errors;
}

function computeNextRetryAt(attempts, baseSeconds) {
  if (attempts <= 0) return null;
  const wait = baseSeconds * Math.pow(2, Math.max(0, attempts - 1)); // exponential backoff
  const next = new Date(Date.now() + wait * 1000);
  return next.toISOString();
}

function appendAudit(task, actor='errin', action='parsed', note='Normalized and validated') {
  const entry = { when: nowISO(), actor, action, note };
  task.audit = Array.isArray(task.audit) ? task.audit.concat(entry) : [entry];
}

/**
 * parseTask(raw, opts)
 * - raw: input object
 * - opts: { baseRetrySeconds: number }
 *
 * Returns { task, errors } where task is normalized task or null if fatal.
 */
function parseTask(raw, opts = {}) {
  const baseRetrySeconds = opts.baseRetrySeconds || DEFAULTS.next_retry_base_seconds;
  const errors = validateTask(raw);

  // start with shallow clone to avoid mutating input
  const t = Object.assign({}, raw);

  // id / idempotency
  t.id = ensureUUID(t.id || t.uuid || t.taskId);

  // timestamps
  t.created_at = t.created_at || (DEFAULTS.created_at instanceof Function ? DEFAULTS.created_at() : DEFAULTS.created_at);
  t.updated_at = nowISO();

  // status & attempts
  t.status = t.status || DEFAULTS.status;
  t.attempts = Number.isFinite(t.attempts) ? t.attempts : DEFAULTS.attempts;
  t.max_attempts = Number.isFinite(t.max_attempts) ? t.max_attempts : DEFAULTS.max_attempts;

  // priority
  t.priority = t.priority || DEFAULTS.priority;

  // payload safe default
  t.payload = t.payload != null ? t.payload : (t.data != null ? t.data : {});

  // last_error
  t.last_error = t.last_error || null;

  // compute next_retry_at if failed and attempts > 0 and not exceeded
  t.next_retry_at = null;
  if ((t.status === 'failed' || t.status === 'in_progress') && t.attempts > 0 && t.attempts < t.max_attempts) {
    t.next_retry_at = computeNextRetryAt(t.attempts, baseRetrySeconds);
  } else if (t.attempts >= t.max_attempts) {
    // escalated if attempts reached max
    t.status = t.status === 'completed' ? 'completed' : 'escalated';
  }

  // ensure audit list and append parse entry
  appendAudit(t, 'errin', 'parsed', `Parsed with baseRetry=${baseRetrySeconds}s`);

  return { task: t, errors };
}

/**
 * parseTasks(list, opts)
 * - list: array of raw tasks
 * Returns { tasks: [...], errors: [{index, errors}] }
 */
function parseTasks(list, opts = {}) {
  if (!Array.isArray(list)) throw new TypeError('list must be an array');
  const tasks = [];
  const errors = [];
  list.forEach((raw, idx) => {
    const { task, errors: e } = parseTask(raw, opts);
    if (e && e.length) errors.push({ index: idx, errors: e });
    tasks.push(task);
  });
  return { tasks, errors };
}

module.exports = { parseTask, parseTasks, validateTask, computeNextRetryAt };
