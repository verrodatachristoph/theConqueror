"use client";

import { useSyncExternalStore } from "react";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

function SunIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function readIsDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

function subscribeToHtmlClass(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

/**
 * Light/dark toggle switch. The <html class="dark"> is server-rendered from a
 * cookie, so first paint is correct. After mount we read that class, then flip
 * it instantly on toggle and persist a cookie.
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  // The server can't know the class, so it (and the first hydration pass) renders "light".
  const isDark = useSyncExternalStore(subscribeToHtmlClass, readIsDark, () => false);

  function toggle() {
    const next: Theme = isDark ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    document.cookie = `${THEME_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
  }

  const on = isDark;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? "Switch to light mode" : "Switch to dark mode"}
      title={on ? "Light mode" : "Dark mode"}
      onClick={toggle}
      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-line bg-surface-2 transition-colors ${className}`}
    >
      <SunIcon className="pointer-events-none absolute left-2 h-4 w-4 text-muted" />
      <MoonIcon className="pointer-events-none absolute right-2 h-4 w-4 text-muted" />
      <span
        className={`pointer-events-none relative z-10 inline-flex h-[26px] w-[26px] items-center justify-center rounded-full bg-surface text-accent shadow transition-transform duration-200 ${
          on ? "translate-x-[28px]" : "translate-x-[2px]"
        }`}
      >
        {on ? <MoonIcon className="h-3.5 w-3.5" /> : <SunIcon className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}
