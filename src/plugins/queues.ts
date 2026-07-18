import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    queues: {
      assessmentQueue: { add: (name: string, data: any) => Promise<void> } | Queue;
    };
  }
}

const queuesPlugin: FastifyPluginAsync = async (fastify, options) => {
  const useMock = !process.env.REDIS_URL;
  let assessmentQueue: any;

  if (useMock) {
    fastify.log.warn('Using mock in-memory queue fallback for assessmentQueue');
    assessmentQueue = {
      add: async (name: string, data: any) => {
        fastify.log.info(`[MOCK QUEUE] Job added: ${name} with data ${JSON.stringify(data)}`);
      }
    };
  } else {
    const connection = new IORedis(process.env.REDIS_URL as string, { maxRetriesPerRequest: null });
    assessmentQueue = new Queue('AssessmentQueue', { connection });
    
    const worker = new Worker('AssessmentQueue', async job => {
      fastify.log.info(`Processing job ${job.id}`);
    }, { connection });
    
    fastify.addHook('onClose', async () => {
      await worker.close();
      await assessmentQueue.close();
      await connection.quit();
    });
  }

  fastify.decorate('queues', { assessmentQueue });
};

export default fp(queuesPlugin);