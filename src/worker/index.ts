// Standalone worker process (Phase 6a) - consumes the BullMQ "generation"
// queue so long-running AI generation survives a web-container restart/deploy,
// not just a client disconnect (which the AgentSession/RSession polling
// pattern already handled before this). Built separately from the Next.js
// app via `npm run build:worker` (esbuild) and run in its own Docker service
// (see Dockerfile's `worker` stage, docker-compose.yml's `worker` service).
//
// Deliberately NOT a Next.js entrypoint - plain Node, no next/* imports.

import http from 'node:http';
import { Worker, type Job } from 'bullmq';
import { QUEUE_NAME, getRedisConnection } from '@/lib/queue';
import { runReportGenerate, runReportEdit } from '@/lib/jobs/reportGenerate';
import { runAnalyticsGenerate } from '@/lib/jobs/analyticsGenerate';
import { runRMultiGenerate } from '@/lib/jobs/rMultiGenerate';
import { runBotVisualGenerate } from '@/lib/jobs/botVisualGenerate';

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY) || 3;
const HEALTH_PORT = Number(process.env.WORKER_HEALTH_PORT) || 8090;

async function dispatch(job: Job): Promise<void> {
    switch (job.name) {
        case 'report-generate':
            return runReportGenerate(job.data);
        case 'report-edit':
            return runReportEdit(job.data);
        case 'analytics-generate':
            return runAnalyticsGenerate(job.data);
        case 'r-multi-generate':
            return runRMultiGenerate(job.data);
        case 'bot-visual-generate':
            return runBotVisualGenerate(job.data);
        default:
            throw new Error(`Unknown job name: ${job.name}`);
    }
}

const worker = new Worker(QUEUE_NAME, dispatch, {
    connection: getRedisConnection(),
    concurrency: CONCURRENCY,
});

worker.on('completed', (job) => {
    console.log(`[worker] ${job.name} (${job.id}) completed`);
});

worker.on('failed', (job, err) => {
    console.error(`[worker] ${job?.name} (${job?.id}) failed:`, err);
});

worker.on('error', (err) => {
    // Connection-level errors (Redis down, etc.) - BullMQ retries internally,
    // this is just visibility so it shows up in `docker logs`.
    console.error('[worker] error:', err);
});

console.log(`[worker] listening on queue "${QUEUE_NAME}" with concurrency ${CONCURRENCY}`);

// Minimal liveness endpoint for Docker HEALTHCHECK (matches the wget --spider
// pattern already used by every other service in docker-compose.yml).
http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
        return;
    }
    res.writeHead(404);
    res.end();
}).listen(HEALTH_PORT, () => {
    console.log(`[worker] health endpoint on :${HEALTH_PORT}/health`);
});

async function shutdown(signal: string) {
    console.log(`[worker] received ${signal}, closing gracefully...`);
    await worker.close();
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
