import { NextRequest, NextResponse } from "next/server";
import { messagingApi, validateSignature, type webhook } from "@line/bot-sdk";

export const dynamic = "force-dynamic";

/**
 * 配信対象にしたい人が自分のLINEユーザーIDを確認するための簡易Webhook。
 * Botに何かメッセージを送ると、そのユーザーIDを返信する（誰が送っても同じ動作）。
 * 返信されたIDを LINE_USER_IDS にカンマ区切りで追加すれば配信対象に加わる。
 * 全員分のIDを確認できたら、このWebhook URLの設定は外してしまって構わない。
 */
export async function POST(request: NextRequest) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!channelSecret || !channelAccessToken) {
    return NextResponse.json(
      { error: "LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN が未設定です" },
      { status: 500 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature") ?? "";

  if (!validateSignature(rawBody, channelSecret, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body: webhook.CallbackRequest = JSON.parse(rawBody);
  const client = new messagingApi.MessagingApiClient({ channelAccessToken });

  await Promise.all(
    (body.events ?? []).map(async (event) => {
      if (event.type !== "message" || event.source?.type !== "user" || !event.replyToken) return;
      const userId = event.source.userId ?? "(取得できませんでした)";
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: `あなたのLINEユーザーIDはこちらです:\n${userId}\n\nこの値を管理者に伝えるか、LINE_USER_IDS にカンマ区切りで追加してください。` }],
      });
    }),
  );

  return NextResponse.json({ ok: true });
}
