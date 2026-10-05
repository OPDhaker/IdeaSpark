import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * One review lifecycle, shared by `teams.status` and `submissions.status`.
 *
 * `teams.status` is the team's current state and the column every gate reads
 * (payment, leaderboard, track changes). `submissions.status` is the per-round
 * record, so ISD-1 and ISD-2 keep separate verdicts. Both are always written in
 * the same transaction (see `src/db/transactions.ts`), so they cannot drift.
 *
 * pending_submission -> in_review -> accepted | rejected. `rejected` is
 * terminal; only a super_admin override reopens a team.
 */
export const reviewStatusEnum = pgEnum("review_status_enum", [
  "pending_submission",
  "in_review",
  "rejected",
  "accepted",
]);

export const paymentStatusEnum = pgEnum("payment_status_enum", [
  "unpaid",
  "paid",
]);

/**
 * Whether a submission's Drive link opened for an anonymous caller when it was
 * last checked (`src/lib/drive.ts`). `unverified` = the check itself failed and
 * the link was let through; NULL = submitted before checks existed.
 */
export const driveLinkStatusEnum = pgEnum("drive_link_status_enum", [
  "public",
  "restricted",
  "unverified",
]);

export const adminRoleEnum = pgEnum("admin_role_enum", [
  "super_admin",
  "evaluator",
  "volunteer",
]);

/**
 * The two kinds of judging panel. Every event day a team stands in front of
 * one of each: `main` (Panel Type 1) scores the four core criteria out of 90,
 * `risk` (Panel Type 2) scores Risk Management out of 10.
 */
export const panelTypeEnum = pgEnum("panel_type_enum", ["main", "risk"]);

