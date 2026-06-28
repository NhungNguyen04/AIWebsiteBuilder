import { Worker } from 'bullmq';
import { openai, createAgent, createTool, createNetwork, Tool, Message, createState } from "@inngest/agent-kit";
import { Sandbox } from "@e2b/code-interpreter";
import { getSandbox, lastAssistantTextMessageContent } from "../lib/sandbox";
import z from "zod";
import { PROMPT, PROMPT_WITH_DOCS, FRAGMENT_TITLE_PROMPT, RESPONSE_PROMPT } from "../prompt";
import prisma from "../lib/db";
import { codeAgentQueue } from '../lib/queue';

interface AgentState {
  summary: string;
  files: {[path: string]: string};
}

interface FileAttachment {
  name: string;
  type: string;
  size: number;
  content: string;
}

class JobCancelledError extends Error {
  constructor() {
    super('Job was cancelled by user');
    this.name = 'JobCancelledError';
  }
}

// The Job row is created by the tRPC router right after codeAgentQueue.add()
// returns, but that write can land *after* this worker has already picked
// the job up. Poll briefly rather than fail outright on the (rare) race.
async function findJobRecordWithRetry(bullJobId: string, attempts = 5, delayMs = 200) {
  for (let i = 0; i < attempts; i++) {
    const jobRecord = await prisma.job.findUnique({ where: { bullJobId } });
    if (jobRecord) return jobRecord;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

async function checkCancelled(jobRecordId: string) {
  const jobRecord = await prisma.job.findUnique({
    where: { id: jobRecordId },
    select: { cancelRequested: true },
  });
  if (jobRecord?.cancelRequested) {
    throw new JobCancelledError();
  }
}

const worker = new Worker('code-agent', async (job) => {
  const { input, projectId, attachments } = job.data;

  console.log(`Processing job ${job.id} for project ${projectId}`);

  const jobRecord = await findJobRecordWithRetry(job.id!);
  if (!jobRecord) {
    // Should be rare (see comment above) — without a Job row there's
    // nothing to check cancellation against, so fail loudly rather than
    // run an uncancellable job silently.
    throw new Error(`No Job record found for bullJobId ${job.id}. Refusing to run uncancellable job.`);
  }

  await prisma.job.update({
    where: { id: jobRecord.id },
    data: { status: 'RUNNING' },
  });

  const sandbox = await Sandbox.create("nhung-builder-2");
  const sandboxId = sandbox.sandboxId;

  try {
    const messages = await prisma.message.findMany({
      where: {
        projectId: projectId
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const formattedMessages: Message[] = [];
    for (const message of messages) {
      formattedMessages.push({
        type: "text",
        role: message.role === "ASSISTANT" ? "assistant" : "user",
        content: message.content
      })
    }

    // Prepare system prompt based on whether docs are attached
    let systemPrompt: string;
    if (attachments && attachments.length > 0) {
      // Combine all document contents
      const documentation = attachments
        .map((att: { name: string; content: string }) => `=== File: ${att.name} ===\n${att.content}`)
        .join('\n\n');

      systemPrompt = PROMPT_WITH_DOCS
        .replace('{documentation}', documentation)
        .replace('{userInput}', input);
    } else {
      systemPrompt = PROMPT;
    }
    const state = createState<AgentState>(
      {
        summary: "",
        files: {}
      },
      {
        messages: formattedMessages
      }
    );

    const codeAgent = createAgent<AgentState>({
      name: "code_agent",
      description: "An expert coding agent",
      system: systemPrompt,
      model: openai({ model: "gpt-4.1", apiKey: process.env.OPENAI_API_KEY! }),
      tools: [
        createTool({
          name: "terminal",
          description: "Use the terminal to run commands",
          parameters: z.object({
            command: z.string(),
          }),
          handler: async ({ command }, { step }) => {
            // Checkpoint before kicking off a (potentially slow) command —
            // catches cancellation requested while we were between tool calls.
            await checkCancelled(jobRecord.id);

            const buffers = { stdout: "", stderr: "" };

            try {
              const result = await sandbox.commands.run(command, {
                onStdout: (data: string) => { buffers.stdout += data; },
                onStderr: (data: string) => { buffers.stderr += data; },
              });
              return result.stdout;
            } catch (e) {
              console.error(`Command failed: ${e} \nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`);
              return `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`;
            }
          }
        }),
        createTool({
          name: "createOrUpdateFiles",
          description: "Create or update file in the sandbox",
          parameters: z.object({
            files: z.array(
              z.object({
                path: z.string(),
                content: z.string(),
              })
            ),
          }),
          handler: async ({ files }, { step, network }: Tool.Options<AgentState>) => {
            await checkCancelled(jobRecord.id);

            const updatedFiles = network.state.data.files || {};
            for (const file of files) {
              updatedFiles[file.path] = file.content;
              await sandbox.files.write(file.path, file.content);
            }
            network.state.data.files = updatedFiles;
          }
        }),
        createTool({
          name: "readFiles",
          description: "Read files from the sandbox",
          parameters: z.object({
            files: z.array(z.string()),
          }),
          handler: async ({ files }, { step }) => {
            await checkCancelled(jobRecord.id);

            const fileContents = [];
            for (const filePath of files) {
              const content = await sandbox.files.read(filePath);
              fileContents.push({path: filePath, content});
            }
            return JSON.stringify(fileContents);
          }
        })
      ],
      lifecycle: {
        onStart: async ({ prompt, history, network }) => {
          // Checkpoint before every agent turn — the most frequent, lowest-
          // latency place to notice "stop" was pressed. agent-kit's onStart
          // contract requires echoing back prompt/history alongside stop;
          // `history` comes in as possibly-undefined but must go out
          // defined, so default it to [] rather than passing it through.
          await checkCancelled(jobRecord.id);
          return { prompt, history: history ?? [], stop: false };
        },
        onResponse: async ({ result, network }) => {
          await checkCancelled(jobRecord.id);

          const lastAssistantMessageText = lastAssistantTextMessageContent(result);

          if (lastAssistantMessageText && network) {
            if (lastAssistantMessageText.includes("<task_summary>")) {
              network.state.data.summary = lastAssistantMessageText;
            }
          }

          return result;
        }
      }
    });

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      defaultState: state,
      router: async ({ network }) => {
        await checkCancelled(jobRecord.id);

        const summary = network.state.data.summary;

        if (summary) {
          return;
        }

        return codeAgent;
      }
    });

    const result = await network.run(input, { state });

    const fragmentTitleGenerator = createAgent({
      name: "fragment_title_generator",
      description: "A fragment title generator",
      system: FRAGMENT_TITLE_PROMPT,
      model: openai({ model: "gpt-4o-mini"}),
    });

    const responseGenerator = createAgent({
      name: "response_generator",
      description: "A response generator",
      system: RESPONSE_PROMPT,
      model: openai({ model: "gpt-4o-mini"}),
    });

    const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(result.state.data.summary);
    const { output: responseOutput } = await responseGenerator.run(result.state.data.summary);

    const generateFragmentTitle = () => {
      if(fragmentTitleOutput[0].type !== "text") {
        return "Fragment";
      }

      if (Array.isArray(fragmentTitleOutput[0].content)) {
        return fragmentTitleOutput[0].content.map((txt) => txt).join("");
      } else {
        return fragmentTitleOutput[0].content;
      }
    }

    const generateResponse = () => {
      if(responseOutput[0].type !== "text") {
        return "Here is the result";
      }

      if (Array.isArray(responseOutput[0].content)) {
        return responseOutput[0].content.map((txt) => txt).join("");
      } else {
        return responseOutput[0].content;
      }
    }

    const isError =
      !result.state.data.summary ||
      Object.keys(result.state.data.files || {}).length === 0;

    const sandboxUrl = `https://${sandbox.getHost(3000)}`;

    if (isError) {
      await prisma.message.create({
        data: {
          content: "Something went wrong",
          role: "ASSISTANT",
          type: "ERROR",
          projectId: projectId
        }
      });
      await prisma.job.update({
        where: { id: jobRecord.id },
        data: { status: 'FAILED' },
      });
    } else {
      await prisma.message.create({
        data: {
          content: generateResponse(),
          role: "ASSISTANT",
          type: "RESULT",
          fragment: {
            create: {
              sandboxUrl: sandboxUrl,
              title: generateFragmentTitle(),
              files: result.state.data.files
            }
          },
          projectId: projectId
        }
      });
      await prisma.job.update({
        where: { id: jobRecord.id },
        data: { status: 'COMPLETED' },
      });
    }

    return {
      url: sandboxUrl,
      title: generateFragmentTitle(),
      files: result.state.data.files,
      summary: result.state.data.summary
    };

  } catch (e) {
    if (e instanceof JobCancelledError) {
      console.log(`Job ${job.id} cancelled by user`);

      await prisma.job.update({
        where: { id: jobRecord.id },
        data: { status: 'CANCELLED' },
      });

      await prisma.message.create({
        data: {
          content: "Generation stopped.",
          role: "ASSISTANT",
          type: "ERROR",
          projectId: projectId
        }
      });

      // Cancelled runs have no Fragment pointing at this sandbox, so
      // nothing else will ever use it — safe (and necessary) to kill it
      // here to avoid leaking E2B sessions.
      await sandbox.kill().catch((err) => console.error(`Failed to kill sandbox ${sandboxId}`, err));

      // Don't rethrow — this isn't a failure from BullMQ's point of view,
      // it's an intentional stop. Rethrowing would mark the bull job
      // 'failed' and could trigger retry/backoff config unrelated to ours.
      return { cancelled: true };
    }

    console.error(`Job ${job.id} failed:`, e);

    await prisma.job.update({
      where: { id: jobRecord.id },
      data: { status: 'FAILED' },
    }).catch((updateErr) => console.error('Failed to mark job as FAILED', updateErr));

    // Failed runs likewise produce no Fragment — nothing references this
    // sandbox afterward, so it's safe to clean up.
    await sandbox.kill().catch((err) => console.error(`Failed to kill sandbox ${sandboxId}`, err));

    throw e;
  }
  // NOTE: no `finally` here. On the success path above, sandboxUrl is
  // persisted on the new Fragment and the preview iframe needs that
  // sandbox to stay alive — killing it here would make every successful
  // run immediately show "Sandbox Not Found" in the preview pane.
}, {
  connection: {
     url: process.env.REDIS_URL,
  },
});

// Handle worker events
worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

console.log('Code agent worker started');