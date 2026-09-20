import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
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

export const paymentTxnStatusEnum = pgEnum("payment_txn_status_enum", [
  "created",
  "paid",
  "failed",
]);

export const adminRoleEnum = pgEnum("admin_role_enum", [
  "super_admin",
  "evaluator",
  "volunteer",
]);

export const tracks = pgTable("tracks", {
  id: uuid().defaultRandom().primaryKey(),
  name: varchar({ length: 255 }).notNull().unique(),
  description: text(),
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
    paymentStatus: paymentStatusEnum("payment_status"),
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
    attendanceCode: varchar("attendance_code", { length: 128 }).unique(),
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
     * `scanAttendance` validates a scan date.
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

export const payments = pgTable(
  "payments",
  {
    id: uuid().defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .unique()
      .references(() => teams.id, { onDelete: "cascade" }),
    razorpayOrderId: varchar("razorpay_order_id", { length: 255 })
      .notNull()
      .unique(),
    razorpayPaymentId: varchar("razorpay_payment_id", { length: 255 }).unique(),
    razorpaySignature: text("razorpay_signature"),
    amount: numeric({ precision: 10, scale: 2 }).notNull(),
    status: paymentTxnStatusEnum().notNull().default("created"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    check("payments_amount_nonnegative", sql`${t.amount} >= 0`),
    check(
      "payments_paid_requires_provider_id",
      sql`${t.status} <> 'paid' OR ${t.razorpayPaymentId} IS NOT NULL`,
    ),
    index("payments_status_idx").on(t.status),
    index("payments_razorpay_payment_id_idx").on(t.razorpayPaymentId),
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
 * The judging rubric, out of 50. One row per (team, round, evaluator): every
 * judge on a panel scores the same team on their own screen, and the team's
 * number is the panel's per-criterion mean.
 *
 * Each criterion carries its own range `check`, so "out of 50" is a property of
 * the columns rather than a separate total that could drift from its parts.
 * `score` is `GENERATED ALWAYS` for the same reason — it is the sum by
 * definition, not by whichever action last wrote the row, and a write to it is
 * rejected by the database.
 */
export const SCORE_CRITERIA = [
  { key: "problemUnderstanding", label: "Problem Understanding", max: 15 },
  { key: "ideaFeasibility", label: "Idea Feasibility", max: 10 },
  { key: "decisionMaking", label: "Decision Making", max: 15 },
  { key: "coordination", label: "Coordination", max: 10 },
] as const;

export type ScoreCriterionKey = (typeof SCORE_CRITERIA)[number]["key"];

/** 50 — the rubric total, derived so it cannot fall out of step with the parts. */
export const SCORE_MAX = SCORE_CRITERIA.reduce((sum, c) => sum + c.max, 0);

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
    problemUnderstanding: numeric("problem_understanding", {
      precision: 5,
      scale: 2,
    }).notNull(),
    ideaFeasibility: numeric("idea_feasibility", {
      precision: 5,
      scale: 2,
    }).notNull(),
    decisionMaking: numeric("decision_making", {
      precision: 5,
      scale: 2,
    }).notNull(),
    coordination: numeric({ precision: 5, scale: 2 }).notNull(),
    /** Generated: never write this column. */
    score: numeric({ precision: 6, scale: 2 }).generatedAlwaysAs(
      sql`problem_understanding + idea_feasibility + decision_making + coordination`,
    ),
    remarks: text(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "scores_problem_understanding_range",
      sql`${t.problemUnderstanding} >= 0 AND ${t.problemUnderstanding} <= 15`,
    ),
    check(
      "scores_idea_feasibility_range",
      sql`${t.ideaFeasibility} >= 0 AND ${t.ideaFeasibility} <= 10`,
    ),
    check(
      "scores_decision_making_range",
      sql`${t.decisionMaking} >= 0 AND ${t.decisionMaking} <= 15`,
    ),
    check(
      "scores_coordination_range",
      sql`${t.coordination} >= 0 AND ${t.coordination} <= 10`,
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
 * A judging panel: two or more evaluators who score the same teams and whose
 * scores average into one number per team.
 */
export const panels = pgTable(
  "panels",
  {
    id: uuid().defaultRandom().primaryKey(),
    name: varchar({ length: 128 }).notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("panels_name_not_blank", sql`length(trim(${t.name})) > 0`)],
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

/** Which panel judges which team, per round. Set by a super admin. */
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
    panelId: uuid("panel_id")
      .notNull()
      .references(() => panels.id, { onDelete: "cascade" }),
    assignedBy: uuid("assigned_by").references(() => admins.id, {
      onDelete: "set null",
    }),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("team_panel_assignments_team_round_unique").on(t.teamId, t.roundId),
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
     * The two event days. `date`, not `timestamptz`, so they compare directly
     * against `attendance.event_date` — and so the leaderboard gate is a plain
     * calendar comparison. Read them in IST: a `date` against UTC `now()` would
     * flip at 05:30 local.
     */
    dayOne: date("day_one").notNull(),
    dayTwo: date("day_two").notNull(),
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
