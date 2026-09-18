import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Both callers are `force-static`, so these reads happen at build time, where
// `process.cwd()` is the repo root.
const routeDir = join(
  process.cwd(),
  "src",
  "app",
  "(publicRoutes)",
  "playbook",
);

export async function contentResponse(
  relativePath: string,
  contentType: string,
) {
  const body = await readFile(join(routeDir, relativePath), "utf8");
  return new Response(body, {
    headers: { "Content-Type": `${contentType}; charset=utf-8` },
  });
}
