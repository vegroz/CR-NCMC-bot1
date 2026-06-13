"use client";

import { useEffect, useState } from "react";

interface Row {
  timestamp: string;
  question: string;
  answer: string;
  finish_reason: string;
  thinking_tokens: string;
  output_tokens: string;
}

function parseCSV(text: string): Row[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const rows: Row[] = [];
  for (let i = lines.length - 1; i >= 1; i--) {
    const cols = lines[i].split(",");
    rows.push({
      timestamp: cols[0] ?? "",
      question: cols[1] ?? "",
      answer: cols[2] ?? "",
      finish_reason: cols[3] ?? "",
      thinking_tokens: cols[4] ?? "0",
      output_tokens: cols[5] ?? "0",
    });
  }
  return rows;
}

export default function Dashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [auth, setAuth] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const PASS = process.env.NEXT_PUBLIC_DASHBOARD_PASSWORD ?? "admin1234";

  function login() {
    if (password === PASS) {
      setAuth(true);
      loadData();
    } else {
      setError("รหัสผ่านไม่ถูกต้อง");
    }
  }

  async function loadData() {
    const url = process.env.NEXT_PUBLIC_SHEET_LOG_CSV_URL;
    if (!url) { setLoading(false); return; }
    try {
      const res = await fetch(url, { cache: "no-store" });
      const text = await res.text();
      setRows(parseCSV(text));
    } catch {
      setError("โหลดข้อมูลไม่ได้");
    }
    setLoading(false);
  }

  const total = rows.length;
  const stopCount = rows.filter((r) => r.finish_reason === "STOP").length;
  const errorCount = rows.filter((r) => r.finish_reason === "ERROR").length;
  const defaultCount = rows.filter((r) => r.answer.includes("0 5315 0210")).length;

  if (!auth) {
    return (
      <main style={{ fontFamily: "sans-serif", maxWidth: 400, margin: "80px auto", padding: 24 }}>
        <h2 style={{ marginBottom: 24 }}>Dashboard — ศอ.ปส.จ.เชียงราย</h2>
        <input
          type="password"
          placeholder="รหัสผ่าน"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && login()}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12, boxSizing: "border-box" }}
        />
        <button onClick={login} style={{ width: "100%", padding: 10, fontSize: 16, background: "#1a73e8", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
          เข้าสู่ระบบ
        </button>
        {error && <p style={{ color: "red", marginTop: 12 }}>{error}</p>}
      </main>
    );
  }

  if (loading) return <p style={{ fontFamily: "sans-serif", padding: 40 }}>กำลังโหลด...</p>;

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h2 style={{ marginBottom: 24 }}>Dashboard — ศอ.ปส.จ.เชียงราย</h2>

      {/* stat cards */}
      <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
        {[
          { label: "ข้อความทั้งหมด", value: total, color: "#1a73e8" },
          { label: "ตอบสำเร็จ", value: stopCount, color: "#34a853" },
          { label: "ส่ง default message", value: defaultCount, color: "#fbbc04" },
          { label: "Error", value: errorCount, color: "#ea4335" },
        ].map((s) => (
          <div key={s.label} style={{ flex: "1 1 180px", background: "#f8f9fa", borderRadius: 10, padding: "20px 24px", borderTop: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ color: "#555", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* table */}
      <h3 style={{ marginBottom: 12 }}>ประวัติการสนทนา (ล่าสุดก่อน)</h3>
      {rows.length === 0 ? (
        <p style={{ color: "#888" }}>ยังไม่มีข้อมูล — ตั้งค่า SHEET_LOG_URL และ NEXT_PUBLIC_SHEET_LOG_CSV_URL ก่อนครับ</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f1f3f4", textAlign: "left" }}>
                {["วันที่-เวลา", "คำถาม", "คำตอบ", "ผล", "Thinking", "Output"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", border: "1px solid #e0e0e0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "8px 12px", border: "1px solid #e0e0e0", whiteSpace: "nowrap" }}>{r.timestamp}</td>
                  <td style={{ padding: "8px 12px", border: "1px solid #e0e0e0", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.question}</td>
                  <td style={{ padding: "8px 12px", border: "1px solid #e0e0e0", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.answer}</td>
                  <td style={{ padding: "8px 12px", border: "1px solid #e0e0e0", color: r.finish_reason === "STOP" ? "#34a853" : "#ea4335" }}>{r.finish_reason}</td>
                  <td style={{ padding: "8px 12px", border: "1px solid #e0e0e0", textAlign: "right" }}>{r.thinking_tokens}</td>
                  <td style={{ padding: "8px 12px", border: "1px solid #e0e0e0", textAlign: "right" }}>{r.output_tokens}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
