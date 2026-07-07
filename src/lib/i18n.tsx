import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import zh from "@/locales/zh-CN.json";
import en from "@/locales/en-US.json";

export type Lang = "zh" | "en";

export const LANG_OPTIONS: { code: Lang; label: string; native: string; short: string }[] = [
  { code: "zh", label: "Simplified Chinese", native: "简体中文", short: "中" },
  { code: "en", label: "English", native: "English", short: "EN" },
];

const DICTS: Record<Lang, Record<string, string>> = {
  zh: zh as Record<string, string>,
  en: en as Record<string, string>,
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: string, vars?: Record<string, string | number>) => string };
const LangCtx = createContext<Ctx>({ lang: "zh", setLang: () => {}, t: (k) => k });

function interpolate(str: string, vars?: Record<string, string | number>) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Always start with "zh" so SSR and first client render match; swap after mount.
  const [lang, setLangState] = useState<Lang>("zh");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("fastlink.lang") as Lang | null;
      if (saved && LANG_OPTIONS.some((o) => o.code === saved)) setLangState(saved);
    } catch {}
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("fastlink.lang", l);
    } catch {}
  };

  const t = (k: string, vars?: Record<string, string | number>) => {
    const value = DICTS[lang][k] ?? DICTS.en[k] ?? k;
    return interpolate(value, vars);
  };

  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  return useContext(LangCtx);
}
