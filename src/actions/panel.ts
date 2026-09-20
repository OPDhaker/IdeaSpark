"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  getPanelCounts,
  getPanelForAdmin,
  getPanelJudges,
  getPanelLeaderboardRows,
  getPanelQueue,
  getPanelsWithJudges,
  getRoundBySlug,
  listAssignments,
  listEvaluationRounds,
} from "@/db/queries";
import { admins, panels, SCORE_CRITERIA, teams, tracks } from "@/db/schema";
import {
  assignTeamsToPanelAtomically,
  setPanelJudgesAtomically,
  upsertPanelScoreAtomically,
} from "@/db/transactions";
import { log } from "@/lib/audit";
import { requireAdminRole } from "@/lib/roles";

const JUDGE_ROLES = ["evaluator", "super_admin"] as const;

type PanelQueue = Awaited<ReturnType<typeof getPanelQueue>>;

export type PanelSheetTeam = PanelQueue["teams"][number] & {
  scores: PanelQueue["scores"];
  scoredByMe: boolean;
  /**
   * Whether the caller may write a score for this team. Only a judge on the
   * team's own panel can; a super admin who is not on it sees everything and
   * saves nothing. `upsertPanelScoreAtomically` enforces the same rule, so
   * this only decides whether the form is offered.
   */
  canScore: boolean;
};

/**
 * One shape for every state the sheet can be in — no round, no panel, empty
 * queue, or a team to score. Spelled out rather than inferred so the page can
 * narrow on `round`/`panel`/`current` instead of on which branch ran.
 */
export type PanelSheet = {
  round: Awaited<ReturnType<typeof getRoundBySlug>>;
  /** The panel the caller sits on, if any — not the one being viewed. */
  panel: Awaited<ReturnType<typeof getPanelForAdmin>>;
  admin: { id: string; name: string; isSuperAdmin: boolean };
  /** Panels to choose between. Empty for a judge, who sees only their own. */
  panelOptions: Array<{ id: string; name: string; teamCount: number }>;
  /** Which panel's queue is being shown; null means "every team". */
  viewingPanelId: string | null;
  teams: PanelSheetTeam[];
  current: PanelSheetTeam | null;
  /** Zero-based index of `current` in `teams`; -1 when there is none. */
  position: number;
  previous: PanelSheetTeam | null;
  next: PanelSheetTeam | null;
  nextUnscored: PanelSheetTeam | null;
  myScore: PanelQueue["scores"][number] | null;
};

export type ScoreInput = {
  roundId: string;
  teamId: string;
  problemUnderstanding: number;
  ideaFeasibility: number;
  decisionMaking: number;
  coordination: number;
  remarks?: string;
};

/**
 * Save one judge's rubric for one team. Every criterion is required — a
 * half-filled sheet has no total, and `scores.score` is generated from all
 * four.
 *
 * The range check here is the friendly one; the database enforces the same
 * bounds as `check` constraints, and the assignment/presence gates live in the
 * transaction so a stale page cannot slip past them.
 */
export async function upsertScore(input: ScoreInput) {
  const admin = await requireAdminRole([...JUDGE_ROLES]);

  const criteria = {
    problemUnderstanding: input.problemUnderstanding,
    ideaFeasibility: input.ideaFeasibility,
    decisionMaking: input.decisionMaking,
    coordination: input.coordination,
  };

  for (const { key, label, max } of SCORE_CRITERIA) {
    const value = criteria[key];
    if (!Number.isFinite(value) || value < 0 || value > max)
      throw new Error(`${label} must be between 0 and ${max}`);
  }

  const row = await upsertPanelScoreAtomically({
    roundId: input.roundId,
    teamId: input.teamId,
    evaluatorId: admin.id,
    criteria,
    remarks: input.remarks,
  });

  await log(admin.id, "score.upsert", "team", input.teamId, {
    roundId: input.roundId,
    ...criteria,
  });

  revalidatePath("/panel", "layout");
  revalidatePath("/dashboard/leaderboard");
  return row;
}

/**
 * Rounds, plus which panel the signed-in judge sits on.
 *
 * A super admin also gets every panel and its roster: they can look into any
 * of them, even though they can only write to their own.
 */
