import { inngest } from "@/src/inngest/client";
import prisma from "@/src/lib/db";
import { baseProcedure, createTRPCRouter } from "@/src/trpc/init";
import z from "zod";

export const messagesRouter = createTRPCRouter ({
  create: baseProcedure
    .input(
      z.object({
        value: z.string().min(1, { message: "Message is required!"})
      })
    )
    .mutation(async ({ input }) => {
      const createdMessage = await prisma.message.create({
        data: {
          content: input.value,
          role: "USER",
          type: "RESULT"
        }
      });
      await inngest.send({
        name: 'code-agent',
        data: { input: input.value },
      });

      return createdMessage;
    })
})