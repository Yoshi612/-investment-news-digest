import Parser from "rss-parser";
import { FEED_SOURCES, type Region } from "./sources";

export interface Article {
  title: string;
  link: string;
  source: string;
  region: Region;
  publishedAt: Date | null;
  snippet: string;
}

const parser = new Parser({
  timeout: 10_000,
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; PersonalNewsDigest/1.0)",
  },
});

function stripHtml(html: string | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** タイトル比較用に記号・空白を除去して正規化する */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[「」『』【】[\]()（）"'"''.,、。!！?？:：;；\-\s]/g, "");
}

/** 文字列を2文字ずつのバイグラム集合にする（分かち書きされない日本語でも使えるように） */
function toBigrams(text: string): Set<string> {
  const bigrams = new Set<string>();
  for (let i = 0; i < text.length - 1; i++) {
    bigrams.add(text.slice(i, i + 2));
  }
  return bigrams;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * 異なるソースが同じ出来事を報じた記事同士を「ほぼ重複」として検出する。
 * 語順や言い回しが違っても検出できるよう、正規化後の文字バイグラムの
 * Jaccard類似度で判定する（日本語・英語どちらのタイトルにも同じロジックで対応できる）。
 */
function isNearDuplicate(titleA: string, titleB: string): boolean {
  const normA = normalizeTitle(titleA);
  const normB = normalizeTitle(titleB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;

  const shorter = normA.length <= normB.length ? normA : normB;
  const longer = normA.length <= normB.length ? normB : normA;
  if (shorter.length >= 10 && longer.includes(shorter)) return true;

  if (normA.length < 6 || normB.length < 6) return false;
  return jaccardSimilarity(toBigrams(normA), toBigrams(normB)) > 0.5;
}

/**
 * ほぼ重複する記事同士をまとめ、スニペットがより充実している方を残す。
 * O(n^2) だが記事数は多くても数百件程度のため実用上問題ない。
 */
function dedupeNearDuplicates(articles: Article[]): Article[] {
  const result: Article[] = [];
  for (const article of articles) {
    const dupIndex = result.findIndex((existing) => isNearDuplicate(existing.title, article.title));
    if (dupIndex === -1) {
      result.push(article);
    } else if (article.snippet.length > result[dupIndex].snippet.length) {
      result[dupIndex] = article;
    }
  }
  return result;
}

/**
 * 全RSSフィードを並行取得する。個別のフィードが失敗しても
 * 全体は失敗させず、取得できたものだけ返す。
 */
export async function fetchAllArticles(since: Date): Promise<Article[]> {
  const results = await Promise.allSettled(
    FEED_SOURCES.map(async (source) => {
      const feed = await parser.parseURL(source.url);
      const items: Article[] = (feed.items ?? []).map((item) => {
        const publishedAt = item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : null;
        return {
          title: item.title?.trim() ?? "(無題)",
          link: item.link ?? "",
          source: source.name,
          region: source.region,
          publishedAt,
          snippet: stripHtml(item.contentSnippet ?? item.content ?? item.summary),
        };
      });
      return items;
    }),
  );

  const articles: Article[] = [];
  const failedSources: string[] = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      articles.push(...result.value);
    } else {
      failedSources.push(FEED_SOURCES[i].name);
    }
  });

  if (failedSources.length > 0) {
    console.warn(`[fetchAllArticles] 取得失敗フィード: ${failedSources.join(", ")}`);
  }

  const seen = new Set<string>();
  const deduped = articles.filter((article) => {
    const key = article.link || article.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const withinWindow = deduped.filter((article) => {
    // 公開日時が取れない記事は念のため残す（フィード側の実装差異があるため）
    if (!article.publishedAt || Number.isNaN(article.publishedAt.getTime())) return true;
    return article.publishedAt >= since;
  });

  return dedupeNearDuplicates(withinWindow);
}
