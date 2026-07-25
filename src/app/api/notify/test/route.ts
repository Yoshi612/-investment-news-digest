import { NextRequest, NextResponse } from "next/server";
import { runDigest } from "@/lib/runDigest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const secret = process.env.CRON_SECRET;

  if (secret && body.secret !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDigest({ dryRun: Boolean(body.dryRun) });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[notify/test] digest failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
