import { generateText, tool, gateway } from "ai";
import { z } from "zod";
import type { Article } from "./fetchNews";
import { WATCHLIST } from "./watchlist";

// Vercel AI Gatewayの無料枠ではAnthropicモデルが使えないため、無料枠内で使えるモデルを使用。
// このモデルは素のJSON出力指示には従わずMarkdown文章で答えてしまうことがあるため、
// ツール呼び出し（Function Calling）を強制する形で構造化データを取得する。
const SUMMARIZE_MODEL = gateway("zai/glm-4.6v-flash");

// プライマリモデルが障害・レート制限で使えない場合に備え、AI Gatewayで無料（$0）提供されている
// 他のtool-use対応モデルにフォールバックする（いずれも追加コストなし）。
const FALLBACK_MODELS = ["poolside/laguna-s-2.1-free", "inclusionai/ling-3.0-flash-free"];

const pickSchema = z.object({
  picks: z
    .array(
      z.object({
        index: z.number().describe("元記事リストでのインデックス番号"),
        headline: z.string().describe("投資家向けに整えた短い日本語の見出し"),
        summary: z
          .string()
          .describe(
            "5〜8文程度の詳しい日本語の要約。何が起きたのか、背景、経緯、具体的な数字・固有名詞をできる限り含めて、記事を読まなくても内容がしっかり把握できるレベルまで詳しく書く（簡潔にしすぎない）",
          ),
        impact: z
          .string()
          .describe(
            "このニュースが今後、経済・金融市場・株式（マクロ全体および関連する業種・個別銘柄）・社会全体にどのような影響を及ぼしうるかについての日本語での予測を3〜5文程度で書く。強気/弱気どちらの方向に働きそうか、影響を受けやすい業種やテーマ、想定されるリスクや注目すべき今後の展開を具体的に含める。断定はせず「〜の可能性がある」「〜が予想される」といった予測のトーンで書く",
          ),
        importanceScore: z.number().min(1).max(10).describe("個人投資家にとっての重要度。10が最重要"),
        reason: z.string().describe("なぜこのニュースが重要かの一言理由（日本語）"),
      }),
    )
    .describe("重要度が高い順に並べた記事のリスト"),
});

export interface NewsPick {
  headline: string;
  summary: string;
  impact: string;
  importanceScore: number;
  reason: string;
  article: Article;
}

// 1回の呼び出しでGateway側が複数の無料モデルにフォールバックするため、外側のリトライ回数・待機時間は
// 短めにしても十分な冗長性が得られる（maxDuration=300秒に収まるよう調整）
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 15_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 1回分のAI呼び出し。無料枠モデルはたまに空振り（0件選定）することがあるため、呼び出し元でリトライする */
async function attemptPickImportantNews(articles: Article[], maxPicks: number): Promise<NewsPick[]> {
  const listing = articles
    .map((a, i) => `[${i}] (${a.source}) ${a.title}\n${a.snippet.slice(0, 200)}`)
    .join("\n\n");

  const watchlistNote =
    WATCHLIST.length > 0
      ? `\nユーザーは以下の銘柄・テーマに特に関心があります。関連するニュースがあれば優先度を上げてください:\n${WATCHLIST.join("、")}\n`
      : "";

  const prompt = `あなたは個人投資家向けのニュース編集者です。以下は直近に配信された経済・株式関連ニュースの一覧です。
このうち、日本株・米国株・グローバル市場に日々投資判断を行う個人投資家にとって重要度が高い記事を最大${maxPicks}件選び、重要度順に並べてください。
${watchlistNote}
選定基準:
- 金融政策・金利・為替・マクロ経済指標など市場全体に影響するニュース
- 個別企業の決算、業績予想の修正、M&A、規制、大きな経営判断
- 地政学リスクなど市場心理に影響するニュース
- 単なる株価の値動き速報や重複的な内容は優先度を下げる

記事一覧:
${listing}

上記の記事群には重要なニュースが含まれています。重要度が低いと判断した記事は選ばなくてよいが、必ず1件以上は選ぶこと。
同じ出来事・トピックを複数の記事が報じている場合は、重複して選ばず最も情報量の多い1件だけを選ぶこと。
各記事について、要約（summary）は詳しく具体的に、影響予測（impact）は今後の経済・株式市場・社会への影響を踏まえて、それぞれ指定された文量でしっかり書いてください。`;

  const { toolCalls } = await generateText({
    model: SUMMARIZE_MODEL,
    tools: {
      submit_picks: tool({
        description: "選定したニュース記事のリストを提出する",
        inputSchema: pickSchema,
      }),
    },
    toolChoice: { type: "tool", toolName: "submit_picks" },
    prompt,
    // 無料枠はレート制限が厳しく、SDK内蔵の即時リトライは逆効果になりやすいため無効化し、
    // 呼び出し元でウェイトを挟んでリトライする
    maxRetries: 0,
    providerOptions: {
      gateway: {
        // プライマリが503/429等で失敗した場合、同一リクエスト内で無料の代替モデルに自動フォールバック
        models: FALLBACK_MODELS,
      },
    },
  });

  const call = toolCalls.find((c) => c.toolName === "submit_picks");
  if (!call) {
    throw new Error("AIからニュース選定結果を取得できませんでした（ツール呼び出しなし）");
  }
  const object = call.input as z.infer<typeof pickSchema>;

  return object.picks
    .filter((p) => p.index >= 0 && p.index < articles.length)
    .sort((a, b) => b.importanceScore - a.importanceScore)
    .slice(0, maxPicks)
    .map((p) => ({
      headline: p.headline,
      summary: p.summary,
      impact: p.impact,
      importanceScore: p.importanceScore,
      reason: p.reason,
      article: articles[p.index],
    }));
}

/**
 * 収集した記事群をAIに渡し、個人投資家にとって重要なものを選定・要約させる。
 * 記事数が多い場合はトークン節約のためタイトル+スニペットのみ渡す。
 * 無料枠モデルはたまに空振り（エラーや0件選定）することがあるため、複数回リトライする。
 */
export async function pickImportantNews(articles: Article[], maxPicks: number): Promise<NewsPick[]> {
  if (articles.length === 0) return [];

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const picks = await attemptPickImportantNews(articles, maxPicks);
      if (picks.length > 0) return picks;
      console.warn(`[summarize] ${attempt}回目: 0件選定のためリトライ`);
    } catch (error) {
      lastError = error;
      console.warn(`[summarize] ${attempt}回目失敗:`, error instanceof Error ? error.message : String(error));
    }
    // 無料枠のレート制限クールダウンを待ってから次を試す（最終試行後は待たない）
    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
  }

  if (lastError) throw lastError;
  return [];
}