export async function getPanelRounds() {
  const admin = await requireAdminRole([...JUDGE_ROLES]);
  const isSuperAdmin = admin.role === "super_admin";

  const [rounds, panel, all] = await Promise.all([
    listEvaluationRounds(),
    getPanelForAdmin(admin.id),
    isSuperAdmin ? getPanelsWithJudges() : Promise.resolve(null),
  ]);

  return {
    admin: { id: admin.id, name: admin.name, role: admin.role, isSuperAdmin },
    rounds,
    panel,
    judges: panel ? await getPanelJudges(panel.id) : [],
    allPanels:
      all?.panels.map((p) => ({
        ...p,
        judges: all.judges.filter((j) => j.panelId === p.id),
      })) ?? [],
  };
}

/**
 * Everything one sheet needs: the panel's queue for the round, the selected
 * team and its neighbours.
 *
 * Neighbours come from the full A-Z ordering, never from a filtered view, so
 * prev/next means the same thing whether or not a search is active and the
 * position counter stays honest.
 */
export async function getPanelSheet(
  slug: string,
  teamId?: string,
  /** Super admin only: a panel id, or `"all"` for every judgeable team. */
  panelFilter?: string,
): Promise<PanelSheet> {
  const admin = await requireAdminRole([...JUDGE_ROLES]);
  const isSuperAdmin = admin.role === "super_admin";
  const me = { id: admin.id, name: admin.name, isSuperAdmin };

  const round = await getRoundBySlug(slug);
  // One shape in every case, rather than a union: each of "no such round", "no
  // panel" and "empty queue" is a state the page renders, not a different kind
  // of answer.
  const empty: PanelSheet = {
    round,
    panel: null,
    admin: me,
    panelOptions: [],
    viewingPanelId: null,
    teams: [],
    current: null,
    position: -1,
    previous: null,
    next: null,
    nextUnscored: null,
    myScore: null,
  };

  if (!round) return empty;

  const panel = await getPanelForAdmin(admin.id);

  // A judge with no panel has nothing to look at. A super admin always does —
  // oversight is the whole point of the role — so they fall through with the
  // panel switcher instead of a dead end.
  if (!panel && !isSuperAdmin) return { ...empty, round };

  const panelOptions = isSuperAdmin ? await getPanelCounts(round.id) : [];

  // Default to the caller's own panel, which is the only one they can write
  // to. `"all"` is the deliberate step out of it.
  const viewingPanelId = isSuperAdmin
    ? panelFilter === "all"
      ? null
      : (panelFilter ?? panel?.id ?? null)
    : (panel?.id ?? null);

  const { teams: queue, scores: scoreRows } = await getPanelQueue({
    roundId: round.id,
    panelId: viewingPanelId,
    eventDate: round.eventDate,
  });

  const byTeam = new Map<string, typeof scoreRows>();
  for (const row of scoreRows) {
    const list = byTeam.get(row.teamId);
    if (list) list.push(row);
    else byTeam.set(row.teamId, [row]);
  }

  const entries: PanelSheetTeam[] = queue.map((team) => {
    const rows = byTeam.get(team.id) ?? [];
    return {
      ...team,
      scores: rows,
      scoredByMe: rows.some((row) => row.evaluatorId === admin.id),
      canScore: Boolean(panel) && team.panelId === panel?.id,
    };
  });

  const found = teamId ? entries.findIndex((t) => t.id === teamId) : 0;
  const position = found >= 0 && entries.length > 0 ? found : 0;
  // Annotated, not inferred: the index signature is not `| undefined` under
  // this tsconfig, so without it an empty queue would type as a real team.
  const current: PanelSheetTeam | null = entries[position] ?? null;

  // Forward first, then wrap — a judge working down the list wants the next one
  // ahead of them, not the first one they skipped an hour ago. Only teams they
  // can actually score count as "unscored".
  const nextUnscored =
    entries.find((t, i) => i > position && t.canScore && !t.scoredByMe) ??
    entries.find((t, i) => i !== position && t.canScore && !t.scoredByMe) ??
    null;

  return {
    round,
    panel,
    admin: me,
    panelOptions,
    viewingPanelId,
    teams: entries,
    current,
    position: current ? position : -1,
    previous: (position > 0
      ? entries[position - 1]
      : null) as PanelSheetTeam | null,
    next: (position < entries.length - 1
      ? entries[position + 1]
      : null) as PanelSheetTeam | null,
    nextUnscored,
    myScore:
      current?.scores.find((row) => row.evaluatorId === admin.id) ?? null,
  };
}

