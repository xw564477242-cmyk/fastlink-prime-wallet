import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "zh" | "zh-TW";

export const LANG_OPTIONS: { code: Lang; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "zh", label: "Simplified Chinese", native: "简体中文" },
  { code: "zh-TW", label: "Traditional Chinese", native: "繁體中文" },
];

type Dict = Record<string, { en: string; zh: string; "zh-TW": string }>;

const DICT: Dict = {
  // Nav
  "nav.home": { en: "Home", zh: "首页", "zh-TW": "首頁" },
  "nav.assets": { en: "Assets", zh: "资产", "zh-TW": "資產" },
  "nav.convert": { en: "Convert", zh: "兑换", "zh-TW": "兌換" },
  "nav.pay": { en: "Pay", zh: "支付", "zh-TW": "支付" },
  "nav.cards": { en: "Cards", zh: "卡片", "zh-TW": "卡片" },
  "nav.profile": { en: "Profile", zh: "我的", "zh-TW": "我的" },
  // Home
  "home.welcome": { en: "Welcome back", zh: "欢迎回来", "zh-TW": "歡迎回來" },
  "home.totalBalance": { en: "Total Balance", zh: "总资产", "zh-TW": "總資產" },
  "home.digital": { en: "Digital", zh: "数字资产", "zh-TW": "數字資產" },
  "home.fiat": { en: "Fiat", zh: "法币", "zh-TW": "法幣" },
  "home.card": { en: "Card", zh: "卡片", "zh-TW": "卡片" },
  "home.deposit": { en: "Deposit", zh: "充值", "zh-TW": "充值" },
  "home.withdraw": { en: "Withdraw", zh: "提现", "zh-TW": "提現" },
  "home.convert": { en: "Convert", zh: "兑换", "zh-TW": "兌換" },
  "home.pay": { en: "Pay", zh: "支付", "zh-TW": "支付" },
  "home.transfer": { en: "Transfer", zh: "转账", "zh-TW": "轉帳" },
  "home.cards": { en: "Cards", zh: "卡片", "zh-TW": "卡片" },
  "home.cardBalanceSummary": { en: "Card Balance Summary", zh: "卡片余额汇总", "zh-TW": "卡片餘額匯總" },
  "home.manage": { en: "Manage", zh: "管理", "zh-TW": "管理" },
  "home.recent": { en: "Recent Activity", zh: "最近交易", "zh-TW": "最近交易" },
  "home.seeAll": { en: "See all", zh: "查看全部", "zh-TW": "查看全部" },
  // Profile
  "profile.title": { en: "Profile", zh: "我的", "zh-TW": "我的" },
  "profile.language": { en: "Language", zh: "语言", "zh-TW": "語言" },
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: keyof typeof DICT | string) => string };
const LangCtx = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (k) => String(k) });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("fastlink.lang")) as Lang | null;
    if (saved && LANG_OPTIONS.some((o) => o.code === saved)) setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("fastlink.lang", l);
    } catch {}
  };

  const t = (k: string) => {
    const entry = DICT[k];
    if (!entry) return k;
    return entry[lang] ?? entry.en;
  };

  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  return useContext(LangCtx);
}
