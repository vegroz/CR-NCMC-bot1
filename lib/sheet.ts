const CACHE_TTL_MS = 60_000;

let cachedFaq = "";
let cacheAt = 0;

export async function getFaq(): Promise<string> {
  const now = Date.now();
  if (cachedFaq && now - cacheAt < CACHE_TTL_MS) {
    return cachedFaq;
  }

  const url = process.env.SHEET_CSV_URL;
  if (!url) {
    console.error("[sheet] SHEET_CSV_URL is not set");
    return "";
  }

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    cachedFaq = text;
    cacheAt = now;
    console.log("[sheet] FAQ refreshed, length:", text.length);
    return text;
  } catch (err) {
    console.error("[sheet] Failed to fetch FAQ:", err);
    return cachedFaq; // return stale cache if available
  }
}
