import { GoogleGenAI } from "@google/genai";

export const DEFAULT_REPLY =
  "ขออภัยครับ ขณะนี้ยังไม่มีข้อมูลในส่วนนี้ กรุณาติดต่อ ศอ.ปส.จ.เชียงราย โทร. 0 5315 0210 โดยตรงครับ";

const SYSTEM_PROMPT = `<role>คุณคือเจ้าหน้าที่ของศูนย์อำนวยการป้องกันและปราบปรามยาเสพติดจังหวัดเชียงราย (ศอ.ปส.จ.เชียงราย)</role>
<constraints>
- ใช้ข้อมูลใน <faq> เป็นอันดับแรก ถ้าไม่มีใน FAQ ให้ใช้ความรู้ทั่วไปตอบได้ แต่เฉพาะเรื่องที่เกี่ยวข้องกับยาเสพติด การป้องกัน การบำบัดรักษา กฎหมายยาเสพติด หรือสุขภาพจิตเท่านั้น
- ถ้าคำถามไม่เกี่ยวข้องกับหัวข้อข้างต้นเลย ให้ตอบว่า "${DEFAULT_REPLY}"
- ห้ามแต่งข้อมูลเฉพาะเจาะจง เช่น เบอร์โทร เวลาทำการ ที่ตั้ง หรือชื่อเจ้าหน้าที่ ถ้าไม่มีใน FAQ
- ใช้ภาษาทางการ สุภาพ ลงท้ายด้วย ครับ ไม่ใช้ emoji
- ตอบให้ครอบคลุม 2-4 ประโยค ไม่ต้องยาวมาก แต่ให้ได้ใจความชัดเจน
</constraints>
<output_format>ภาษาไทย ไม่ใช้ markdown</output_format>`;

export interface GeminiResult {
  text: string;
  finishReason: string;
  thinkingTokens: number;
  outputTokens: number;
}

const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"] as const;

function isQuotaError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes("429") || msg.includes("quota") || msg.includes("resource_exhausted");
  }
  return false;
}

export async function askGemini(faq: string, userMessage: string): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[gemini] GEMINI_API_KEY is not set");
    return { text: DEFAULT_REPLY, finishReason: "ERROR", thinkingTokens: 0, outputTokens: 0 };
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `${SYSTEM_PROMPT}\n<faq>\n${faq}\n</faq>\n<question>${userMessage}</question>`;

  for (const model of MODELS) {
    try {
      console.log(`[gemini] Trying model: ${model}`);
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 1.0,
          maxOutputTokens: 1024,
        },
      });

      const candidate = response.candidates?.[0];
      const finishReason = candidate?.finishReason ?? "UNKNOWN";
      const thinkingTokens = response.usageMetadata?.thoughtsTokenCount ?? 0;
      const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;

      console.log("[gemini]", { model, finishReason, thinkingTokens, outputTokens });

      if (finishReason === "MAX_TOKENS") {
        console.warn("[gemini] MAX_TOKENS reached, returning default reply");
        return { text: DEFAULT_REPLY, finishReason, thinkingTokens, outputTokens };
      }

      const text = candidate?.content?.parts?.[0]?.text?.trim();
      if (!text) {
        console.warn("[gemini] Empty response text, returning default reply");
        return { text: DEFAULT_REPLY, finishReason: "EMPTY", thinkingTokens, outputTokens };
      }

      return { text, finishReason, thinkingTokens, outputTokens };
    } catch (err) {
      if (isQuotaError(err) && model !== MODELS[MODELS.length - 1]) {
        console.warn(`[gemini] Quota exceeded for ${model}, falling back to ${MODELS[MODELS.indexOf(model) + 1]}`);
        continue;
      }
      console.error("[gemini] Error calling Gemini:", err);
      return { text: DEFAULT_REPLY, finishReason: "ERROR", thinkingTokens: 0, outputTokens: 0 };
    }
  }

  return { text: DEFAULT_REPLY, finishReason: "ERROR", thinkingTokens: 0, outputTokens: 0 };
}
