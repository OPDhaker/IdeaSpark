# /playbook

The single reference page for IdeaSpark 3.0.

- **All content lives in `page.mdx`.** There is no second copy.
- **Keep `page.mdx` pure GFM markdown** — no imports, no exports, no JSX. That
  is what lets `playbook.md/route.ts` serve the file itself at
  `/playbook/playbook.md`, and what keeps the "Copy as Markdown" button honest.
  Metadata belongs in `layout.tsx`, not in a frontmatter block or an export.
- `layout.tsx` owns the metadata, the navbar/footer chrome, the grid and the
  `.typeset` wrapper. It also renders `<PlaybookActions />` **above** the
  article: the "Copy page" split button and its menu (Copy/View as Markdown,
  llms.txt, Open in ChatGPT, Open in Claude) exist so a reader can hand the page
  to a model without scrolling to the bottom first.
- `_components/toc.tsx` marks the last heading whose top has crossed a read line
  140px down the viewport, so the mark stays right inside sections taller than
  the screen. It reads the rendered DOM, so a new `##` needs no change here.
- `typeset.css` is vendored verbatim from [shadcn/typeset](https://ui.shadcn.com/docs/typeset).
  **Do not edit it.** It reads `--font-heading` and `--font-mono`, both defined
  in `src/app/globals.css`.
- Tag-level styling is configured once, globally, in `src/mdx-components.tsx`
  (links, GFM alert callouts, heading permalinks, and the `.typeset-scroll`
  wrapper that keeps wide tables scrollable). Everything else is typeset's.
- Heading `id`s come from `rehype-slug`, wired up in `next.config.ts`. The table
  of contents reads them off the rendered DOM, so adding a section needs no
  other change.

The content is derived from `public/IDEASPARK 3.docx`, the organizers' event
document. That file is what to reconcile against when the schedule, the rubric
or the prize pool changes; nothing on this page should claim anything it does
not, apart from the site facts (how registration and the roster work) and the
contact details.
