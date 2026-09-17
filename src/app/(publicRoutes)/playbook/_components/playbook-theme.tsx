"use client";

import { createContext, type ReactNode, use, useState } from "react";
import { MoonIcon, SunIcon } from "./icons";
import { InlineScript } from "./inline-script";

type Theme = "dark" | "light";

const STORAGE_KEY = "ideaspark-theme";
const ROOT_ID = "playbook";

// Dark theme by default, overridden when data-theme is light
const themeTokens = [
  "[--pb-bg:#000] [--pb-text:#f2f2f0] [--pb-muted:#99988f] [--pb-line:#383932]",
  "[--pb-panel:#10120e] [--pb-green:#496632] [--pb-link:#b0c69a] [--pb-red:#e5170f]",
  "[--pb-header-glow:rgb(112_134_105/9%)] [--pb-eyebrow:#b6b6ad] [--pb-current:#0a0c08]",
  "data-[theme=light]:[--pb-bg:#f4f2ee] data-[theme=light]:[--pb-text:#181915]",
  "data-[theme=light]:[--pb-muted:#6b6964] data-[theme=light]:[--pb-line:#d0ccc2]",
  "data-[theme=light]:[--pb-panel:#e9e6df] data-[theme=light]:[--pb-link:#3e5f37]",
  "data-[theme=light]:[--pb-header-glow:rgb(112_134_105/12%)]",
  "data-[theme=light]:[--pb-eyebrow:var(--pb-muted)] data-[theme=light]:[--pb-current:var(--pb-panel)]",
].join(" ");

const ToggleThemeContext = createContext<() => void>(() => {});

function storedTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function PlaybookTheme({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof window === "undefined" ? "dark" : storedTheme(),
  );

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  return (
    <div
      id={ROOT_ID}
      data-theme={theme}
      className={`${themeTokens} min-h-screen bg-(--pb-bg) text-[11.5px] leading-[1.7] text-(--pb-text) scheme-dark selection:bg-[#496632] selection:text-white data-[theme=light]:scheme-light max-[700px]:text-[13px] [&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-4 [&_:focus-visible]:outline-(--pb-link) [html:has(&)]:scroll-pt-[85px] [html:has(&)]:scheme-dark [html:has(&)]:motion-safe:scroll-smooth [html:has(&[data-theme=light])]:scheme-light`}
    >
      <InlineScript
        html={`try{document.getElementById("${ROOT_ID}").dataset.theme=localStorage.getItem("${STORAGE_KEY}")==="light"?"light":"dark"}catch(e){}`}
      />
      <ToggleThemeContext value={toggleTheme}>{children}</ToggleThemeContext>
    </div>
  );
}

export function ThemeToggle() {
  const toggleTheme = use(ToggleThemeContext);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="grid h-7 w-6 cursor-pointer place-items-center p-0 text-(--pb-muted)"
    >
      <SunIcon className="size-3.5 in-data-[theme=light]:hidden" />
      <MoonIcon className="hidden size-3.5 in-data-[theme=light]:block" />
      <span className="sr-only in-data-[theme=light]:hidden">
        Switch to light mode
      </span>
      <span className="sr-only hidden in-data-[theme=light]:inline">
        Switch to dark mode
      </span>
    </button>
  );
}