export const tracks = pgTable("tracks", {
  id: uuid().defaultRandom().primaryKey(),
  name: varchar({ length: 255 }).notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const departments = pgTable("departments", {
  code: varchar({ length: 16 }).primaryKey(),
  label: varchar({ length: 128 }).notNull().unique(),
});

export const admins = pgTable("admins", {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  role: adminRoleEnum().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const teams = pgTable(
  "teams",
  {
    id: uuid().defaultRandom().primaryKey(),
    teamName: varchar("team_name", { length: 255 }).notNull().unique(),
    trackId: uuid("track_id").references(() => tracks.id, {
      onDelete: "set null",
    }),
    /**
     * Neon Auth user id for the verified team leader.
     * Members do not have separate Google/Neon Auth identities.
     */
    leadUserId: text("lead_user_id").notNull().unique(),
    status: reviewStatusEnum().notNull().default("pending_submission"),
    paymentStatus: paymentStatusEnum("payment_status")
      .notNull()
      .default("unpaid"),
    paymentId: varchar("payment_id", { length: 255 }).unique(),
    /**
     * The team's door pass: one QR per team, printed on the receipt. Minted in
     * the same transaction that marks the team paid, so a paid team always has
     * one (`teams_paid_has_attendance_code`). A volunteer scans it, then ticks
     * which members are present.
     */
    attendanceCode: varchar("attendance_code", { length: 128 }).unique(),
    reviewedBy: uuid("reviewed_by").references(() => admins.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("teams_name_not_blank", sql`length(trim(${t.teamName})) > 0`),
    check(
      "teams_paid_has_attendance_code",
      sql`${t.paymentStatus} <> 'paid' OR ${t.attendanceCode} IS NOT NULL`,
    ),
    index("teams_track_id_idx").on(t.trackId),
    index("teams_status_idx").on(t.status),
    index("teams_payment_status_idx").on(t.paymentStatus),
  ],
);

export const members = pgTable(
  "members",
  {
    id: uuid().defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    name: varchar({ length: 255 }).notNull(),
    raNumber: varchar("ra_number", { length: 64 }).notNull().unique(),
    netId: varchar("net_id", { length: 128 }).notNull().unique(),
    phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
    departmentCode: varchar("department_code", { length: 16 })
      .notNull()
      .references(() => departments.code),
    facultyName: varchar("faculty_name", { length: 255 }).notNull(),
    facultyPhone: varchar("faculty_phone", { length: 20 }).notNull(),
    facultyEmail: varchar("faculty_email", { length: 255 }).notNull(),
    isLeader: boolean("is_leader").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("members_team_id_idx").on(t.teamId),
    index("members_department_idx").on(t.departmentCode),
    uniqueIndex("one_leader_per_team")
      .on(t.teamId)
      .where(sql`${t.isLeader} = true`),
  ],
);

export const evaluationRounds = pgTable(
  "evaluation_rounds",
  {
    id: uuid().defaultRandom().primaryKey(),
    name: varchar({ length: 255 }).notNull(),
    /** URL segment for `/panel/[round]`, e.g. `isd-1`. */
    slug: varchar({ length: 64 }).notNull().unique(),
    description: text(),
    sequenceNo: integer("sequence_no").notNull().unique(),
    /**
     * The event day this round runs on. It decides which `attendance` rows make
     * a team judgeable, so it has to be stored rather than derived: a `check`
     * cannot reach into `event_config` to compare against `day_one`/`day_two`.
     * That comparison lives in `createEvaluationRound`, the same way
     * `event_config.attendance_day` pins a scan date.
     */
    eventDate: date("event_date").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "evaluation_rounds_slug_format",
      sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
    ),
    uniqueIndex("evaluation_rounds_one_active_unique")
      .on(t.isActive)
      .where(sql`${t.isActive} = true`),
  ],
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid().defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    roundId: uuid("round_id")
      .notNull()
      .references(() => evaluationRounds.id, { onDelete: "cascade" }),
    title: varchar({ length: 255 }),
    description: text(),
    driveLink: text("drive_link"),
    driveLinkStatus: driveLinkStatusEnum("drive_link_status"),
    /** File name Drive reported, so a reviewer can tell it's the right deck. */
    driveLinkName: varchar("drive_link_name", { length: 255 }),
    /** Drive's `modifiedTime`: a deck edited after the deadline is flagged. */
    driveLinkModifiedAt: timestamp("drive_link_modified_at", {
      withTimezone: true,
    }),
    driveLinkCheckedAt: timestamp("drive_link_checked_at", {
      withTimezone: true,
    }),
    status: reviewStatusEnum().notNull().default("pending_submission"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => admins.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    remarks: text(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("submissions_team_round_unique").on(t.teamId, t.roundId),
    index("submissions_team_id_idx").on(t.teamId),
    index("submissions_round_id_idx").on(t.roundId),
    index("submissions_status_idx").on(t.status),
    index("submissions_reviewed_by_idx").on(t.reviewedBy),
  ],
);

export const attendance = pgTable(
  "attendance",
  {
    id: uuid().defaultRandom().primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    eventDate: date("event_date").notNull(),
    scannedAt: timestamp("scanned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    scannedBy: uuid("scanned_by").references(() => admins.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    unique("attendance_member_date_unique").on(t.memberId, t.eventDate),
    index("attendance_event_date_idx").on(t.eventDate),
    index("attendance_scanned_by_idx").on(t.scannedBy),
  ],
);

/**
 * The judging rubric. Each event day a team is scored by two panels: Panel
 * Type 1 (`main`) on four criteria out of 90 and Panel Type 2 (`risk`) on Risk
 * Management out of 10, for 100 a day. The final leaderboard averages the days,
 * so it is out of 100 too.
 *
 * One row per (team, round, evaluator). A judge sits on exactly one panel, so a
 * row carries exactly one panel type, and `scores_shape` makes the columns
 * agree with it: a `main` row fills the four core criteria and leaves risk
 * NULL, a `risk` row the reverse.
 *
 * Each criterion carries its own range `check`, so the maxima are a property of
 * the columns rather than a separate total that could drift from its parts.
 * `score` is `GENERATED ALWAYS` for the same reason — it is the row's sum by
 * definition, not by whichever action last wrote the row, and a write to it is
 * rejected by the database.
 */
export const PANEL_TYPES = {
  main: {
    label: "Panel Type 1",
    criteria: [
      { key: "problemUnderstanding", label: "Problem Understanding", max: 25 },
      { key: "ideaFeasibility", label: "Idea Feasibility", max: 20 },
      { key: "decisionMaking", label: "Decision Making", max: 25 },
      { key: "coordination", label: "Coordination", max: 20 },
    ],
  },
  risk: {
    label: "Panel Type 2",
    criteria: [{ key: "riskManagement", label: "Risk Management", max: 10 }],
  },
} as const;

export type PanelType = keyof typeof PANEL_TYPES;

export const PANEL_TYPE_KEYS = Object.keys(PANEL_TYPES) as PanelType[];

/** Every criterion across both panel types, in sheet order. */
export const SCORE_CRITERIA = [
  ...PANEL_TYPES.main.criteria,
  ...PANEL_TYPES.risk.criteria,
] as const;

export type ScoreCriterionKey = (typeof SCORE_CRITERIA)[number]["key"];

/** 90 for `main`, 10 for `risk`. */
export function panelMax(type: PanelType): number {
  return PANEL_TYPES[type].criteria.reduce((sum, c) => sum + c.max, 0);
}

/** 100 — one day's total, derived so it cannot fall out of step with the parts. */
export const DAY_MAX = SCORE_CRITERIA.reduce((sum, c) => sum + c.max, 0);

/** The final leaderboard is the mean of the day totals, so it keeps the scale. */
export const FINAL_MAX = DAY_MAX;

export const scores = pgTable(
  "scores",
  {
    id: uuid().defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    roundId: uuid("round_id")
      .notNull()
      .references(() => evaluationRounds.id, { onDelete: "cascade" }),
    evaluatorId: uuid("evaluator_id")
      .notNull()
      .references(() => admins.id, { onDelete: "cascade" }),
    /** The type of the judge's panel when the row was written. */
    panelType: panelTypeEnum("panel_type").notNull(),
    problemUnderstanding: numeric("problem_understanding", {
      precision: 5,
      scale: 2,
    }),
    ideaFeasibility: numeric("idea_feasibility", {
      precision: 5,
      scale: 2,
    }),
    decisionMaking: numeric("decision_making", {
      precision: 5,
      scale: 2,
    }),
    coordination: numeric({ precision: 5, scale: 2 }),
    riskManagement: numeric("risk_management", { precision: 5, scale: 2 }),
    /** Generated: never write this column. */
    score: numeric({ precision: 6, scale: 2 }).generatedAlwaysAs(
      sql`coalesce(problem_understanding, 0) + coalesce(idea_feasibility, 0) + coalesce(decision_making, 0) + coalesce(coordination, 0) + coalesce(risk_management, 0)`,
    ),
    remarks: text(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "scores_problem_understanding_range",
      sql`${t.problemUnderstanding} >= 0 AND ${t.problemUnderstanding} <= 25`,
    ),
    check(
      "scores_idea_feasibility_range",
      sql`${t.ideaFeasibility} >= 0 AND ${t.ideaFeasibility} <= 20`,
    ),
    check(
      "scores_decision_making_range",
      sql`${t.decisionMaking} >= 0 AND ${t.decisionMaking} <= 25`,
    ),
    check(
      "scores_coordination_range",
      sql`${t.coordination} >= 0 AND ${t.coordination} <= 20`,
    ),
    check(
      "scores_risk_management_range",
      sql`${t.riskManagement} >= 0 AND ${t.riskManagement} <= 10`,
    ),
    check(
      "scores_shape",
      sql`(${t.panelType} = 'main'
        AND ${t.problemUnderstanding} IS NOT NULL
        AND ${t.ideaFeasibility} IS NOT NULL
        AND ${t.decisionMaking} IS NOT NULL
        AND ${t.coordination} IS NOT NULL
        AND ${t.riskManagement} IS NULL)
      OR (${t.panelType} = 'risk'
        AND ${t.problemUnderstanding} IS NULL
        AND ${t.ideaFeasibility} IS NULL
        AND ${t.decisionMaking} IS NULL
        AND ${t.coordination} IS NULL
        AND ${t.riskManagement} IS NOT NULL)`,
    ),
    unique("scores_team_round_evaluator_unique").on(
      t.teamId,
      t.roundId,
      t.evaluatorId,
    ),
    index("scores_team_id_idx").on(t.teamId),
    index("scores_round_id_idx").on(t.roundId),
    index("scores_evaluator_id_idx").on(t.evaluatorId),
  ],
);

/**
 * A judging panel: evaluators who score the same teams and whose scores average
 * into one number per team. `type` is fixed at creation — assignments copy it,
 * and the composite foreign key below needs it to never change underneath them.
 */
export const panels = pgTable(
  "panels",
  {
    id: uuid().defaultRandom().primaryKey(),
    name: varchar({ length: 128 }).notNull().unique(),
    type: panelTypeEnum().notNull().default("main"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("panels_name_not_blank", sql`length(trim(${t.name})) > 0`),
    // Target of the assignments' composite foreign key.
    unique("panels_id_type_unique").on(t.id, t.type),
  ],
);

/**
 * Panel roster. `unique(adminId)` is the "one panel per judge" rule: panels are
 * global and assignments are per round, so a judge sitting on two panels would
 * have no single answer to "which teams are mine".
 */
export const panelMembers = pgTable(
  "panel_members",
  {
    panelId: uuid("panel_id")
      .notNull()
      .references(() => panels.id, { onDelete: "cascade" }),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => admins.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.panelId, t.adminId] }),
    unique("panel_members_one_panel_per_admin").on(t.adminId),
    index("panel_members_admin_id_idx").on(t.adminId),
  ],
);

/**
 * Which panels judge which team, per round. Set by a super admin. A team has at
 * most one panel of each type per round. `panelType` is a copy of the panel's
 * type, held honest by the composite foreign key, so the uniqueness can be
 * declared on this table.
 */
export const teamPanelAssignments = pgTable(
  "team_panel_assignments",
  {
    id: uuid().defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    roundId: uuid("round_id")
      .notNull()
      .references(() => evaluationRounds.id, { onDelete: "cascade" }),
    panelId: uuid("panel_id").notNull(),
    panelType: panelTypeEnum("panel_type").notNull(),
    assignedBy: uuid("assigned_by").references(() => admins.id, {
      onDelete: "set null",
    }),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "team_panel_assignments_panel_fk",
      columns: [t.panelId, t.panelType],
      foreignColumns: [panels.id, panels.type],
    }).onDelete("cascade"),
    unique("team_panel_assignments_team_round_type_unique").on(
      t.teamId,
      t.roundId,
      t.panelType,
    ),
    index("team_panel_assignments_round_panel_idx").on(t.roundId, t.panelId),
    index("team_panel_assignments_team_id_idx").on(t.teamId),
  ],
);

export const eventConfig = pgTable(
  "event_config",
  {
    id: integer().primaryKey().default(1),
    registrationDeadline: timestamp("registration_deadline", {
      withTimezone: true,
    }).notNull(),
    submissionDeadline: timestamp("submission_deadline", {
      withTimezone: true,
    }).notNull(),
    registrationFee: numeric("registration_fee", {
      precision: 10,
      scale: 2,
    }).notNull(),
    /** Deck template the team downloads before submitting. Null hides the link. */
    submissionTemplateUrl: text("submission_template_url"),
    /**
     * Whether teams can see `/dashboard/leaderboard`.
     *
     * A switch, not a date. Scores arrive one judge at a time while a round
     * runs, so any schedule-driven unlock shows a half-judged board; whether
     * judging is *finished* is a call a super admin makes in the room, through
     * `/admin/event`. `day_one` keeps all its other jobs — it just no longer
     * has this one.
     */
    leaderboardPublished: boolean("leaderboard_published")
      .notNull()
      .default(false),
    /**
     * The two event days. `date`, not `timestamptz`, so they compare directly
     * against `attendance.event_date` — and so the leaderboard gate is a plain
     * calendar comparison. Read them in IST: a `date` against UTC `now()` would
     * flip at 05:30 local.
     */
    dayOne: date("day_one").notNull(),
    dayTwo: date("day_two").notNull(),
    /**
     * Which event day the door scanner is open for; NULL = closed. A super
     * admin flips it at `/admin/event`. Scans are filed under this date, not
     * the wall clock, and it must be `day_one` or `day_two` so a scan always
     * lines up with a round's `event_date`.
     */
    attendanceDay: date("attendance_day"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("event_config_singleton", sql`${t.id} = 1`),
    check(
      "event_config_deadline_order",
      sql`${t.registrationDeadline} <= ${t.submissionDeadline}`,
    ),
    check("event_config_fee_nonnegative", sql`${t.registrationFee} >= 0`),
    check("event_config_day_order", sql`${t.dayOne} <= ${t.dayTwo}`),
    check(
      "event_config_attendance_day_is_event_day",
      sql`${t.attendanceDay} IS NULL OR ${t.attendanceDay} IN (${t.dayOne}, ${t.dayTwo})`,
    ),
    check(
      "event_config_submission_before_day_one",
      sql`${t.submissionDeadline} <= ${t.dayOne}`,
    ),
  ],
);

export const announcements = pgTable(
  "announcements",
  {
    id: uuid().defaultRandom().primaryKey(),
    title: varchar({ length: 255 }).notNull(),
    body: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("announcements_created_at_idx").on(t.createdAt)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid().defaultRandom().primaryKey(),
    actorUserId: text("actor_user_id"),
    action: varchar({ length: 64 }).notNull(),
    targetType: varchar("target_type", { length: 32 }).notNull(),
    targetId: text("target_id").notNull(),
    meta: text(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_log_target_idx").on(t.targetType, t.targetId),
    index("audit_log_actor_idx").on(t.actorUserId),
    index("audit_log_created_at_idx").on(t.createdAt),
  ],
);
