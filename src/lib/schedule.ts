/**
 * 配信スケジュール: 毎日1回、日本時間6時。
 * Vercel Hobbyプランはcronが1日1回までのため、複数回配信は行わない。
 */
export const DAILY_SLOT_HOUR_JST = 6;

/**
 * 配信対象ウィンドウの開始時刻（=24時間前）を返す。
 * cron のズレを許容するため 10 分のバッファを引く。
 */
export function getLookbackWindowStart(now: Date = new Date()): Date {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const bufferMs = 10 * 60 * 1000;
  return new Date(now.getTime() - oneDayMs - bufferMs);
}

/** メッセージの見出し表示用に、固定の配信時刻(6時JST)を返す */
export function getCurrentSlotHour(): number {
  return DAILY_SLOT_HOUR_JST;
}
