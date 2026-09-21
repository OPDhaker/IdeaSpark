/** The prompt and the provider deep links behind every "Ask AI" control.
 *
 * `/playbook/playbook.md` serves `page.mdx` verbatim as static Markdown, so the
 * prompt hands a model that one URL rather than restating the event in the
 * query string: the answer stays correct when the playbook changes, and the
 * link never grows long enough for a provider to truncate it. */

export const PLAYBOOK_MARKDOWN_PATH = "/playbook/playbook.md";

// `metadataBase` in `src/app/layout.tsx`. Only a fallback until the client
// reads the real origin, so a link built on localhost still points somewhere.
export const SITE_URL = "https://ideaspark.thefoundersclub.tech";

export function askAiPrompt(origin: string) {
  return `I'm looking at IdeaSpark 3.0, a two-day ideathon run by the Founders Club at SRM Institute of Science and Technology. Read ${origin}${PLAYBOOK_MARKDOWN_PATH} and answer my questions from it — who can enter, the tracks, team size, the two-day schedule, the fee, and how judging is scored. Start with a five-bullet summary of the event, then ask me what I'd like to know.`;
}

export type AiProviderId = "claude" | "chatgpt" | "grok" | "perplexity";

type AiProvider = {
  id: AiProviderId;
  name: string;
  /** Takes the already-encoded prompt. */
  url: (encoded: string) => string;
};

/** Every provider here must accept a prefilled query param. Gemini is absent
 * for that reason — it has none, so its row would be the only dead one. */
const AI_PROVIDERS: AiProvider[] = [
  { id: "claude", name: "Claude", url: (q) => `https://claude.ai/new?q=${q}` },
  {
    id: "chatgpt",
    name: "ChatGPT",
    url: (q) => `https://chatgpt.com/?hints=search&q=${q}`,
  },
  { id: "grok", name: "Grok", url: (q) => `https://grok.com/?q=${q}` },
  {
    id: "perplexity",
    name: "Perplexity",
    url: (q) => `https://www.perplexity.ai/search?q=${q}`,
  },
];

export type AskAiLink = { id: AiProviderId; name: string; href: string };

export function askAiLinks(origin: string): AskAiLink[] {
  const encoded = encodeURIComponent(askAiPrompt(origin));
  return AI_PROVIDERS.map(({ id, name, url }) => ({
    id,
    name,
    href: url(encoded),
  }));
}
