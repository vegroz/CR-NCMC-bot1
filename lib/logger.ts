export interface LogEntry {
  question: string;
  answer: string;
  finishReason: string;
  thinkingTokens: number;
  outputTokens: number;
}

export async function logConversation(entry: LogEntry): Promise<void> {
  const url = process.env.SHEET_LOG_URL;
  if (!url) return;

  const timestamp = new Date().toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timestamp,
        question: entry.question,
        answer: entry.answer,
        finish_reason: entry.finishReason,
        thinking_tokens: entry.thinkingTokens,
        output_tokens: entry.outputTokens,
      }),
    });
  } catch (err) {
    console.error("[logger] Failed to log:", err);
  }
}
