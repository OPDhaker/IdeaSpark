"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowIcon, BookIcon, FileIcon, GridIcon, MenuIcon } from "./icons";
import { InlineScript } from "./inline-script";

const MENU_ID = "playbook-menu";
const MOBILE_QUERY = "(width < 700px)";

const pageLinkClass =
  "flex items-center gap-2.5 px-3 py-[7px] text-[11px] text-(--pb-muted) hover:text-(--pb-text) aria-[current=page]:bg-[linear-gradient(90deg,var(--pb-current),transparent)] aria-[current=page]:font-bold aria-[current=page]:text-(--pb-text) max-[700px]:text-[12px]";

const tracks = [1, 2, 3, 4];

export function PlaybookSidebar() {
  const [open, setOpen] = useState(
    () => typeof window === "undefined" || !matchMedia(MOBILE_QUERY).matches,
  );

  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const menu = menuRef.current;
    const mobile = matchMedia(MOBILE_QUERY);
    const update = () => setOpen(!mobile.matches);
    function closeOnLinkClick(event: MouseEvent) {
      if (mobile.matches && (event.target as Element).closest("a")) {
        setOpen(false);
      }
    }

    mobile.addEventListener("change", update);
    menu?.addEventListener("click", closeOnLinkClick);
    return () => {
      mobile.removeEventListener("change", update);
      menu?.removeEventListener("click", closeOnLinkClick);
    };
  }, []);

  return (
    <aside
      aria-label="Playbook navigation"
      className="sticky top-[100px] self-start max-[700px]:static max-[700px]:mb-6"
    >
      <details
        ref={menuRef}
        id={MENU_ID}
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
        className="max-[700px]:rounded-md max-[700px]:border max-[700px]:border-(--pb-line)"
      >
        <summary className="hidden cursor-pointer list-none max-[700px]:flex max-[700px]:items-center max-[700px]:gap-2.5 max-[700px]:px-3 max-[700px]:py-2.5 max-[700px]:text-[12px] [&::-webkit-details-marker]:hidden">
          <MenuIcon /> Playbook menu
        </summary>
        <div className="max-[700px]:p-3">
          <div className="mx-3 mt-[7px] mb-[23px] flex items-center justify-between text-[9px] font-bold tracking-[1.4px] max-[700px]:mb-3.5">
            <span>Playbook</span>
            <span className="font-mono text-[8px] leading-[1.7] tracking-normal text-(--pb-muted)">
              IS / 3.0
            </span>
          </div>
          <nav aria-label="Playbook pages">
            <a href="#overview" aria-current="page" className={pageLinkClass}>
              <BookIcon />
              Overview
            </a>
            <Link href="/event-details/resources" className={pageLinkClass}>
              <FileIcon />
              Resources
            </Link>
            <Link href="/event-details/tracks" className={pageLinkClass}>
              <GridIcon />
              Tracks
            </Link>
            <div className="mt-[3px] ml-[18px] border-l border-(--pb-line)">
              {tracks.map((track) => (
                <Link
                  key={track}
                  href={`/event-details/tracks/track-${track}`}
                  className="flex items-center gap-2.5 px-3 py-[7px] text-[10px] text-(--pb-muted) hover:text-(--pb-text) max-[700px]:text-[12px]"
                >
                  <span className="font-mono text-[8px] leading-[1.7]">
                    {String(track).padStart(2, "0")}
                  </span>
                  Track {track}
                </Link>
              ))}
            </div>
          </nav>
          <div className="mt-6 border-t border-(--pb-line) pt-[17px] max-[700px]:mt-4">
            <Link
              href="/register"
              className="flex items-center justify-between gap-2 rounded-[4px] bg-(--pb-green) px-3 py-[7px] text-[10px] font-semibold text-white hover:bg-[#56763d] max-[700px]:text-[12px]"
            >
              Register for IdeaSpark <ArrowIcon />
            </Link>
            <p className="mt-[9px] text-[9px] leading-[1.8] text-(--pb-muted)">
              Two days. One idea.
              <br />A place to start something.
            </p>
          </div>
        </div>
      </details>
      <InlineScript
        html={`if(matchMedia("${MOBILE_QUERY}").matches)document.getElementById("${MENU_ID}").open=false`}
      />
    </aside>
  );
}
