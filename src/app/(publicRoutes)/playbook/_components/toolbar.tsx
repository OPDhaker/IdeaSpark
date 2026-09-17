import { PageActions } from "./page-actions";
import { ThemeToggle } from "./playbook-theme";

export function PlaybookToolbar() {
  return (
    <div className="flex min-h-7 items-center justify-between gap-3 text-[9px] max-[700px]:text-[10px] max-[380px]:gap-2">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap gap-[7px] text-(--pb-muted)"
      >
        <a href="#overview">Playbook</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="text-(--pb-text)">
          Overview
        </span>
      </nav>
      <div className="flex flex-none items-center gap-3 max-[700px]:gap-1.5">
        <ThemeToggle />
        <PageActions />
      </div>
    </div>
  );
}
