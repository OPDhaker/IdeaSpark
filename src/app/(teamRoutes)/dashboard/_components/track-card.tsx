import type { getSubmissionState } from "@/app/actions";
import { DeadlineCountdown } from "./deadline";
import { CardTitle, DashCard, Detail } from "./panel";

type State = NonNullable<Awaited<ReturnType<typeof getSubmissionState>>>;

/** Constant across every state: who you are and what you're working against. */
export function TrackCard({ state }: { state: State }) {
  return (
    <DashCard className="flex flex-col gap-6 justify-between">
      <CardTitle>Track details</CardTitle>

      <dl className="mt-6 flex flex-col gap-5">
        <Detail label="Team" value={state.teamName} />
        <Detail label="Track" value={state.trackName ?? "Not set"} />
        <Detail
          label="Members"
          value={`${state.memberCount} ${state.memberCount === 1 ? "member" : "members"}`}
        />
        <Detail
          label="Submission deadline"
          value={
            state.submissionDeadline ? (
              <DeadlineCountdown
                deadline={state.submissionDeadline.toISOString()}
              />
            ) : (
              "Not announced"
            )
          }
        />
      </dl>
    </DashCard>
  );
}
