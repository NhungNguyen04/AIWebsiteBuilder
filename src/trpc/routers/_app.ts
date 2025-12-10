import {z} from 'zod';
import { baseProcedure, createTRPCRouter } from '../init';
import { inngest } from '@/src/inngest/client';

export const appRouter = createTRPCRouter({
  invoke: baseProcedure
    .input(
      z.object({
        input: z.string(),
      }),
    )
    .mutation(async (input) => {
      await inngest.send({
        name: 'test/hello.world',
        data: { input: input.input.input },
      })
    }),
  hello: baseProcedure
    .input(
      z.object({
        text: z.string(),
      }),
    )
    .query((opts) => {
      return {
        greeting:  `hello ${opts.input.text}`
      }
    })
})

export type AppRouter = typeof appRouter;