/**
 * In-memory job tracker: progress reporting + one running job per idea.
 * Single-process, single-user app, so memory is sufficient.
 */
const jobs = new Map(); // ideaId -> { task, step, total, label, startedAt }

class BusyError extends Error {
  constructor(job) {
    super(`這個主題正在執行「${job.task}」，請等它完成再試`);
    this.status = 409;
    this.code = 'BUSY';
  }
}

/**
 * Run fn(onProgress) while holding the idea's lock.
 * onProgress(step, total, label) updates what GET /progress/:id returns.
 */
async function runJob(ideaId, task, fn) {
  const existing = jobs.get(ideaId);
  if (existing) throw new BusyError(existing);

  const job = { task, step: 0, total: 1, label: '準備中', startedAt: Date.now() };
  jobs.set(ideaId, job);
  const onProgress = (step, total, label) => Object.assign(job, { step, total, label });
  try {
    return await fn(onProgress);
  } finally {
    jobs.delete(ideaId);
  }
}

function getJob(ideaId) {
  const job = jobs.get(ideaId);
  if (!job) return null;
  return { ...job, elapsed_sec: Math.round((Date.now() - job.startedAt) / 1000) };
}

module.exports = { runJob, getJob };
