import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { getFaq } from "@/lib/sheet";
import { askGemini } from "@/lib/gemini";

const DEFAULT_REPLY =
  "ขออภัยครับ ขณะนี้ยังไม่มีข้อมูลในส่วนนี้ กรุณาติดต่อ ศอ.ปส.จ.เชียงราย โทร. 0 5315 0210 โดยตรงครับ";

function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET ?? "";
  const hash = crypto
    .createHmac("SHA256", secret)
    .update(body)
    .digest("base64");
  return hash === signature;
}

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

  if (!verifySignature(rawBody, signature)) {
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

    // Process async but must finish before Vercel function times out (10s)
    try {
      const faq = await getFaq();
      const reply = await askGemini(faq, userMessage);
      await replyToLine(replyToken, reply);
    } catch (err) {
      console.error("[webhook] Unhandled error:", err);
      await replyToLine(replyToken, DEFAULT_REPLY).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