/** The live board for a round. No day-one gate — judges need it during it. */
export async function getPanelLeaderboardView(slug: string) {
  await requireAdminRole([...JUDGE_ROLES]);
  const round = await getRoundBySlug(slug);
  if (!round) return { round: null, rows: [] };
  return { round, rows: await getPanelLeaderboardRows(round.id) };
}

// --- Admin: panels and assignments -----------------------------------------

export async function createPanel(name: string) {
  const admin = await requireAdminRole(["super_admin"]);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Panel name is required");

  const [row] = await db.insert(panels).values({ name: trimmed }).returning();
  await log(admin.id, "panel.create", "panel", row.id, { name: trimmed });
  revalidatePath("/admin/panels");
  return row;
}

export async function renamePanel(panelId: string, name: string) {
  const admin = await requireAdminRole(["super_admin"]);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Panel name is required");

  const [row] = await db
    .update(panels)
    .set({ name: trimmed })
    .where(eq(panels.id, panelId))
    .returning();
  if (!row) throw new Error("Panel not found");

  await log(admin.id, "panel.rename", "panel", panelId, { name: trimmed });
  revalidatePath("/admin/panels");
  return row;
}

/**
 * Deleting a panel cascades its roster and its assignments, but leaves the
 * scores its judges already wrote — those belong to the team and the round,
 * not to the panel that happened to produce them.
 */
export async function deletePanel(panelId: string) {
  const admin = await requireAdminRole(["super_admin"]);
  await db.delete(panels).where(eq(panels.id, panelId));
  await log(admin.id, "panel.delete", "panel", panelId);
  revalidatePath("/admin/panels");
  revalidatePath("/panel", "layout");
}

export async function setPanelJudges(panelId: string, adminIds: string[]) {
  const admin = await requireAdminRole(["super_admin"]);
  const rows = await setPanelJudgesAtomically({ panelId, adminIds });
  await log(admin.id, "panel.judges.set", "panel", panelId, { adminIds });
  revalidatePath("/admin/panels");
  revalidatePath("/panel", "layout");
  return rows;
}

export async function assignTeamsToPanel(
  roundId: string,
  panelId: string,
  teamIds: string[],
) {
  const admin = await requireAdminRole(["super_admin"]);
  const rows = await assignTeamsToPanelAtomically({
    teamIds,
    roundId,
    panelId,
    adminId: admin.id,
  });
  await log(admin.id, "panel.assign", "panel", panelId, { roundId, teamIds });
  revalidatePath("/admin/panels");
  revalidatePath("/panel", "layout");
  return rows;
}

export async function getPanelAdminData(roundId?: string) {
  await requireAdminRole(["super_admin"]);

  const rounds = await listEvaluationRounds();
  const round =
    rounds.find((r) => r.id === roundId) ??
    rounds.find((r) => r.isActive) ??
    rounds[0] ??
    null;

  const [{ panels: panelRows, judges }, teamRows, assignments] =
    await Promise.all([
      getPanelsWithJudges(),
      db
        .select({
          id: teams.id,
          teamName: teams.teamName,
          trackName: tracks.name,
          status: teams.status,
          paymentStatus: teams.paymentStatus,
        })
        .from(teams)
        .leftJoin(tracks, eq(teams.trackId, tracks.id))
        .where(
          and(eq(teams.status, "accepted"), eq(teams.paymentStatus, "paid")),
        )
        .orderBy(asc(teams.teamName)),
      round ? listAssignments(round.id) : Promise.resolve([]),
    ]);

  // Only these two roles can score, so only they can sit on a panel.
  const evaluators = await db
    .select({
      id: admins.id,
      name: admins.name,
      email: admins.email,
      role: admins.role,
    })
    .from(admins)
    .where(inArray(admins.role, [...JUDGE_ROLES]))
    .orderBy(asc(admins.name));

  return {
    rounds,
    round,
    panels: panelRows,
    judges,
    teams: teamRows,
    assignments,
    evaluators,
  };
}
