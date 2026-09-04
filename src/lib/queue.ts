import { Queue } from 'bullmq';
import Redis from 'ioredis';

// Shared BullMQ setup for both the Next.js web process (producer - routes call
// getQueue().add(...)) and the standalone worker process (consumer - see
// src/worker/index.ts). Lazy-initialized (not read at module load) so tests
// and code paths that never touch the queue don't need REDIS_URL set.

export const QUEUE_NAME = 'generation';

export type JobName =
    | 'report-generate'
    | 'report-edit'
    | 'analytics-generate'
    | 'r-multi-generate'
    | 'bot-visual-generate';

const globalForQueue = global as unknown as { redisConnection?: Redis; queue?: Queue };

export function getRedisConnection(): Redis {
    if (!globalForQueue.redisConnection) {
        const url = process.env.REDIS_URL;
        if (!url) throw new Error('REDIS_URL is not set - required for the background job queue.');
        // maxRetriesPerRequest: null is required by BullMQ's blocking commands.
        globalForQueue.redisConnection = new Redis(url, { maxRetriesPerRequest: null });
    }
    return globalForQueue.redisConnection;
}

export function getQueue(): Queue {
    if (!globalForQueue.queue) {
        globalForQueue.queue = new Queue(QUEUE_NAME, {
            connection: getRedisConnection(),
            defaultJobOptions: {
                attempts: 1,
                removeOnComplete: { age: 60 * 60 * 24 },      // 1 day
                removeOnFail: { age: 60 * 60 * 24 * 7 },      // 7 days
            },
        });
    }
    return globalForQueue.queue;
}
