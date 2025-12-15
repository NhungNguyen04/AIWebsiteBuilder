import { inngest } from "@/src/inngest/client";
import prisma from "@/src/lib/db";
import { baseProcedure, createTRPCRouter } from "@/src/trpc/init";
import z from "zod";
import { generateSlug } from "random-word-slugs"

export const projectsRouter = createTRPCRouter ({
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
          .min(1, { message: "Value is required!"})
          .max(10000, { message: "Value is too long!"})
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
              type: "RESULT"
            }
          }
        }
      });

      await inngest.send({
        name: 'code-agent',
        data: { 
          input: input.value,
          projectId: createdProject.id 
        },
      });

      return createdProject;
    })
})