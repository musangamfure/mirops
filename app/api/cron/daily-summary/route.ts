import { NextResponse } from "next/server";
import { buildDailySummary, kigaliTodayStr } from "@/lib/dailySummary";
import { sendEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/cron/daily-summary — triggered by Vercel Cron at 21:00 Kigali
// time (19:00 UTC, see vercel.json). Builds the digest for "today" (Kigali
// calendar day) and emails it to DAILY_SUMMARY_TO.
//
// Protected via CRON_SECRET: Vercel automatically sends
// `Authorization: Bearer <CRON_SECRET>` on scheduled invocations once that
// env var is set, so this rejects any other caller. A `?date=YYYY-MM-DD`
// query param is also accepted (Vercel Cron ignores it) for manually
// re-sending a specific day's summary while testing.
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const secret = process.env.CRON_SECRET;
    if (secret && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const to = process.env.DAILY_SUMMARY_TO;
    if (!to) {
      return NextResponse.json(
        { success: false, error: "DAILY_SUMMARY_TO is not configured." },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || kigaliTodayStr();

    const summary = await buildDailySummary(date);
    const recipients = to.split(",").map((s) => s.trim()).filter(Boolean);

    await sendEmail({
      to: recipients,
      subject: summary.subject,
      html: summary.html,
      text: summary.text,
    });

    return NextResponse.json({
      success: true,
      data: { date, sentTo: recipients, hasActivity: summary.hasActivity },
    });
  } catch (err) {
    console.error("GET /api/cron/daily-summary error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
