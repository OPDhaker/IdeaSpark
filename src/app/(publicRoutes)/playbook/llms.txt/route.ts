import { contentResponse } from "../_content/read-content";

export const dynamic = "force-static";

export function GET() {
  return contentResponse("_content/llms.txt", "text/plain");
}
