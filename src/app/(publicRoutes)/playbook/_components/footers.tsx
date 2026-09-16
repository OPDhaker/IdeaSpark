export function PageFooter() {
  return (
    <footer className="mt-[26px] flex justify-between gap-3 text-[8px] text-(--pb-muted) max-[700px]:flex-wrap max-[700px]:text-[9px]">
      <p>
        Last updated <time dateTime="2026-09-15">15 September 2026</time>
      </p>
      <p>
        <a
          href="/playbook/playbook.md"
          download="ideaspark-playbook.md"
          className="underline underline-offset-2"
        >
          Full playbook .md
        </a>{" "}
        /{" "}
        <a href="/playbook/llms.txt" className="underline underline-offset-2">
          llms.txt
        </a>
      </p>
    </footer>
  );
}

export function SiteFooter() {
  return (
    <footer className="col-span-full mt-14 flex justify-between gap-4 border-t border-(--pb-line) pt-[18px] pb-[25px] text-[8px] text-(--pb-muted) max-[700px]:mt-10 max-[700px]:flex-col max-[700px]:gap-1.5 max-[700px]:text-[9px]">
      <p>
        <strong className="text-(--pb-text)">IdeaSpark 3.0</strong> / Futurix
        Technical Club
      </p>
      <p className="text-[7px] tracking-[1px] uppercase">
        Resolve. Ignite. Lead.
      </p>
    </footer>
  );
}
