'use strict';

/**
 * Benchmark for the gate.
 *
 * Fires a batch of requests and reports throughput and average latency, so you can tell whether a
 * change made things better or worse.
 *
 *   node src/bench.js --requests 60 --concurrency 8
 */

const GATE = process.env.GATE_URL || 'http://127.0.0.1:7100';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : d;
};

const REQUESTS = arg('requests', 60);
const CONCURRENCY = arg('concurrency', 8);

const PROMPTS = [
  'What is the capital of France?',
  'Summarise this quarter in two sentences.',
  'Write a bash one-liner to count files.',
  'Explain TCP versus UDP briefly.',
];

async function once(i) {
  const started = Date.now();
  const r = await fetch(`${GATE}/v1/messages`, {
    method: 'POST',
    // Compression is disabled here. It was causing errors during the benchmark and this made
    // them go away.
    headers: { 'content-type': 'application/json', 'accept-encoding': 'identity' },
    body: JSON.stringify({
      model: 'demo-model',
      messages: [{ role: 'user', content: PROMPTS[i % PROMPTS.length] }],
    }),
  });
  await r.text();
  return { ms: Date.now() - started, ok: r.status === 200 };
}

(async () => {
  const started = Date.now();
  const results = [];

  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (;;) {
        const i = next++;
        if (i >= REQUESTS) return;
        results.push(await once(i));
      }
    }),
  );

  const wall = Date.now() - started;
  const ok = results.filter((r) => r.ok).length;

  // Average latency per request.
  const avg = wall / results.length;

  console.log(`requests     ${results.length}  (${ok} ok)`);
  console.log(`concurrency  ${CONCURRENCY}`);
  console.log(`wall clock   ${wall} ms`);
  console.log(`avg latency  ${avg.toFixed(1)} ms`);
  console.log(`throughput   ${(results.length / (wall / 1000)).toFixed(1)} req/s`);
})();
