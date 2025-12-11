import { inngest } from "./client";
import { openai, grok, createAgent } from "@inngest/agent-kit";
import { Sandbox } from "@e2b/code-interpreter";
import { getSandbox } from "./utils";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event, step }) => {
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("nhung-builder-2");
      return sandbox.sandboxId;
    });
    const code_agent = createAgent({
      name: "code_agent",
      system: "You are an expert next.js developer.  You write readable, maintainable code. You write simple Next.js snippets",
      model: openai({ model: "gpt-4o-mini", apiKey: process.env.OPENAI_API_KEY! }),
    });
    await step.sleep("wait-a-moment", "5s");
    const {output} = await code_agent.run(event.data.input );

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host =  sandbox.getHost(3000);
      return `http://${host}`;
    });

    return { output, sandboxUrl };
  },
);