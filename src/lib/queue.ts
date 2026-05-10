import { Queue } from 'bullmq';

export const codeAgentQueue = new Queue('code-agent', {
  connection: {
     url: process.env.REDIS_URL,
  },
});