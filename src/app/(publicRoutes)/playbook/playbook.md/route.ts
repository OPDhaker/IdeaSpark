import { contentResponse } from "../_content/read-content";

export const dynamic = "force-static";

export function GET() {
  return contentResponse("playbook.md", "text/markdown");
}
