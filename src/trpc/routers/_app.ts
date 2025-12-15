import { projectsRouter } from '@/src/modules/projects/server/procedures';
import { createTRPCRouter } from '../init';
import { messagesRouter } from '@/src/modules/messages/server/procedures';

export const appRouter = createTRPCRouter({
  messages: messagesRouter,
  projects: projectsRouter
})

export type AppRouter = typeof appRouter;