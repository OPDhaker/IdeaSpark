"use client";

import { Pencil } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  MEMBER_FIELDS,
  type MemberDraft,
  memberSchema,
  type RegistrationValues,
} from "@/lib/validation/registration";
import type { Department } from "./member-fields";
import type { Track } from "./step-team";

const FIELD_LABELS: Record<(typeof MEMBER_FIELDS)[number], string> = {
  name: "Full name",
  raNumber: "RA number",
  netId: "Net ID",
  phoneNumber: "Phone",
  departmentCode: "Department",
  facultyName: "Faculty name",
  facultyPhone: "Faculty phone",
  facultyEmail: "Faculty email",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-1.5">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-right font-medium text-foreground text-sm break-all">
        {value || <span className="text-muted-foreground">|</span>}
      </dd>
    </div>
  );
}

function Section({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-foreground/15 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          <Pencil aria-hidden />
          Edit
        </Button>
      </div>
      <dl className="divide-y divide-foreground/10">{children}</dl>
    </section>
  );
}

/**
 * Final read-back before submit.
 *
 * Values come from form state, not from the saved draft: the draft is written
 * on a 400ms debounce, so reading it here could show the team something one
 * keystroke behind what is about to be sent. Form state is the same data, and
 * it is the data that actually gets submitted.
 *
 * Each person is re-parsed through `memberSchema` so the team reviews the
 * normalised values that will land in the database (`RA…` uppercased, netID
 * and email lowercased), falling back to the raw input if parsing fails.
 */
export function StepReview({
  tracks,
  departments,
  onEdit,
}: {
  tracks: Track[];
  departments: Department[];
  onEdit: (step: number) => void;
}) {
  const form = useFormContext<RegistrationValues>();
  const values = form.watch();

  const departmentLabels = new Map(departments.map((d) => [d.code, d.label]));
  const trackNames = new Map(tracks.map((t) => [t.id, t.name]));

  const display = (person: MemberDraft) => {
    const parsed = memberSchema.safeParse(person);
    return parsed.success ? parsed.data : person;
  };

  const personRows = (person: MemberDraft) => {
    const shown = display(person);
    return MEMBER_FIELDS.map((field) => (
      <Row
        key={field}
        label={FIELD_LABELS[field]}
        value={
          field === "departmentCode"
            ? (departmentLabels.get(shown[field]) ?? shown[field])
            : field === "phoneNumber" || field === "facultyPhone"
              ? shown[field] && `+91 ${shown[field]}`
              : shown[field]
        }
      />
    ));
  };

  const activeMembers = values.members.slice(0, values.team.memberCount - 1);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Check everything below before submitting. Once your team is created the
        roster is locked after payment.
      </p>

      <Section title="Team" onEdit={() => onEdit(2)}>
        <Row label="Team name" value={values.team.teamName} />
        <Row
          label="Track"
          value={trackNames.get(values.team.trackId) ?? values.team.trackId}
        />
        <Row
          label="Team size"
          value={`${values.team.memberCount} ${values.team.memberCount === 1 ? "member" : "members"} (including you)`}
        />
      </Section>

      <Section title="Team leader" onEdit={() => onEdit(1)}>
        {personRows(values.leader)}
      </Section>

      {activeMembers.map((member, index) => (
        <Section
          // Slots are fixed and never reordered, so the index is stable.
          key={`member-${index + 2}`}
          title={`Member ${index + 2}`}
          onEdit={() => onEdit(index + 3)}
        >
          {personRows(member)}
        </Section>
      ))}
    </div>
  );
}
