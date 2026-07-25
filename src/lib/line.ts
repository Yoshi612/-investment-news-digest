import { messagingApi } from "@line/bot-sdk";
import type { NewsPick } from "./summarize";
import type { Region } from "./sources";

const LINE_TEXT_MESSAGE_LIMIT = 5000;
/** LINE の pushMessage は1回の呼び出しで最大5件までしかメッセージを送れない */
const MAX_MESSAGES_PER_PUSH = 5;

function getClient(): messagingApi.MessagingApiClient {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) {
    throw new Error("環境変数 LINE_CHANNEL_ACCESS_TOKEN が設定されていません");
  }
  return new messagingApi.MessagingApiClient({ channelAccessToken });
}

const SLOT_LABELS: Record<number, string> = {
  6: "朝刊",
};

const REGION_LABELS: Record<Region, string> = {
  jp: "日本株",
  us: "米国株",
  global: "グローバル",
};
const REGION_ORDER: Region[] = ["jp", "us", "global"];

export function formatDigestMessage(picks: NewsPick[], slotHourJst: number): string {
  const label = SLOT_LABELS[slotHourJst] ?? "ニュース";
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(now);

  if (picks.length === 0) {
    return `【投資ニュース ${label}】${dateStr}\n\n今回の時間帯で重要度の高いニュースは見つかりませんでした。`;
  }

  // 地域（日本株/米国株/グローバル）ごとにグループ化し、各グループ内では重要度順を維持する
  const orderedPicks = REGION_ORDER.flatMap((region) => picks.filter((p) => p.article.region === region));

  const blocks: string[] = [];
  let lastRegion: Region | null = null;
  orderedPicks.forEach((p, i) => {
    if (p.article.region !== lastRegion) {
      blocks.push(`■ ${REGION_LABELS[p.article.region]}`);
      lastRegion = p.article.region;
    }
    const stars = "★".repeat(Math.max(1, Math.min(5, Math.round(p.importanceScore / 2))));
    blocks.push(
      `${i + 1}. ${p.headline} ${stars}\n${p.summary}\n\n▼想定される影響\n${p.impact}\n\n（${p.reason} / ${p.article.source}）\n${p.article.link}`,
    );
  });

  return `【投資ニュース ${label}】${dateStr}\n\n${blocks.join("\n\n---\n\n")}`;
}

/**
 * 1件分のメッセージを LINE の文字数上限（5000文字）に収まる単位に分割する。
 * ニュースの区切り（---）を優先して分割し、それでも収まらない場合は強制的に切る。
 */
function splitForLine(text: string): string[] {
  if (text.length <= LINE_TEXT_MESSAGE_LIMIT) return [text];

  const blocks = text.split("\n\n---\n\n");
  const chunks: string[] = [];
  let current = "";

  for (const block of blocks) {
    const candidate = current ? `${current}\n\n---\n\n${block}` : block;
    if (candidate.length > LINE_TEXT_MESSAGE_LIMIT) {
      if (current) chunks.push(current);
      current = block.length > LINE_TEXT_MESSAGE_LIMIT ? block.slice(0, LINE_TEXT_MESSAGE_LIMIT - 1) + "…" : block;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  return chunks.map((chunk, i) => (chunks.length > 1 ? `${chunk}\n\n（${i + 1}/${chunks.length}）` : chunk));
}

/** 環境変数 LINE_USER_IDS（カンマ・改行区切り）から配信先ユーザーID一覧を取得する */
function getRecipientIds(): string[] {
  const raw = process.env.LINE_USER_IDS ?? process.env.LINE_USER_ID ?? "";
  return raw
    .split(/[,\n]/)
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

export async function sendLineText(text: string): Promise<void> {
  const recipients = getRecipientIds();
  if (recipients.length === 0) {
    throw new Error("環境変数 LINE_USER_IDS（またはLINE_USER_ID）が設定されていません");
  }

  const client = getClient();
  const chunks = splitForLine(text);

  for (let i = 0; i < chunks.length; i += MAX_MESSAGES_PER_PUSH) {
    const group = chunks.slice(i, i + MAX_MESSAGES_PER_PUSH);
    // multicast: 1回の呼び出しで複数の相手に同じメッセージ群を送れる（最大500人）
    await client.multicast({
      to: recipients,
      messages: group.map((t) => ({ type: "text", text: t })),
    });
  }
}

/**
 * 配信処理が失敗した際に、ベストエフォートでLINEに障害通知を送る。
 * 通知自体の送信が失敗しても（LINE認証情報が壊れている場合など）例外を投げず、
 * コンソールにログを残すだけに留める。
 */
export async function notifyDigestFailure(context: string, error: unknown): Promise<void> {
  const detail = error instanceof Error ? error.message : String(error);
  try {
    await sendLineText(`⚠️ 投資ニュース配信でエラーが発生しました\n\n[${context}]\n${detail}`);
  } catch (notifyError) {
    console.error("[line] 失敗通知の送信にも失敗しました", notifyError);
  }
}
