import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardBody, CardTitle, DashCard } from "./panel";

/**
 * The hero card, constant across every state — but it stops being the loudest
 * thing on screen once the team is past review, so it dims to reference
 * material rather than disappearing.
 */
export function TemplateCard({
  templateUrl,
  demoted,
}: {
  templateUrl: string | null;
  demoted: boolean;
}) {
  return (
    <DashCard muted={demoted} className="md:p-12">
      <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div className="max-w-md">
          <ArrowDown aria-hidden className="size-14 stroke-1 text-primary" />
          <div className="mt-5">
            <CardTitle>Download template</CardTitle>
            <CardBody>
              {templateUrl
                ? "Build your pitch on the official deck. Reviewers read every submission against it."
                : "The organisers haven't posted the deck template yet. Check back — it'll appear here."}
            </CardBody>
          </div>
        </div>

        <Button
          asChild={Boolean(templateUrl)}
          size="lg"
          variant={demoted ? "outline" : "default"}
          disabled={!templateUrl}
          className="shrink-0"
        >
          {templateUrl ? (
            <a href={templateUrl} target="_blank" rel="noreferrer noopener">
              <ArrowDown aria-hidden />
              Download template
            </a>
          ) : (
            <>
              <ArrowDown aria-hidden />
              Not posted yet
            </>
          )}
        </Button>
      </div>
    </DashCard>
  );
}
