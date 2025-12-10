import { inngest } from "./client";
import { openai, grok, createAgent } from "@inngest/agent-kit";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event, step }) => {
    const summarizer = createAgent({
      name: "writer",
      system: "You are an expert summarizer.  You summarize input into two words",
      model: openai({ model: "gpt-4o-mini", apiKey: process.env.OPENAI_API_KEY! }),
    });
    await step.sleep("wait-a-moment", "5s");
    const {output} = await summarizer.run(event.data.input );
    return { message: `Summary: ${output}` };
  },
);