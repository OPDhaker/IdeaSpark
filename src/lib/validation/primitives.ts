/**
 * Editable validation primitives for IdeaSpark registration.
 *
 * This is the file to change when a format rule changes — the regexes and the
 * user-facing messages both live here, and `registration.ts` only composes
 * them into step shapes. Nothing here imports React or touches the DB, so it
 * is safe to use from a client component and from `"use server"` code alike.
 *
 * Every `.max()` mirrors the matching `varchar` width in `src/db/schema.ts`,
 * so a value that passes here can never be rejected by Postgres for length.
 */
import { z } from "zod";

/** `RA` followed by exactly 13 digits, e.g. RA2211003010123. */
export const RA_NUMBER_RE = /^RA\d{13}$/;

/** Two letters followed by exactly 4 digits, e.g. ab1234. */
export const NET_ID_RE = /^[a-z]{2}\d{4}$/;

/** Indian mobile: starts 6-9, exactly 10 digits. Used for students and faculty. */
export const IN_PHONE_RE = /^[6-9]\d{9}$/;

/**
 * Strips whatever the user pasted down to the 10 national digits the column
 * stores. The inputs show a `+91` prefix, which invites pasting the country
 * code back in; without this, `+91 91234 56789` would fail a rule the field
 * appears to be asking for.
 *
 * The length guards matter: a valid number can itself start with `91`
 * (`9123456789`), so the country code is only stripped when the digits
 * overflow 10.
 */
export function normalizeIndianPhone(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length > 10 && digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, 10);
}

export const MESSAGES = {
  name: "Please enter a valid name.",
  raNumber: "Invalid RA Number.",
  netId: "Invalid Net ID (of the form aa1234).",
  phone: "Enter a valid 10 digit mobile number.",
  department: "Pick a department.",
  facultyName: "Enter your faculty advisor's name.",
  facultyEmail: "Enter a valid faculty email address.",
  teamName: "Enter a team name.",
  track: "Pick a track.",
} as const;

/**
 * Case normalisation runs before the format check, so `ra2211003010123` and
 * `AB1234` are both accepted and both stored canonically. That matters because
 * `members.ra_number` and `members.net_id` are globally UNIQUE — without this,
 * two casings of the same ID would insert as two distinct rows.
 */
export const raNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .max(64)
  .regex(RA_NUMBER_RE, MESSAGES.raNumber);

export const netIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(128)
  .regex(NET_ID_RE, MESSAGES.netId);

export const phoneSchema = z
  .string()
  .trim()
  .max(20)
  .regex(IN_PHONE_RE, MESSAGES.phone);

export const nameSchema = z.string().trim().min(1, MESSAGES.name).max(255);

export const departmentCodeSchema = z
  .string()
  .trim()
  .min(1, MESSAGES.department)
  .max(16);

export const facultyNameSchema = z
  .string()
  .trim()
  .min(1, MESSAGES.facultyName)
  .max(255);

export const facultyPhoneSchema = phoneSchema;

export const facultyEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(255)
  .pipe(z.email(MESSAGES.facultyEmail));

/** Mirrors the `teams_name_not_blank` check constraint in the DB. */
export const teamNameSchema = z
  .string()
  .trim()
  .min(1, MESSAGES.teamName)
  .max(255);

export const trackIdSchema = z.uuid(MESSAGES.track);
