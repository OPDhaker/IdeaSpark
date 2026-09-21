import "dotenv/config";
import { db, pool } from "../src/db";
import {
  admins,
  departments,
  evaluationRounds,
  eventConfig,
  tracks,
} from "../src/db/schema";
import { OFFICIAL_DEPARTMENTS } from "../src/db/seed-departments";
import { OFFICIAL_TRACKS } from "../src/db/seed-tracks";

const departmentRows = OFFICIAL_DEPARTMENTS;

// `IDEASPARK_TRACKS` stays as an override for a throwaway branch; unset, the
// real list seeds.
const envTracks = (process.env.IDEASPARK_TRACKS ?? "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

const trackNames: string[] = envTracks.length
  ? envTracks
  : [...OFFICIAL_TRACKS];

await db.transaction(async (tx) => {
  await tx
    .insert(departments)
    .values(departmentRows.map(([code, label]) => ({ code, label })))
    .onConflictDoNothing();

  if (trackNames.length) {
    await tx
      .insert(tracks)
      .values(trackNames.map((name) => ({ name, isActive: true })))
      // A track is only its name now, and the name is the conflict target, so
      // re-seeding has nothing left to update.
      .onConflictDoNothing();
  }

  // `YYYY-MM-DD`, not timestamps: these are calendar days, and they must
  // satisfy event_config_submission_before_day_one and event_config_day_order.
  const dayOne = process.env.DAY_ONE?.trim() || "2026-10-05";
  const dayTwo = process.env.DAY_TWO?.trim() || "2026-10-06";

  // ISD-1 is the round teams submit into; without an active round nothing can
  // be submitted at all. ISD-2 stays inactive — only one round may be active
  // (evaluation_rounds_one_active_unique).
  //
  // `slug` is the `/panel/[round]` segment; `eventDate` is the day whose
  // attendance decides which teams a panel can score.
  await tx
    .insert(evaluationRounds)
    .values([
      {
        name: "ISD-1",
        slug: "isd-1",
        sequenceNo: 1,
        eventDate: dayOne,
        isActive: true,
      },
      {
        name: "ISD-2",
        slug: "isd-2",
        sequenceNo: 2,
        eventDate: dayTwo,
        isActive: false,
      },
    ])
    .onConflictDoNothing({ target: evaluationRounds.sequenceNo });

  const registrationDeadline = process.env.REGISTRATION_DEADLINE;
  const submissionDeadline = process.env.SUBMISSION_DEADLINE;
  const fee = process.env.REGISTRATION_FEE;
  const templateUrl = process.env.SUBMISSION_TEMPLATE_URL?.trim() || null;
  if (registrationDeadline && submissionDeadline && fee) {
    await tx
      .insert(eventConfig)
      .values({
        id: 1,
        registrationDeadline: new Date(registrationDeadline),
        submissionDeadline: new Date(submissionDeadline),
        registrationFee: fee,
        submissionTemplateUrl: templateUrl,
        dayOne,
        dayTwo,
      })
      .onConflictDoUpdate({
        target: eventConfig.id,
        set: {
          registrationDeadline: new Date(registrationDeadline),
          submissionDeadline: new Date(submissionDeadline),
          registrationFee: fee,
          submissionTemplateUrl: templateUrl,
          dayOne,
          dayTwo,
          updatedAt: new Date(),
        },
      });
  }

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  const role = process.env.BOOTSTRAP_ADMIN_ROLE as
    | "super_admin"
    | "evaluator"
    | "volunteer"
    | undefined;

  if (email && name && role) {
    await tx.insert(admins).values({ email, name, role }).onConflictDoUpdate({
      target: admins.email,
      set: { name, role },
    });
  }
});

console.log("IdeaSpark database seed completed");
await pool.end();
