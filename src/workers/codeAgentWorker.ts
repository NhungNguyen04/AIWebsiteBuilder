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

const worker = new Worker('code-agent', async (job) => {
  const { input, projectId, attachments } = job.data;

  console.log(`Processing job ${job.id} for project ${projectId}`);

  const sandbox = await Sandbox.create("nhung-builder-2");
  const sandboxId = sandbox.sandboxId;

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
      onResponse: async ({ result, network }) => {
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

  const sandboxUrl = `http://${sandbox.getHost(3000)}`;

  if (isError) {
    await prisma.message.create({
      data: {
        content: "Something went wrong",
        role: "ASSISTANT",
        type: "ERROR",
        projectId: projectId
      }
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
  }

  return {
    url: sandboxUrl,
    title: generateFragmentTitle(),
    files: result.state.data.files,
    summary: result.state.data.summary
  };
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