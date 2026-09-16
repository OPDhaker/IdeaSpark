import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uuid,
  boolean,
  date,
  varchar,
} from "drizzle-orm/pg-core";

// User ids (leadUserId, judgeUserId, reviewedBy, actorUserId) are Neon
// Better Auth `user.id` values (text) taken from auth.api.getSession().

export const tracks = pgTable("tracks", {
  id: serial().primaryKey(),
  name: varchar({ length: 255 }).notNull().unique(),
  description: text(),
});

export const departments = pgTable("departments", {
  code: varchar({ length: 16 }).primaryKey(),
  label: varchar({ length: 128 }).notNull().unique(),
});

export const teams = pgTable("teams", {
  id: serial().primaryKey(),
  name: varchar({ length: 255 }).notNull().unique(),
  trackId: integer().references(() => tracks.id, { onDelete: "set null" }),
  leadUserId: text().notNull(),
  status: varchar({ length: 32 }).notNull().default("pending"),
  reviewedBy: text(),
  reviewedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const teamMembers = pgTable(
  "team_members",
  {
    id: serial().primaryKey(),
    teamId: integer()
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    name: varchar({ length: 255 }).notNull(),
    raNumber: varchar({ length: 32 }).notNull().unique(),
    phone: varchar({ length: 20 }).notNull(),
    netId: varchar({ length: 64 }).notNull().unique(),
    department: varchar({ length: 16 })
      .notNull()
      .references(() => departments.code),
    faName: varchar({ length: 255 }).notNull(),
    faMobile: varchar({ length: 20 }).notNull(),
    faEmail: varchar({ length: 255 }).notNull(),
    attendanceCode: varchar({ length: 64 }).notNull().unique(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("team_members_teamId_idx").on(t.teamId)],
);

export const attendance = pgTable(
  "attendance",
  {
    id: serial().primaryKey(),
    memberId: integer()
      .notNull()
      .references(() => teamMembers.id, { onDelete: "cascade" }),
    eventDate: varchar({ length: 10 }).notNull(), // YYYY-MM-DD
    scannedBy: text(), // admin user id
    scannedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.memberId, t.eventDate)],
);

// singleton: deadlines, fee, feature gates
export const eventConfig = pgTable("event_config", {
  id: integer().primaryKey().default(1),
  registrationDeadline: timestamp({ withTimezone: true }),
  submissionDeadline: timestamp({ withTimezone: true }),
  registrationFee: integer().notNull().default(0), // paise
  resultsReleased: integer().notNull().default(0),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const ideas = pgTable(
  "ideas",
  {
    id: serial().primaryKey(),
    teamId: integer()
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    title: varchar({ length: 255 }).notNull(),
    description: text().notNull(),
    pptLink: text().notNull(),
    round: integer().notNull().default(1),
    status: varchar({ length: 32 }).notNull().default("submitted"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.teamId, t.round)],
);

export const payments = pgTable("payments", {
  id: serial().primaryKey(),
  teamId: integer()
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  amount: integer().notNull(),
  txnRef: varchar({ length: 255 }).notNull(),
  screenshotUrl: text(),
  status: varchar({ length: 32 }).notNull().default("pending"),
  reviewedBy: text(),
  reviewedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const announcements = pgTable("announcements", {
  id: serial().primaryKey(),
  title: varchar({ length: 255 }).notNull(),
  body: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const scores = pgTable(
  "scores",
  {
    id: serial().primaryKey(),
    ideaId: integer()
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    judgeUserId: text().notNull(),
    innovation: integer().notNull(),
    feasibility: integer().notNull(),
    impact: integer().notNull(),
    presentation: integer().notNull(),
    remarks: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.ideaId, t.judgeUserId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial().primaryKey(),
    actorUserId: text(),
    action: varchar({ length: 64 }).notNull(),
    targetType: varchar({ length: 32 }).notNull(),
    targetId: integer().notNull(),
    meta: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_target_idx").on(t.targetType, t.targetId)],
);

// Real database tables used by the attendance feature.
// These match the existing Neon database schema.

export const dbTeams = pgTable("teams", {
  id: uuid("id").primaryKey(),
  teamName: text("team_name").notNull(),
});

export const dbMembers = pgTable("members", {
  id: uuid("id").primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => dbTeams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  attendanceCode: text("attendance_code"),
});

export const dbAdmins = pgTable("admins", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
});

export const dbAttendance = pgTable(
  "attendance",
  {
    id: uuid("id").primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => dbMembers.id, { onDelete: "cascade" }),
    eventDate: date("event_date").notNull(),
    scannedBy: uuid("scanned_by").references(() => dbAdmins.id),
    scannedAt: timestamp("scanned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique().on(table.memberId, table.eventDate),
  ],
);