import { PartyPopper, Ticket } from "lucide-react";
import Link from "next/link";
import type { getSubmissionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { formatMoment } from "./format";
import { CardBody, CardTitle, DashCard } from "./panel";
import { SubmitForm } from "./submit-form";

type State = NonNullable<Awaited<ReturnType<typeof getSubmissionState>>>;

function formatFee(fee: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(fee));
}

/**
 * The only card on the dashboard that swaps. Everything around it is constant,
 * so this is where the lifecycle is legible:
 *
 *   pending_submission -> in_review -> accepted -> paid
 *                                   \- rejected (terminal)
 */
export function ActionCard({ state }: { state: State }) {
  // Paid is checked first: a paid team is also `accepted`, and the pass is the
  // more useful thing to show them.
  if (state.paymentStatus === "paid") {
    return (
      <DashCard>
        <Ticket aria-hidden className="size-14 stroke-2 text-primary" />
        <div className="mt-4">
          <CardTitle>Your passes are ready</CardTitle>
          <CardBody>
            One pass per member, each with its own attendance QR. Print the
            strip or screenshot it and hand them out.
          </CardBody>
        </div>
        <Button asChild className="mt-6 w-full">
          <Link href="/dashboard/receipt">View passes</Link>
        </Button>
      </DashCard>
    );
  }

  if (state.teamStatus === "rejected") {
    // Deliberately not `destructive`. A rejected idea is a disappointment, not
    // an error the team caused.
    return (
      <DashCard className="bg-secondary/50">
        <CardTitle>Not this time</CardTitle>
        <CardBody>
          Your idea wasn&apos;t picked for this round. It happens to strong
          teams too; come find us at the event.
        </CardBody>
        {state.submission?.remarks ? (
          <blockquote className="mt-5 border-foreground/20 border-l-2 pl-4 text-sm leading-relaxed">
            {state.submission.remarks}
          </blockquote>
        ) : null}
      </DashCard>
    );
  }

  if (state.teamStatus === "accepted") {
    return (
      <DashCard>
        <PartyPopper aria-hidden className="size-14 stroke-2 text-primary" />
        <div className="mt-4">
          <CardTitle>You&apos;re in</CardTitle>
          <CardBody>
            Your idea was accepted. Pay the registration fee to lock your roster
            and get your attendance passes.
          </CardBody>
        </div>

        {state.registrationFee ? (
          <p className="mt-5 text-6xl font-semibold tracking-tight">
            {formatFee(state.registrationFee)}
          </p>
        ) : null}

        {/* Razorpay order creation does not exist yet — nothing calls the
            orders API and the SDK is not a dependency, so there is no order to
            open a checkout against. The button stays visibly disabled rather
            than failing on click. */}
        <Button type="button" className="mt-6 w-full" disabled>
          Pay registration fee
        </Button>
        <p className="mt-2 text-center text-muted-foreground text-xs">
          Payments open shortly; we&apos;ll WhatsApp you the moment they do.
        </p>
      </DashCard>
    );
  }

  if (state.teamStatus === "in_review") {
    return (
      <DashCard>
        <CardTitle>Under review</CardTitle>
        <CardBody>
          Your deck is with the reviewers. You&apos;ll see the verdict here.
        </CardBody>

        <dl className="flex flex-col gap-2">
          {state.submission?.title ? (
            <div>
              <dt className="text-muted-foreground text-sm">Idea</dt>
              <dd className="font-medium text-base">
                {state.submission.title}
              </dd>
            </div>
          ) : null}
          {state.submission?.submittedAt ? (
            <div>
              <dt className="text-muted-foreground text-sm">Submitted</dt>
              <dd className="tabular-nums font-medium text-base">
                {formatMoment(state.submission.submittedAt)}
              </dd>
            </div>
          ) : null}
        </dl>

        {/* The deck link lives on the submission card above — one home for it. */}
      </DashCard>
    );
  }

  // pending_submission — but there is nothing to submit into.
  if (!state.activeRound) {
    return (
      <DashCard>
        <CardTitle>No round open</CardTitle>
        <CardBody>
          The organisers haven&apos;t opened a submission round yet. This is
          where you&apos;ll upload your deck when they do.
        </CardBody>
      </DashCard>
    );
  }

  return (
    <DashCard>
      <SubmitForm roundId={state.activeRound.id} />
    </DashCard>
  );
}
