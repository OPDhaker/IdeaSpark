/**
 * Team size, leader included. The single source for the rule — the zod schema,
 * the `/register` wizard, the server actions and the transaction layer all read
 * these rather than restating the numbers.
 *
 * The maximum is also enforced in Postgres by `team_member_limit_trigger`
 * (`drizzle/20260922020000_team_size_one_to_three`). The minimum is not, and
 * cannot be: a row-level check cannot see the rest of the roster, and a team is
 * created with its whole roster in one transaction. The floor lives in
 * `src/db/transactions.ts`.
 *
 * Keep these in step with the trigger — changing them alone does not move the
 * database's ceiling.
 */
export const MIN_MEMBERS = 1;
export const MAX_MEMBERS = 3;

/** For error copy: "A team must contain 1 to 3 members". */
export const TEAM_SIZE_RANGE_LABEL = `${MIN_MEMBERS} to ${MAX_MEMBERS}`;
