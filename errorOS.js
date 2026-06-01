/**
 * errorOS.js
 * Error detection, categorization, root-cause analysis, and remediation task generation.
 *
 * Usage:
 *   const errorOS = require('./errorOS');
 *   const error = { message: '...' , stack: '...', source: 'service-a' };
 *   const { category, rootCause, remediationRule, task } = errorOS.diagnose(error);
 */

const crypto = require('crypto');
const { parseTask } = require('./errin-parser');

/**
 * Error Categories
 */
const CATEGORIES = {
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  DATABASE: 'database',
  OOM: 'out_of_memory',
  PERMISSION: 'permission_denied',
  INVALID_INPUT: 'invalid_input',
  UNKNOWN: 'unknown'
};

/**
 * Default remediation rules (error category -> recovery action)
 */
const DEFAULT_REMEDIATION_RULES = {
  [CATEGORIES.TIMEOUT]: {
    action: 'retry',
    maxAttempts: 3,
    backoffBase: 5,
    description: 'Retry operation with exponential backoff'
  },
  [CATEGORIES.NETWORK]: {
    action: 'retry_with_circuit_breaker',
    maxAttempts: 5,
    backoffBase: 10,
    description: 'Retry with circuit breaker; escalate if repeated'
  },
  [CATEGORIES.DATABASE]: {
    action: 'escalate_and_notify',
    maxAttempts: 1,
    description: 'Database errors require operator intervention'
  },
  [CATEGORIES.OOM]: {
    action: 'scale_up_and_retry',
    maxAttempts: 2,
    description: 'Increase memory/resources and retry'
  },
  [CATEGORIES.PERMISSION]: {
    action: 'escalate',
    maxAttempts: 1,
    description: 'Permission errors require manual review'
  },
  [CATEGORIES.INVALID_INPUT]: {
    action: 'fail_fast',
    description: 'Invalid input; do not retry'
  },
  [CATEGORIES.UNKNOWN]: {
    action: 'log_and_monitor',
    description: 'Unknown error; monitor and alert operator'
  }
};

/**
 * Fingerprint an error (for deduplication)
 */
function fingerprint(error) {
  const msg = (error.message || '').slice(0, 100);
  const firstFrame = extractFirstStackFrame(error.stack || '');
  const combined = msg + '|' + firstFrame;
  return crypto.createHash('sha256').update(combined).digest('hex').slice(0, 12);
}

/**
 * Extract first meaningful stack frame
 */
function extractFirstStackFrame(stack) {
  if (!stack) return 'no-stack';
  const lines = stack.split('\n');
  for (let line of lines) {
    if (line.includes('at ')) {
      const match = line.match(/at\s+([^\s]+)/);
      return match ? match[1] : 'unknown-frame';
    }
  }
  return 'unknown-frame';
}

/**
 * Categorize an error based on message and stack patterns
 */
function categorize(error) {
  const msg = (error.message || '').toLowerCase();
  const stack = (error.stack || '').toLowerCase();
  const combined = msg + ' ' + stack;

  if (combined.includes('timeout') || combined.includes('deadline')) return CATEGORIES.TIMEOUT;
  if (combined.includes('econnrefused') || combined.includes('enotfound') || combined.includes('network')) return CATEGORIES.NETWORK;
  if (combined.includes('sql') || combined.includes('database') || combined.includes('postgres') || combined.includes('mysql')) return CATEGORIES.DATABASE;
  if (combined.includes('out of memory') || combined.includes('heap out of memory') || combined.includes('enomem')) return CATEGORIES.OOM;
  if (combined.includes('permission') || combined.includes('unauthorized') || combined.includes('forbidden') || combined.includes('eacces')) return CATEGORIES.PERMISSION;
  if (combined.includes('invalid') || combined.includes('syntax') || combined.includes('validation')) return CATEGORIES.INVALID_INPUT;

  return CATEGORIES.UNKNOWN;
}

/**
 * Perform root-cause analysis on an error
 */
function analyzeRootCause(error, category) {
  const msg = error.message || '';
  const stack = error.stack || '';

  let rootCause = {
    category,
    confidence: 0.5, // 0-1
    suspectedCause: 'Unknown',
    affectedComponent: error.source || 'unknown',
    suggestedFix: 'Review error and logs'
  };

  if (category === CATEGORIES.TIMEOUT) {
    rootCause.suspectedCause = 'Operation exceeded time limit (network, compute, or I/O delay)';
    rootCause.suggestedFix = 'Increase timeout, optimize query, check service health';
    rootCause.confidence = 0.9;
  } else if (category === CATEGORIES.NETWORK) {
    rootCause.suspectedCause = 'Network connectivity issue or service unreachable';
    rootCause.suggestedFix = 'Verify service availability, check DNS, verify network policy';
    rootCause.confidence = 0.85;
  } else if (category === CATEGORIES.DATABASE) {
    rootCause.suspectedCause = 'Database query failed (syntax, connection, constraint)';
    rootCause.suggestedFix = 'Review query logs, check schema, verify DB credentials and capacity';
    rootCause.confidence = 0.8;
  } else if (category === CATEGORIES.OOM) {
    rootCause.suspectedCause = 'Process ran out of memory (memory leak or underprovisioned)';
    rootCause.suggestedFix = 'Increase memory, profile for leaks, optimize allocation';
    rootCause.confidence = 0.95;
  } else if (category === CATEGORIES.PERMISSION) {
    rootCause.suspectedCause = 'Insufficient permissions (user, service, or token)';
    rootCause.suggestedFix = 'Check IAM policy, service account, API token scope';
    rootCause.confidence = 0.9;
  } else if (category === CATEGORIES.INVALID_INPUT) {
    rootCause.suspectedCause = 'Input validation failed (malformed data, wrong type)';
    rootCause.suggestedFix = 'Validate input before processing, add sanitization';
    rootCause.confidence = 0.85;
  }

  return rootCause;
}

