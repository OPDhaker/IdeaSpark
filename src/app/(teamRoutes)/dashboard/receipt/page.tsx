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

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="opacity-60">{label}</span>
      <span className="truncate tabular-nums">{value}</span>
    </div>
  );
}

// `date` columns arrive as "YYYY-MM-DD", which `new Date()` reads as UTC
// midnight, so format in UTC too or the day can slip by one.
function day(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default async function ReceiptPage() {
  const receipt = await getReceipt();
  // Also the payment gate: getReceipt() returns null unless the team has paid,
  // so the guard and the data cannot disagree.
  if (!receipt) redirect("/dashboard");

  // The QR payload is the raw team attendance_code, because that is exactly
  // what lookupTeamAttendance() looks up. Wrapping it in a URL would break the
  // scanner.
  const code = receipt.team.attendanceCode;
  const qr = code
    ? await QRCode.toString(code, {
        type: "svg",
        margin: 0,
        errorCorrectionLevel: "M",
      })
    : null;

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
            {receipt.dayOne && receipt.dayTwo ? (
              <Line
                label="DAYS"
                value={`${day(receipt.dayOne)} / ${day(receipt.dayTwo)}`}
              />
            ) : null}
          </div>

          <div className="receipt-rule my-6" />

          {receipt.team.paymentId ? (
            <div className="flex flex-col gap-1.5">
              <Line label="PAYMENT ID" value={receipt.team.paymentId} />
            </div>
          ) : (
            <p className="opacity-60">Payment ID unavailable.</p>
          )}

          <div className="receipt-rule my-6" />

          <h2 className="text-center text-[0.6875rem] uppercase tracking-[0.2em] opacity-60">
            Team pass
          </h2>

          <div className="receipt-pass mt-5 flex flex-col gap-3">
            {qr ? (
              <>
                <div
                  aria-hidden
                  className="mx-auto w-[176px] [&_svg]:h-auto [&_svg]:w-full"
                  // Server-rendered SVG from `qrcode`; the payload is the
                  // team's own attendance code, nothing user-authored.
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: generated SVG, no user input
                  dangerouslySetInnerHTML={{ __html: qr }}
                />
                <div className="text-center text-[0.6875rem] tabular-nums opacity-60">
                  …{code?.slice(-8)}
                </div>
              </>
            ) : (
              <p className="text-center opacity-60">
                Pass not issued yet | refresh in a moment.
              </p>
            )}
          </div>

          <div className="receipt-rule my-6" />

          <h2 className="text-center text-[0.6875rem] uppercase tracking-[0.2em] opacity-60">
            {receipt.members.length}{" "}
            {receipt.members.length === 1 ? "member" : "members"}
          </h2>

          <ul className="mt-5 flex flex-col gap-3">
            {receipt.members.map((member) => (
              <li key={member.id} className="flex flex-col gap-0.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-semibold">{member.name}</span>
                  {member.isLeader ? (
                    <span className="text-[0.625rem] uppercase tracking-[0.15em] opacity-60">
                      Leader
                    </span>
                  ) : null}
                </div>
                <span className="tabular-nums opacity-60">
                  {member.raNumber}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-6 text-center text-[0.6875rem] leading-relaxed opacity-60">
            Show this pass at the door once per day. A volunteer marks each
            member present. Don&apos;t share the code.
          </p>
        </article>
      </div>
    </div>
  );
}
