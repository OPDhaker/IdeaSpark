import { ExternalLink, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WHATSAPP_INVITE_URL } from "@/lib/event";
import { CardBody, CardTitle, DashCard } from "./panel";

/**
 * Constant across every lifecycle state, and deliberately propless — there is
 * no state in which the group stops mattering, so there is no branch that could
 * hide it. Shares `TemplateCard`'s wide shape so the two full-width rows read
 * as one design.
 */
export function WhatsappCard() {
  return (
    <DashCard className="md:p-12">
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-md">
          <MessagesSquare
            aria-hidden
            className="size-14 stroke-2 text-primary"
          />
          <div className="mt-5">
            <CardTitle>Join the WhatsApp group</CardTitle>
            <CardBody>
              Announcements, schedule changes and round reminders go out here first.
            </CardBody>
          </div>
        </div>

        <Button asChild size="lg" className="shrink-0">
          {/* A plain anchor, not `next/link`: this leaves the app. */}
          <a
            href={WHATSAPP_INVITE_URL}
            target="_blank"
            rel="noreferrer noopener"
          >
            Join the group
            <ExternalLink aria-hidden />
          </a>
        </Button>
      </div>
    </DashCard>
  );
}
