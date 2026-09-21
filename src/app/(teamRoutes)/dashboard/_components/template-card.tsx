import { ArrowDownToLine, ExternalLink, Presentation } from "lucide-react";
import type { getSubmissionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { formatMoment } from "./format";
import { CardBody, CardTitle, DashCard } from "./panel";

type State = NonNullable<Awaited<ReturnType<typeof getSubmissionState>>>;

/**
 * The hero row, and the one card that changes *job* rather than volume. Until a
 * deck exists it is the template download; from the moment one does it becomes
 * the team's submission, with the template demoted to a quiet link rather than
 * the whole row dimming into something they can no longer use.
 *
 * The switch reads `submission.driveLink`, not `teamStatus`: `getSubmissionState`
 * scopes the submission to the *active* round, so a team accepted in round one
 * has none once round two opens — and then the download card is exactly what
 * they need again.
 */
export function TemplateCard({
  templateUrl,
  submission,
}: {
  templateUrl: string | null;
  submission: State["submission"];
}) {
  if (submission?.driveLink) {
    return (
      <DashCard className="md:p-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-md">
            <Presentation
              aria-hidden
              className="size-14 stroke-2 text-primary"
            />
            <div className="mt-5">
              <CardTitle>Your submission</CardTitle>
              {submission.title ? (
                <CardBody>{submission.title}</CardBody>
              ) : null}
              {submission.submittedAt ? (
                <p className="mt-2 text-muted-foreground text-sm tabular-nums">
                  Submitted {formatMoment(submission.submittedAt)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2 md:items-end">
            <Button asChild size="lg">
              {/* A plain anchor, not `next/link`: the deck lives on Drive. */}
              <a
                href={submission.driveLink}
                target="_blank"
                rel="noreferrer noopener"
              >
                Open deck
                <ExternalLink aria-hidden />
              </a>
            </Button>
            {/* Still reachable — a second round means a second deck. */}
            {templateUrl ? (
              <a
                href={templateUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-center text-muted-foreground text-sm underline-offset-4 hover:underline md:text-right"
              >
                Download template
              </a>
            ) : null}
          </div>
        </div>
      </DashCard>
    );
  }

  return (
    <DashCard className="md:p-12">
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-md">
          <ArrowDownToLine
            aria-hidden
            className="size-14 stroke-2 text-primary"
          />
          <div className="mt-5">
            <CardTitle>Download template</CardTitle>
            <CardBody>
              {templateUrl
                ? "Every team is advised to use the presentation template."
                : "The template hasn't been posted yet. Check back soon!"}
            </CardBody>
          </div>
        </div>

        <Button
          asChild={Boolean(templateUrl)}
          size={"lg"}
          disabled={!templateUrl}
          className="shrink-0"
        >
          {templateUrl ? (
            <a href={templateUrl} target="_blank" rel="noreferrer noopener">
              <ArrowDownToLine aria-hidden />
              Download template
            </a>
          ) : (
            <>
              <ArrowDownToLine aria-hidden />
              Not posted yet
            </>
          )}
        </Button>
      </div>
    </DashCard>
  );
}
