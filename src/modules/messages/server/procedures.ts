import { codeAgentQueue } from "@/src/lib/queue";
import prisma from "@/src/lib/db";
import { baseProcedure, createTRPCRouter } from "@/src/trpc/init";
import z from "zod";
import { TRPCError } from "@trpc/server";

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
        include: {
          fragment: true,
          // Only need the latest job per message; take(1) ordered desc
          // gives us "current attempt" without pulling full history.
          jobs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
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
        attachments: z.array(fileAttachmentSchema).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const createdMessage = await prisma.message.create({
        data: {
          content: input.value,
          role: "USER",
          type: "RESULT",
          projectId: input.projectId,
          attachments: input.attachments || [],
        }
      });

      const bullJob = await codeAgentQueue.add('code-agent', {
        input: input.value,
        projectId: input.projectId,
        attachments: input.attachments,
      });

      await prisma.job.create({
        data: {
          bullJobId: bullJob.id!,
          projectId: input.projectId,
          messageId: createdMessage.id,
          input: input.value,
          attachments: input.attachments || [],
          status: 'QUEUED',
        },
      });

      return createdMessage;
    }),

  // Signal a running/queued job to stop. If it's still sitting in the
  // queue (not yet picked up by a worker), remove it outright. If a
  // worker already has it, flip cancelRequested and let the worker's
  // own checkpoints notice and unwind (see worker code).
  stop: baseProcedure
    .input(z.object({
      jobId: z.string().min(1, { message: "Job ID is required!" }),
    }))
    .mutation(async ({ input }) => {
      const jobRecord = await prisma.job.findUnique({ where: { id: input.jobId } });
      if (!jobRecord) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Job with ID ${input.jobId} not found.` });
      }

      if (jobRecord.status !== 'QUEUED' && jobRecord.status !== 'RUNNING') {
        // Already finished one way or another — nothing to stop.
        return jobRecord;
      }

      const bullJob = await codeAgentQueue.getJob(jobRecord.bullJobId);

      if (bullJob) {
        const state = await bullJob.getState();
        if (state === 'waiting' || state === 'delayed') {
          // Not picked up yet — just remove it, no worker to signal.
          await bullJob.remove();
          return prisma.job.update({
            where: { id: input.jobId },
            data: { status: 'CANCELLED' },
          });
        }
      }

      // Already active (or BullMQ has no record, e.g. after a redis flush) —
      // set the flag; the worker polls this at its own checkpoints.
      return prisma.job.update({
        where: { id: input.jobId },
        data: { cancelRequested: true },
      });
    }),

  // Resubmit a previous job's input as a brand new attempt, attached to
  // the same message. Only allowed once the previous attempt has actually
  // stopped, so we don't end up with two workers touching the same
  // sandbox/files concurrently.
  retry: baseProcedure
    .input(z.object({
      jobId: z.string().min(1, { message: "Job ID is required!" }),
    }))
    .mutation(async ({ input }) => {
      const previousJob = await prisma.job.findUnique({ where: { id: input.jobId } });
      if (!previousJob) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Job with ID ${input.jobId} not found.` });
      }

      if (previousJob.status === 'QUEUED' || previousJob.status === 'RUNNING') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This job is still in progress. Stop it before retrying.',
        });
      }

      const bullJob = await codeAgentQueue.add('code-agent', {
        input: previousJob.input,
        projectId: previousJob.projectId,
        attachments: previousJob.attachments,
      });

      const newJob = await prisma.job.create({
        data: {
          bullJobId: bullJob.id!,
          projectId: previousJob.projectId,
          messageId: previousJob.messageId,
          input: previousJob.input,
          attachments: previousJob.attachments ?? undefined,
          status: 'QUEUED',
        },
      });

      return newJob;
    }),
})