import { NextResponse } from "next/server";
import { buildMonthlySummary, kigaliReportMonthStr } from "@/lib/monthlySummary";
import { sendEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/cron/monthly-summary — triggered by Vercel Cron at 21:00 Kigali
// time on the 1st of every month (19:00 UTC, see vercel.json). Builds the
// report for the month that just ended (e.g. on Aug 1 it reports on July)
// and emails it to MONTHLY_REPORT_TO (falls back to DAILY_SUMMARY_TO).
//
// Protected via CRON_SECRET, same as daily-summary. A `?month=YYYY-MM`
// query param is also accepted (Vercel Cron ignores it) for manually
// (re-)sending a specific month's report — e.g. to catch up on a month
// whose report wasn't set up in time.
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const secret = process.env.CRON_SECRET;
    if (secret && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const to = process.env.MONTHLY_REPORT_TO || process.env.DAILY_SUMMARY_TO;
    if (!to) {
      return NextResponse.json(
        { success: false, error: "MONTHLY_REPORT_TO (or DAILY_SUMMARY_TO) is not configured." },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || kigaliReportMonthStr();

    const summary = await buildMonthlySummary(month);
    const recipients = to.split(",").map((s) => s.trim()).filter(Boolean);

    await sendEmail({
      to: recipients,
      subject: summary.subject,
      html: summary.html,
      text: summary.text,
    });

    return NextResponse.json({
      success: true,
      data: { month, sentTo: recipients, hasActivity: summary.hasActivity },
    });
  } catch (err) {
    console.error("GET /api/cron/monthly-summary error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
