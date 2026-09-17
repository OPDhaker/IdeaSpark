# IdeaSpark playbook

Served at `/playbook`.

- `page.tsx`: page metadata and layout.
- `_components/article.tsx`: page content (facts, schedule, rules, judging, FAQ, contact).
- `_components/`: navbar, sidebar, toolbar, table of contents, footers, theme and icons.
- `_content/playbook.md` and `_content/llms.txt`: text copies, served at `/playbook/playbook.md` and `/playbook/llms.txt`.

Home, Events, Login, Register, Resources and the track links point to repository routes; adjust their `href` values once those pages exist. The template link points to Resources until the club supplies the presentation.

Edit the event details in `_components/article.tsx` and update `_content/playbook.md` to match. Keep `TODO` values until confirmed.
