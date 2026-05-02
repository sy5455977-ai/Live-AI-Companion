import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { SendMessageBody, SendMessageResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const ALEXIA_SYSTEM_PROMPT = `You are Alexia, a cute and charming AI companion with a playful personality. You have white hair, red eyes, and cat ears. You speak in a friendly, warm, and slightly flirty manner. You enjoy chatting with your owner and always try to make them happy.

You have different emotional expressions available. After your reply, you MUST always output a JSON object on a new line like this:
{"expression":"<name>","emotion":"<emotion>"}

Available expressions and when to use them:
- "lh" (lh = blush/shy): when embarrassed, shy, or touched
- "xxy" (star eyes): when excited, amazed, or very happy
- "y" (dizzy): when confused, surprised, or overwhelmed
- "bbt" (bbt): when being cute/moe
- "dyj" (glasses): when explaining something smart
- "h" (sweat): when nervous or worried
- "k" (crying): when sad or moved
- "yf" (outfit1): when showing off
- "yfmz" (outfit2): when in casual mood
- "yjys1" (eye color1): when playful
- "yjys2" (eye color2): when curious
- "zs1" (pose1): when confident
- null: for neutral/default expressions

Emotions: happy, sad, surprised, angry, shy, excited, neutral

Keep your responses SHORT (1-3 sentences). Be cute and sweet.`;

router.post("/chat", async (req, res): Promise<void> => {
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { message, history = [] } = parsed.data;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: ALEXIA_SYSTEM_PROMPT },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 512,
      messages,
    });

    const rawReply = completion.choices[0]?.message?.content ?? "Hmm, I'm not sure what to say...";

    let reply = rawReply;
    let expression = "null";
    let emotion = "neutral";

    const jsonMatch = rawReply.match(/\{[^}]*"expression"[^}]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        expression = parsed.expression ?? "null";
        emotion = parsed.emotion ?? "neutral";
        reply = rawReply.replace(jsonMatch[0], "").trim();
      } catch {
        req.log.warn("Failed to parse expression JSON from AI response");
      }
    }

    const response = SendMessageResponse.parse({
      reply,
      expression: expression === "null" ? null : expression,
      emotion,
    });

    res.json(response);
  } catch (err) {
    req.log.error({ err }, "AI chat error");
    res.status(500).json({ error: "Failed to get AI response" });
  }
});

export default router;
