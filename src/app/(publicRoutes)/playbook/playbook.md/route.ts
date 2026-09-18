import { contentResponse } from "../_content/read-content";

export const dynamic = "force-static";

// `page.mdx` is plain GFM with no imports, exports or JSX, so the page source is
// itself the markdown mirror. There is no second copy to keep in sync.
export function GET() {
  return contentResponse("page.mdx", "text/markdown");
}
