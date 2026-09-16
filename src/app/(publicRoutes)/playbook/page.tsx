import type { Metadata } from "next";
import { PlaybookArticle } from "./_components/article";
import { PageFooter, SiteFooter } from "./_components/footers";
import { PlaybookNavbar } from "./_components/navbar";
import { PlaybookTheme } from "./_components/playbook-theme";
import { PlaybookSidebar } from "./_components/sidebar";
import { TableOfContents } from "./_components/table-of-contents";
import { PlaybookToolbar } from "./_components/toolbar";

export const metadata: Metadata = {
  title: "Playbook · IdeaSpark 3.0",
  description:
    "The IdeaSpark 3.0 playbook: dates, schedule, rules, judging and FAQ.",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23e5170f' d='M14 1 4 14h7l-1 9L21 9h-8z'/%3E%3C/svg%3E",
  },
};

export default function PlaybookPage() {
  return (
    <PlaybookTheme>
      <a
        href="#content"
        className="fixed top-2 left-4 z-30 -translate-y-[160%] border border-(--pb-line) bg-(--pb-bg) px-3 py-2 focus:translate-y-0"
      >
        Skip to content
      </a>

      <PlaybookNavbar />

      <div
        id="overview"
        className="mx-auto grid w-[min(992px,calc(100%_-_48px))] grid-cols-[186px_minmax(0,546px)_182px] gap-x-[38px] pt-24 max-[1050px]:max-w-[800px] max-[1050px]:grid-cols-[170px_minmax(0,546px)] max-[1050px]:justify-center max-[1050px]:gap-x-[30px] max-[700px]:block max-[700px]:w-[calc(100%_-_40px)] max-[700px]:pt-[86px]"
      >
        <PlaybookSidebar />

        <main id="content" className="min-w-0">
          <PlaybookToolbar />
          <PlaybookArticle />
          <PageFooter />
        </main>

        <aside
          aria-label="On this page"
          className="sticky top-[100px] self-start pt-2.5 max-[1050px]:hidden"
        >
          <TableOfContents />
          <p
            lang="ja"
            className="mt-8 ml-2.5 text-[10px] leading-[1.7] tracking-[4px] text-(--pb-muted) [writing-mode:vertical-rl]"
          >
            <span aria-hidden="true">決意し、火をつけ、導く。</span>
            <span lang="en" className="sr-only">
              Resolve, ignite, lead.
            </span>
          </p>
          <span
            aria-hidden="true"
            className="mt-[26px] ml-[11px] block h-5 w-1 bg-(--pb-red)"
          />
        </aside>

        <SiteFooter />
      </div>
    </PlaybookTheme>
  );
}
