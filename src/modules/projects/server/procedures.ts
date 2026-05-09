import { codeAgentQueue } from "@/src/lib/queue";
import prisma from "@/src/lib/db";
import { baseProcedure, createTRPCRouter } from "@/src/trpc/init";
import z from "zod";
import { generateSlug } from "random-word-slugs"
import { TRPCError } from "@trpc/server";

// Schema for file attachments
const fileAttachmentSchema = z.object({
  name: z.string(),
  type: z.string(),
  size: z.number(),
  content: z.string(),
});

export const projectsRouter = createTRPCRouter({
  getOne: baseProcedure
    .input(z.object({
      id: z.string().min(1, { message: "Project ID is required!" })
    }))
    .query(async ({ input }) => {
      const existingProject = await prisma.project.findUnique({
        where: { id: input.id },
      });

      if (!existingProject) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Project with ID ${input.id} not found.`,
        });
      }
      return existingProject;
    }),

  getMany: baseProcedure
    .query(async () => {
      const projects = await prisma.project.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return projects;
    }),

  create: baseProcedure
    .input(
      z.object({
        value: z.string()
          .min(1, { message: "Value is required!" })
          .max(10000, { message: "Value is too long!" }),
        attachments: z.array(fileAttachmentSchema).optional(), // ADD THIS LINE
      })
    )
    .mutation(async ({ input }) => {
      const createdProject = await prisma.project.create({
        data: {
          name: generateSlug(2, {
            format: "kebab",
          }),
          messages: {
            create: {
              content: input.value,
              role: "USER",
              type: "RESULT",
              attachments: input.attachments || [], // ADD THIS LINE
            }
          }
        }
      });

      await codeAgentQueue.add('code-agent', {
        input: input.value,
        projectId: createdProject.id,
        attachments: input.attachments,
      });

      return createdProject;
    })
})