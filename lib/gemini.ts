import { GoogleGenAI } from "@google/genai";

const DEFAULT_REPLY =
  "ขออภัยครับ ขณะนี้ยังไม่มีข้อมูลในส่วนนี้ กรุณาติดต่อ ศอ.ปส.จ.เชียงราย โทร. 0 5315 0210 โดยตรงครับ";

const SYSTEM_PROMPT = `<role>คุณคือเจ้าหน้าที่ของศูนย์อำนวยการป้องกันและปราบปรามยาเสพติดจังหวัดเชียงราย (ศอ.ปส.จ.เชียงราย)</role>
<constraints>
- ใช้ข้อมูลใน <faq> เป็นอันดับแรก ถ้าไม่มีใน FAQ ให้ใช้ความรู้ทั่วไปตอบได้ แต่เฉพาะเรื่องที่เกี่ยวข้องกับยาเสพติด การป้องกัน การบำบัดรักษา กฎหมายยาเสพติด หรือสุขภาพจิตเท่านั้น
- ถ้าคำถามไม่เกี่ยวข้องกับหัวข้อข้างต้นเลย ให้ตอบว่า "${DEFAULT_REPLY}"
- ห้ามแต่งข้อมูลเฉพาะเจาะจง เช่น เบอร์โทร เวลาทำการ ที่ตั้ง หรือชื่อเจ้าหน้าที่ ถ้าไม่มีใน FAQ
- ใช้ภาษาทางการ สุภาพ ลงท้ายด้วย ครับ ไม่ใช้ emoji
- ตอบสั้นกระชับ 1-3 ประโยค
</constraints>
<output_format>ภาษาไทย ไม่ใช้ markdown</output_format>`;

export async function askGemini(faq: string, userMessage: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[gemini] GEMINI_API_KEY is not set");
    return DEFAULT_REPLY;
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `${SYSTEM_PROMPT}\n<faq>\n${faq}\n</faq>\n<question>${userMessage}</question>`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
      config: {
        temperature: 1.0,
        maxOutputTokens: 1024,
      },
    });

    const candidate = response.candidates?.[0];
    const finishReason = candidate?.finishReason;
    const thoughtsTokenCount = response.usageMetadata?.thoughtsTokenCount ?? 0;
    const candidatesTokenCount = response.usageMetadata?.candidatesTokenCount ?? 0;

    console.log("[gemini]", { finishReason, thoughtsTokenCount, candidatesTokenCount });

    if (finishReason === "MAX_TOKENS") {
      console.warn("[gemini] MAX_TOKENS reached, returning default reply");
      return DEFAULT_REPLY;
    }

    const text = candidate?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      console.warn("[gemini] Empty response text, returning default reply");
      return DEFAULT_REPLY;
    }

    return text;
  } catch (err) {
    console.error("[gemini] Error calling Gemini:", err);
    return DEFAULT_REPLY;
  }
}
