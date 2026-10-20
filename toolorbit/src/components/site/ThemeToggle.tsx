"use client";

import { useEffect, useState } from "react";
import { Laptop, Moon, Sun } from "lucide-react";

type Mode = "light" | "dark" | "system";

function apply(mode: Mode) {
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => {
    let saved: Mode = "system";
    try {
      saved = (localStorage.getItem("theme") as Mode) || "system";
    } catch {
      /* storage blocked */
    }
    setMode(saved);
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      let current: Mode = "system";
      try {
        current = (localStorage.getItem("theme") as Mode) || "system";
      } catch {
        /* ignore */
      }
      if (current === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const next: Record<Mode, Mode> = { light: "dark", dark: "system", system: "light" };
  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Laptop;
  return (
    <button
      type="button"
      className="btn btn-ghost !p-2"
      aria-label={`Theme: ${mode}. Switch to ${next[mode]}`}
      title={`Theme: ${mode}`}
      onClick={() => {
        const m = next[mode];
        setMode(m);
        try {
          localStorage.setItem("theme", m);
        } catch {
          /* ignore */
        }
        apply(m);
      }}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}

/** Inline script that applies the theme before first paint (prevents a flash). */
export const THEME_SCRIPT = `(function(){try{var m=localStorage.getItem('theme')||'system';var d=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})();`;