/**
 * Generate a recovery Task object based on error and remediation rule
 * Uses errin parser to normalize
 */
function generateRecoveryTask(error, category, rule) {
  const taskType = `remedy-${rule.action}`;

  const rawTask = {
    type: taskType,
    source: `errorOS-${category}`,
    status: 'pending',
    priority: category === CATEGORIES.OOM ? 'high' : 'medium',
    payload: {
      errorMessage: error.message,
      errorSource: error.source || 'unknown',
      errorCategory: category,
      remediationRule: rule.action,
      originalError: {
        message: error.message,
        stack: error.stack ? error.stack.slice(0, 500) : null
      }
    },
    max_attempts: rule.maxAttempts || 3
  };

  const { task, errors } = parseTask(rawTask, { baseRetrySeconds: rule.backoffBase || 60 });
  return task;
}

/**
 * Main diagnosis function
 */
function diagnose(error, customRules = {}) {
  const rules = Object.assign({}, DEFAULT_REMEDIATION_RULES, customRules);

  if (!error || typeof error !== 'object') {
    error = { message: String(error), source: 'unknown' };
  }

  const fp = fingerprint(error);
  const category = categorize(error);
  const rootCause = analyzeRootCause(error, category);
  const remediationRule = rules[category] || rules[CATEGORIES.UNKNOWN];
  const task = generateRecoveryTask(error, category, remediationRule);

  return {
    fingerprint: fp,
    category,
    rootCause,
    remediationRule,
    task, // normalized recovery task for RecoveryOS
    diagnosis: {
      error: error.message,
      suspectedCause: rootCause.suspectedCause,
      suggestedFix: rootCause.suggestedFix,
      action: remediationRule.action,
      confidence: rootCause.confidence
    }
  };
}

/**
 * Batch diagnose multiple errors
 */
function diagnoseBatch(errors, customRules = {}) {
  return errors.map(e => diagnose(e, customRules));
}

/**
 * Error metrics aggregator
 */
class ErrorMetrics {
  constructor() {
    this.errors = {}; // fingerprint -> { count, firstSeen, lastSeen, category, ... }
    this.categoryStats = {}; // category -> { count, resolved, failed }
  }

  record(diagnosis) {
    const fp = diagnosis.fingerprint;
    const cat = diagnosis.category;

    if (!this.errors[fp]) {
      this.errors[fp] = {
        fingerprint: fp,
        category: cat,
        message: diagnosis.task.payload.errorMessage,
        count: 0,
        firstSeen: new Date().toISOString(),
        lastSeen: null,
        resolved: 0,
        failed: 0
      };
    }
    this.errors[fp].count += 1;
    this.errors[fp].lastSeen = new Date().toISOString();

    if (!this.categoryStats[cat]) {
      this.categoryStats[cat] = { count: 0, resolved: 0, failed: 0 };
    }
    this.categoryStats[cat].count += 1;
  }

  markResolved(fingerprint) {
    if (this.errors[fingerprint]) this.errors[fingerprint].resolved += 1;
    // find category and update
    const cat = this.errors[fingerprint].category;
    if (this.categoryStats[cat]) this.categoryStats[cat].resolved += 1;
  }

  markFailed(fingerprint) {
    if (this.errors[fingerprint]) this.errors[fingerprint].failed += 1;
    const cat = this.errors[fingerprint].category;
    if (this.categoryStats[cat]) this.categoryStats[cat].failed += 1;
  }

  getStats() {
    return {
      totalErrorPatterns: Object.keys(this.errors).length,
      totalOccurrences: Object.values(this.errors).reduce((sum, e) => sum + e.count, 0),
      byCategory: this.categoryStats,
      topErrors: Object.values(this.errors).sort((a, b) => b.count - a.count).slice(0, 10)
    };
  }
}

module.exports = {
  diagnose,
  diagnoseBatch,
  fingerprint,
  categorize,
  analyzeRootCause,
  generateRecoveryTask,
  CATEGORIES,
  DEFAULT_REMEDIATION_RULES,
  ErrorMetrics
};
