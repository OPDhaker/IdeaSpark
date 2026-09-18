# /playbook

The single reference page for IdeaSpark 3.0.

- **All content lives in `page.mdx`.** There is no second copy.
- **Keep `page.mdx` pure GFM markdown** — no imports, no exports, no JSX. That
  is what lets `playbook.md/route.ts` serve the file itself at
  `/playbook/playbook.md`, and what keeps the "Copy as Markdown" button honest.
  Metadata belongs in `layout.tsx`, not in a frontmatter block or an export.
- `layout.tsx` owns the metadata, the navbar/footer chrome, the grid and the
  `.typeset` wrapper.
- `typeset.css` is vendored verbatim from [shadcn/typeset](https://ui.shadcn.com/docs/typeset).
  **Do not edit it.** It reads `--font-heading` and `--font-mono`, both defined
  in `src/app/globals.css`.
- Tag-level styling is configured once, globally, in `src/mdx-components.tsx`
  (links, GFM alert callouts, heading permalinks). Everything else is typeset's.
- Heading `id`s come from `rehype-slug`, wired up in `next.config.ts`. The table
  of contents reads them off the rendered DOM, so adding a section needs no
  other change.

Values still marked `TODO` in `page.mdx`: venue, registration close date, all
schedule times, eligibility, originality/AI policy, pitch time limit, code of
conduct, judging weights, prizes, two FAQ answers, and coordinator contacts.
