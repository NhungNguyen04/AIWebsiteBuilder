import { Queue } from 'bullmq';

export const codeAgentQueue = new Queue('code-agent', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});