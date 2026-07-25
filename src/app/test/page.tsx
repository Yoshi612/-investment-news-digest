"use client";

import { useState } from "react";

interface DigestApiResult {
  ok: boolean;
  error?: string;
  slotHourJst?: number;
  sinceIso?: string;
  articleCount?: number;
  message?: string;
  sent?: boolean;
  picks?: Array<{ headline: string; summary: string; impact: string; importanceScore: number }>;
}

export default function TestPage() {
  const [secret, setSecret] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DigestApiResult | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/notify/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, dryRun }),
      });
      const data = (await res.json()) as DigestApiResult;
      setResult(data);
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>ニュース配信 動作確認</h1>
      <p>CRON_SECRET と同じ値を入力し、実行してください。「プレビューのみ」を外すと実際にLINEへ送信されます。</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
        <label>
          Secret:{" "}
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            style={{ width: 240 }}
          />
        </label>
        <label>
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} /> プレビューのみ（LINEへ送信しない）
        </label>
        <button onClick={run} disabled={loading} style={{ width: 160 }}>
          {loading ? "実行中..." : "実行する"}
        </button>
      </div>

      {result && (
        <section style={{ marginTop: 24 }}>
          <h2>結果</h2>
          {!result.ok && <p style={{ color: "red" }}>エラー: {result.error}</p>}
          {result.ok && (
            <>
              <p>
                対象時間帯: {result.slotHourJst}時 / 収集記事数: {result.articleCount} / 送信:{" "}
                {result.sent ? "済み" : "プレビューのみ"}
              </p>
              <pre style={{ whiteSpace: "pre-wrap", background: "#f5f5f5", padding: 12, borderRadius: 8 }}>
                {result.message}
              </pre>
            </>
          )}
        </section>
      )}
    </main>
  );
}
