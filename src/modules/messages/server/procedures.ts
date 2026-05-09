import { codeAgentQueue } from "@/src/lib/queue";
import prisma from "@/src/lib/db";
import { baseProcedure, createTRPCRouter } from "@/src/trpc/init";
import z from "zod";

// Schema for file attachments
const fileAttachmentSchema = z.object({
  name: z.string(),
  type: z.string(),
  size: z.number(),
  content: z.string(),
});

export const messagesRouter = createTRPCRouter({
  getMany: baseProcedure
    .input(z.object({
      projectId: z.string().min(1, { message: "Project ID is required!" })
    }))
    .query(async ({ input }) => {
      const messages = await prisma.message.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: 'asc' },
        include: { fragment: true },
      });
      return messages;
    }),

  create: baseProcedure
    .input(
      z.object({
        value: z.string()
          .min(1, { message: "Value is required!" })
          .max(10000, { message: "Value is too long!" }),
        projectId: z.string().min(1, { message: "Project ID is required!" }),
        attachments: z.array(fileAttachmentSchema).optional(), // Add this
      })
    )
    .mutation(async ({ input }) => {
      const createdMessage = await prisma.message.create({
        data: {
          content: input.value,
          role: "USER",
          type: "RESULT",
          projectId: input.projectId,
          attachments: input.attachments || [], // Store attachments
        }
      });

      await codeAgentQueue.add('code-agent', {
        input: input.value,
        projectId: input.projectId,
        attachments: input.attachments,
      });

      return createdMessage;
    })
})