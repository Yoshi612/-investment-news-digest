import type { VercelConfig } from "@vercel/config/v1";

// 配信スケジュール: 毎日 6:00 (JST) の1回のみ
// Vercel Hobbyプランはcron jobが1日1回までのため、複数回配信は行わない
// Vercel Cron は UTC 指定のため JST-9時間に変換している
export const config: VercelConfig = {
  crons: [
    { path: "/api/cron/news", schedule: "0 21 * * *" }, // 6:00 JST
  ],
};
