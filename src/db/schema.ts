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
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const teamStatusEnum = pgEnum("team_status_enum", [
  "pending",
  "approved",
  "rejected",
]);

export const submissionStatusEnum = pgEnum("submission_status_enum", [
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
    status: teamStatusEnum().notNull().default("pending"),
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
    description: text(),
    sequenceNo: integer("sequence_no").notNull().unique(),
    isActive: boolean("is_active").notNull().default(false),
    resultsPublished: boolean("results_published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
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
    status: submissionStatusEnum().notNull().default("pending_submission"),
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
    score: numeric({ precision: 5, scale: 2 }).notNull(),
    remarks: text(),
    innovation: numeric({ precision: 5, scale: 2 }),
    feasibility: numeric({ precision: 5, scale: 2 }),
    impact: numeric({ precision: 5, scale: 2 }),
    presentation: numeric({ precision: 5, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("scores_score_range", sql`${t.score} >= 0 AND ${t.score} <= 100`),
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
    resultsPublished: boolean("results_published").notNull().default(false),
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
