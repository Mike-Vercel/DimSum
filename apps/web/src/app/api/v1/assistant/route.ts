import { z } from "zod";
import { apiRoute } from "@/server/http";
import { askAssistant, assistantMessages } from "@/server/services/assistant";

export const maxDuration = 60;

/** "Dim", the site assistant: one answer per call (the client keeps the conversation). */
export const POST = apiRoute(
  { auth: "public", rateLimit: { name: "assistant", limit: 20, windowSeconds: 60 } },
  async ({ body }) => {
    const { messages } = await body(z.object({ messages: assistantMessages }));
    return askAssistant(messages);
  },
);
