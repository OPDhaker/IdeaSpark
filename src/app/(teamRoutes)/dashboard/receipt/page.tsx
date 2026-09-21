import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getReceipt } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { PrintButton } from "./print-button";
import "./receipt.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Passes | IdeaSpark 3.0",
};

function money(amount: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

function moment(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="opacity-60">{label}</span>
      <span className="truncate tabular-nums">{value}</span>
    </div>
  );
}

export default async function ReceiptPage() {
  const receipt = await getReceipt();
  // Also the payment gate: getReceipt() returns null unless the team has paid,
  // so the guard and the data cannot disagree.
  if (!receipt) redirect("/dashboard");

  // The QR payload is the raw attendance_code, because that is exactly what
  // scanAttendance() looks up. Wrapping it in a URL would break the scanner.
  const passes = await Promise.all(
    receipt.members.map(async (member) => ({
      ...member,
      qr: member.attendanceCode
        ? await QRCode.toString(member.attendanceCode, {
            type: "svg",
            margin: 0,
            errorCorrectionLevel: "M",
          })
        : null,
    })),
  );

  return (
    <div className="receipt-page p-6 md:p-12">
      <div className="mx-auto flex w-full max-w-[820px] flex-col items-center gap-8">
        <div className="flex w-full items-center justify-between print:hidden">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">
              <ArrowLeft aria-hidden />
              Back
            </Link>
          </Button>
          <PrintButton />
        </div>

        <article className="receipt w-[340px] bg-card px-7 py-9 font-mono text-[0.8125rem] text-card-foreground leading-relaxed">
          <header className="text-center">
            <h1 className="font-semibold text-sm uppercase tracking-[0.2em]">
              IdeaSpark 3.0
            </h1>
            <p className="mt-1 text-[0.6875rem] uppercase tracking-[0.2em] opacity-60">
              Founders Club SRM
            </p>
          </header>

          <div className="receipt-rule my-6" />

          <div className="flex flex-col gap-1.5">
            <Line label="TEAM" value={receipt.team.teamName} />
            <Line label="TRACK" value={receipt.trackName ?? "|"} />
            {receipt.dayOne ? (
              <Line
                label="DAYS"
                value={`${receipt.dayOne} / ${receipt.dayTwo ?? "|"}`}
              />
            ) : null}
          </div>

          <div className="receipt-rule my-6" />

          {receipt.payment ? (
            <div className="flex flex-col gap-1.5">
              <Line label="ORDER" value={receipt.payment.razorpayOrderId} />
              <Line
                label="PAYMENT"
                value={receipt.payment.razorpayPaymentId ?? "|"}
              />
              <Line
                label="PAID"
                value={
                  receipt.payment.paidAt ? moment(receipt.payment.paidAt) : "|"
                }
              />
              <div className="mt-2 flex items-baseline justify-between gap-4 font-semibold">
                <span>AMOUNT</span>
                <span className="tabular-nums">
                  {money(receipt.payment.amount)}
                </span>
              </div>
            </div>
          ) : (
            <p className="opacity-60">Payment record unavailable.</p>
          )}

          <div className="receipt-rule my-6" />

          <h2 className="text-center text-[0.6875rem] uppercase tracking-[0.2em] opacity-60">
            {passes.length} passes
          </h2>

          <div className="mt-5 flex flex-col gap-6">
            {passes.map((pass) => (
              <div key={pass.id} className="receipt-pass flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-semibold">{pass.name}</span>
                  {pass.isLeader ? (
                    <span className="text-[0.625rem] uppercase tracking-[0.15em] opacity-60">
                      Leader
                    </span>
                  ) : null}
                </div>
                <div className="tabular-nums opacity-60">{pass.raNumber}</div>

                {pass.qr ? (
                  <>
                    <div
                      aria-hidden
                      className="mx-auto w-[128px] [&_svg]:h-auto [&_svg]:w-full"
                      // Server-rendered SVG from `qrcode`; the payload is the
                      // member's own attendance code, nothing user-authored.
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: generated SVG, no user input
                      dangerouslySetInnerHTML={{ __html: pass.qr }}
                    />
                    <div className="text-center text-[0.6875rem] tabular-nums opacity-60">
                      …{pass.attendanceCode?.slice(-8)}
                    </div>
                  </>
                ) : (
                  <p className="text-center opacity-60">
                    Pass not issued yet | refresh in a moment.
                  </p>
                )}

                <div className="receipt-rule" />
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-[0.6875rem] leading-relaxed opacity-60">
            Each pass is scanned once per day at the door. Don&apos;t share the
            codes.
          </p>
        </article>
      </div>
    </div>
  );
}
