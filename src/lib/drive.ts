/**
 * Checks that a submitted Drive link is actually viewable by judges.
 *
 * The Drive API, called with an API key and no OAuth, can only see files shared
 * as "Anyone with the link". So a 200 means public and a 404 means restricted;
 * a file shared only inside a Workspace domain (SRM) is a 404 too, which is the
 * answer we want: a judge on a personal account can't open it.
 *
 * Anything else (no key, network error, quota, Google down) is `unverified` and
 * the caller lets the submission through. A Google outage near the deadline
 * must not stop teams submitting; a super admin can recheck later.
 */

const API = "https://www.googleapis.com/drive/v3/files";
const TIMEOUT_MS = 5000;

const DECK_MIME_TYPES = new Set([
  "application/vnd.google-apps.presentation",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
]);

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

const DRIVE_HOSTS = new Set(["drive.google.com", "docs.google.com"]);

export const DRIVE_SHARING_FIX =
  "In Drive: Share | General access | Anyone with the link | Viewer.";

export type DriveLinkStatus = "public" | "restricted" | "unverified";

export type DriveLinkCheck =
  | {
      ok: true;
      status: DriveLinkStatus;
      name: string | null;
      modifiedAt: Date | null;
      checkedAt: Date;
    }
  | { ok: false; error: string };

type ParsedLink =
  | { kind: "file"; fileId: string; resourceKey: string | null }
  | { kind: "folder" }
  | null;

/** True for any URL on a Drive or Docs host. Cheap enough for the client form. */
export function isDriveUrl(raw: string) {
  try {
    return DRIVE_HOSTS.has(new URL(raw.trim()).hostname);
  } catch {
    return false;
  }
}

export function parseDriveLink(raw: string): ParsedLink {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!DRIVE_HOSTS.has(url.hostname)) return null;

  if (/\/folders\//.test(url.pathname)) return { kind: "folder" };

  // /file/d/{id}, /presentation/d/{id}, /document/d/{id}, /spreadsheets/d/{id},
  // optionally behind a /u/0/ account segment.
  const fromPath = url.pathname.match(/\/d\/([\w-]{10,})/)?.[1];
  // /open?id={id} and /uc?id={id}
  const fileId = fromPath ?? url.searchParams.get("id");
  if (!fileId || !/^[\w-]{10,}$/.test(fileId)) return null;

  return {
    kind: "file",
    fileId,
    resourceKey: url.searchParams.get("resourcekey"),
  };
}

export async function checkDriveLink(raw: string): Promise<DriveLinkCheck> {
  const parsed = parseDriveLink(raw);
  if (!parsed) {
    return {
      ok: false,
      error:
        "That isn't a Google Drive or Slides link. Paste the deck's share link.",
    };
  }
  if (parsed.kind === "folder") {
    return {
      ok: false,
      error:
        "That is a folder link. Share the deck file itself, not its folder.",
    };
  }

  const checkedAt = new Date();
  const unverified = (reason: string, detail?: unknown) => {
    console.warn("drive link check skipped", { reason, detail });
    return {
      ok: true,
      status: "unverified",
      name: null,
      modifiedAt: null,
      checkedAt,
    } as const;
  };

  const key = process.env.GOOGLE_DRIVE_API_KEY;
  if (!key) return unverified("GOOGLE_DRIVE_API_KEY is not set");

  const url = new URL(`${API}/${encodeURIComponent(parsed.fileId)}`);
  url.searchParams.set("key", key);
  url.searchParams.set("fields", "name,mimeType,modifiedTime");
  url.searchParams.set("supportsAllDrives", "true");

  const headers: Record<string, string> = {};
  if (parsed.resourceKey) {
    headers["X-Goog-Drive-Resource-Keys"] =
      `${parsed.fileId}/${parsed.resourceKey}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    return unverified("request failed", error);
  }

  if (response.status === 404) {
    return {
      ok: true,
      status: "restricted",
      name: null,
      modifiedAt: null,
      checkedAt,
    };
  }
  if (!response.ok) {
    return unverified(`HTTP ${response.status}`, await response.text());
  }

  const file = (await response.json()) as {
    name?: string;
    mimeType?: string;
    modifiedTime?: string;
  };

  if (file.mimeType === FOLDER_MIME_TYPE) {
    return {
      ok: false,
      error:
        "That is a folder link. Share the deck file itself, not its folder.",
    };
  }
  if (!file.mimeType || !DECK_MIME_TYPES.has(file.mimeType)) {
    return {
      ok: false,
      error: `"${file.name ?? "That file"}" isn't a deck. Submit Google Slides, PowerPoint or a PDF.`,
    };
  }

  return {
    ok: true,
    status: "public",
    name: file.name?.slice(0, 255) ?? null,
    modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : null,
    checkedAt,
  };
}
