import { fetchAllArticles } from "./fetchNews";
import { pickImportantNews, type NewsPick } from "./summarize";
import { formatDigestMessage, sendLineText } from "./line";
import { getLookbackWindowStart, getCurrentSlotHour } from "./schedule";

const MAX_PICKS = 5;

export interface DigestResult {
  slotHourJst: number;
  sinceIso: string;
  articleCount: number;
  picks: NewsPick[];
  message: string;
  sent: boolean;
}

export async function runDigest(options: { dryRun?: boolean } = {}): Promise<DigestResult> {
  const now = new Date();
  const since = getLookbackWindowStart(now);
  const slotHourJst = getCurrentSlotHour();

  const articles = await fetchAllArticles(since);
  const picks = await pickImportantNews(articles, MAX_PICKS);
  const message = formatDigestMessage(picks, slotHourJst);

  let sent = false;
  if (!options.dryRun) {
    await sendLineText(message);
    sent = true;
  }

  return {
    slotHourJst,
    sinceIso: since.toISOString(),
    articleCount: articles.length,
    picks,
    message,
    sent,
  };
}
