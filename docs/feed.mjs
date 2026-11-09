import {validateJob} from './tracker.mjs';

export function parseFeed(input) {
  if (!input || !Array.isArray(input.jobs)) throw Error('Invalid jobs feed');
  const unique = new Map();
  let invalid = 0;
  for (const raw of input.jobs) {
    try {
      const job = validateJob(raw);
      unique.set(job.id, job);
    } catch {
      invalid++;
    }
  }
  return {
    jobs: [...unique.values()],
    invalid,
    updated_at: typeof input.updated_at === 'string' && !Number.isNaN(Date.parse(input.updated_at)) ? input.updated_at : null,
    sources_ok: Array.isArray(input.sources_ok) ? input.sources_ok : [],
    errors: Array.isArray(input.errors) ? input.errors : [],
  };
}
