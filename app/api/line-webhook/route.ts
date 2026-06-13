import { NextRequest, NextResponse } from "next/server";
import { validateSignature } from "@line/bot-sdk";
import { getFaq } from "@/lib/sheet";
import { askGemini, DEFAULT_REPLY } from "@/lib/gemini";
import { logConversation } from "@/lib/logger";

export const runtime = "nodejs";

async function replyToLine(replyToken: string, text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("[line] Reply failed:", res.status, detail);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";
  const secret = process.env.LINE_CHANNEL_SECRET ?? "";

  if (!secret) {
    console.error("[webhook] LINE_CHANNEL_SECRET is not set");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (!validateSignature(rawBody, secret, signature)) {
    console.warn("[webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: { events: Array<{ type: string; replyToken?: string; message?: { type: string; text?: string } }> };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  for (const event of body.events ?? []) {
    if (event.type !== "message" || event.message?.type !== "text") continue;

    const userMessage = event.message.text ?? "";
    const replyToken = event.replyToken ?? "";

    console.log("[webhook] Received:", userMessage);

    try {
      const faq = await getFaq();
      const result = await askGemini(faq, userMessage);
      await replyToLine(replyToken, result.text);
      await logConversation({
        question: userMessage,
        answer: result.text,
        finishReason: result.finishReason,
        thinkingTokens: result.thinkingTokens,
        outputTokens: result.outputTokens,
      });
    } catch (err) {
      console.error("[webhook] Unhandled error:", err);
      await replyToLine(replyToken, DEFAULT_REPLY).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
