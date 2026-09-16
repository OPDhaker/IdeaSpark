import { readFile } from "node:fs/promises";
import { join } from "node:path";

const contentDir = join(
  process.cwd(),
  "src",
  "app",
  "(publicRoutes)",
  "playbook",
  "_content",
);

export async function contentResponse(fileName: string, contentType: string) {
  const body = await readFile(join(contentDir, fileName), "utf8");
  return new Response(body, {
    headers: { "Content-Type": `${contentType}; charset=utf-8` },
  });
}
