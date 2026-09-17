import Link from "next/link";
import { BoltIcon } from "./icons";

const linkClass = "hover:text-(--pb-text) aria-[current=page]:text-(--pb-text)";

export function PlaybookNavbar() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-10 h-[70px] bg-[linear-gradient(var(--pb-bg),var(--pb-header-glow)_65%,transparent)]">
      <nav
        aria-label="Main navigation"
        className="pointer-events-auto mx-auto mt-3 flex h-11 w-[min(466px,calc(100%_-_32px))] items-center gap-[18px] rounded-[30px] border border-[#424538] bg-(--pb-bg) p-[5px] shadow-[0_0_0_1px_rgb(144_147_126/8%)] max-[700px]:gap-3 max-[380px]:gap-[9px]"
      >
        <Link
          href="/"
          className="mr-auto flex items-center gap-[3px] pl-2 text-[16px] font-extrabold tracking-[-0.7px] max-[700px]:text-[15px]"
        >
          <BoltIcon className="h-[22px] w-[18px] text-(--pb-red)" />
          IdeaSpark
        </Link>
        <div className="flex gap-6 text-[10px] text-(--pb-muted) max-[700px]:gap-[15px] max-[380px]:gap-3 max-[380px]:text-[9px]">
          <Link href="/" className={linkClass}>
            Home
          </Link>
          <a href="#overview" aria-current="page" className={linkClass}>
            Playbook
          </a>
          <Link href="/events" className={linkClass}>
            Events
          </Link>
        </div>
        <Link
          href="/login"
          className="rounded-[22px] bg-(--pb-green) px-[15px] py-1.5 text-[10px] font-semibold whitespace-nowrap text-white hover:bg-[#56763d] max-[380px]:px-[11px] max-[380px]:text-[9px]"
        >
          Login <span aria-hidden="true">↗</span>
        </Link>
      </nav>
    </header>
  );
}
