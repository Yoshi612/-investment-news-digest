import { NextRequest, NextResponse } from "next/server";
import { runDigest } from "@/lib/runDigest";
import { notifyDigestFailure } from "@/lib/line";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Vercel Cron から呼ばれるエンドポイント。
 * CRON_SECRET を環境変数に設定すると、Vercel が
 * "Authorization: Bearer <CRON_SECRET>" を自動付与してリクエストしてくる。
 * それ以外からの呼び出しは拒否する。
 */
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // 未設定時は開発用に許可（本番では必ず設定すること）
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDigest({ dryRun: false });
    return NextResponse.json({
      ok: true,
      slotHourJst: result.slotHourJst,
      since: result.sinceIso,
      articleCount: result.articleCount,
      pickCount: result.picks.length,
      sent: result.sent,
    });
  } catch (error) {
    console.error("[cron/news] digest failed", error);
    await notifyDigestFailure("cron/news", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
