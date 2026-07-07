import { Globe } from "lucide-react";
import { useLang, LANG_OPTIONS, type Lang } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";

export function LanguageSwitcher({ compact = true }: { compact?: boolean }) {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANG_OPTIONS.find((o) => o.code === lang) ?? LANG_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Language"
        translate="no"
        className="flex h-11 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-semibold"
      >
        <Globe className="h-4 w-4" />
        <span translate="no">{compact ? current.short : current.native}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-44 overflow-hidden rounded-2xl border border-border/60 bg-surface/95 shadow-card backdrop-blur-xl">
          {LANG_OPTIONS.map((opt) => {
            const on = opt.code === lang;
            return (
              <button
                key={opt.code}
                onClick={() => {
                  setLang(opt.code as Lang);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                  on ? "bg-primary/10 text-primary" : "text-foreground active:bg-muted/40"
                }`}
              >
                <span className="font-medium">{opt.native}</span>
                {on && <span className="text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
