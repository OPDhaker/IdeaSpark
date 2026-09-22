/**
 * Step shapes for the `/register` wizard, composed from `./primitives`.
 *
 * Change this file when the *steps* change; change `./primitives` when a
 * *format rule* changes.
 *
 * Step map — `memberCount` includes the leader, so a team of N fills N+1 steps:
 *   1  leader              -> `leader`
 *   2  team                -> `team`
 *   3  member 1            -> `members.0`   (memberCount >= 2)
 *   4  member 2            -> `members.1`   (memberCount === 3)
 */
import { z } from "zod";
import { MAX_MEMBERS, MIN_MEMBERS } from "@/lib/team-size";
import {
  departmentCodeSchema,
  facultyEmailSchema,
  facultyNameSchema,
  facultyPhoneSchema,
  nameSchema,
  netIdSchema,
  phoneSchema,
  raNumberSchema,
  teamNameSchema,
  trackIdSchema,
} from "./primitives";

/** The eight NOT NULL columns of `members`, in display order. */
export const MEMBER_FIELDS = [
  "name",
  "raNumber",
  "netId",
  "phoneNumber",
  "departmentCode",
  "facultyName",
  "facultyPhone",
  "facultyEmail",
] as const;

/** Fully validated + normalised person. Leader and members share this shape. */
export const memberSchema = z.object({
  name: nameSchema,
  raNumber: raNumberSchema,
  netId: netIdSchema,
  phoneNumber: phoneSchema,
  departmentCode: departmentCodeSchema,
  facultyName: facultyNameSchema,
  facultyPhone: facultyPhoneSchema,
  facultyEmail: facultyEmailSchema,
});

export type MemberValues = z.infer<typeof memberSchema>;

/**
 * What the inputs actually hold while typing. Every member slot stays mounted in
 * form state even when unused, so the base schema must tolerate blanks —
 * the real per-field checks run in `superRefine` for active slots only.
 */
const memberDraftSchema = z.object(
  Object.fromEntries(
    MEMBER_FIELDS.map((field) => [field, z.string()]),
  ) as Record<(typeof MEMBER_FIELDS)[number], z.ZodString>,
);

export type MemberDraft = z.infer<typeof memberDraftSchema>;

export const teamStepSchema = z.object({
  memberCount: z.number().int().min(MIN_MEMBERS).max(MAX_MEMBERS),
  teamName: teamNameSchema,
  trackId: trackIdSchema,
});

/** Empty member slot — used for form defaults and for clearing a dropped slot. */
export function emptyMember(): MemberDraft {
  return Object.fromEntries(
    MEMBER_FIELDS.map((field) => [field, ""]),
  ) as MemberDraft;
}

export const registrationSchema = z
  .object({
    leader: memberDraftSchema,
    team: teamStepSchema,
    members: z.array(memberDraftSchema).length(MAX_MEMBERS - 1),
  })
  .superRefine((value, ctx) => {
    const addIssues = (
      result: z.ZodSafeParseResult<MemberValues>,
      prefix: (string | number)[],
    ) => {
      if (result.success) return;
      for (const issue of result.error.issues) {
        ctx.addIssue({ ...issue, path: [...prefix, ...issue.path] });
      }
    };

    const leader = memberSchema.safeParse(value.leader);
    addIssues(leader, ["leader"]);

    // Only the slots this team size actually uses are validated; the rest stay
    // mounted but ignored, so lowering the count never blocks submission.
    const activeSlots = value.team.memberCount - 1;
    const parsedMembers: MemberValues[] = [];
    for (let index = 0; index < activeSlots; index += 1) {
      const parsed = memberSchema.safeParse(value.members[index]);
      addIssues(parsed, ["members", index]);
      if (parsed.success) parsedMembers.push(parsed.data);
    }

    // Duplicate RA / netID inside one submission. Postgres would catch these
    // too, but only as an opaque constraint name after a wasted round trip —
    // here we can point at the exact field that repeats.
    const people = [
      ...(leader.success ? [{ data: leader.data, path: ["leader"] }] : []),
      ...parsedMembers.map((data, index) => ({
        data,
        path: ["members", index],
      })),
    ];

    for (const key of ["raNumber", "netId"] as const) {
      const seen = new Map<string, (string | number)[]>();
      for (const person of people) {
        const value_ = person.data[key];
        const first = seen.get(value_);
        if (first) {
          ctx.addIssue({
            code: "custom",
            path: [...person.path, key],
            message:
              key === "raNumber"
                ? "This RA number is already used by another member."
                : "This netID is already used by another member.",
          });
        } else {
          seen.set(value_, person.path);
        }
      }
    }
  });

export type RegistrationValues = z.infer<typeof registrationSchema>;

/**
 * Total steps for a team size: leader + team + one per non-leader member,
 * then a final review step. A solo leader fills 3 steps, a team of 3 fills 5.
 */
export function totalSteps(memberCount: number) {
  return memberCount + 2;
}

/** The last step is always review, and it collects nothing. */
export function isReviewStep(step: number, memberCount: number) {
  return step === totalSteps(memberCount);
}

/**
 * RHF paths to validate before advancing past `step` (1-based).
 *
 * `memberCount` is required because every member slot exists in form state at
 * every team size — only the step layout says which are in use. Without it, the
 * review step of a solo team would resolve to `members.0.*` and validate a
 * blank slot that is never submitted.
 */
export function fieldsForStep(step: number, memberCount: number): string[] {
  if (step === 1) return MEMBER_FIELDS.map((field) => `leader.${field}`);
  if (step === 2) return ["team.memberCount", "team.teamName", "team.trackId"];
  if (isReviewStep(step, memberCount)) return [];
  const index = step - 3;
  if (index >= MAX_MEMBERS - 1) return [];
  return MEMBER_FIELDS.map((field) => `members.${index}.${field}`);
}

/**
 * Normalised roster for `createTeam`, leader first. Re-parses through
 * `memberSchema` so the values that reach the DB are the trimmed/cased ones —
 * `registrationSchema` validates drafts but passes them through untouched.
 */
export function toRoster(values: RegistrationValues) {
  const activeSlots = values.team.memberCount - 1;
  return [
    { ...memberSchema.parse(values.leader), isLeader: true },
    ...values.members
      .slice(0, activeSlots)
      .map((member) => ({ ...memberSchema.parse(member), isLeader: false })),
  ];
}
