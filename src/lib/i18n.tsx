import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

export type Lang = "zh" | "en";

export const LANG_OPTIONS: { code: Lang; label: string; native: string }[] = [
  { code: "zh", label: "Simplified Chinese", native: "简体中文" },
  { code: "en", label: "English", native: "English" },
];

const STORAGE_KEY = "fastlink.lang";
const DEFAULT_LANG: Lang = "zh";

type Entry = { en: string; zh: string };
type Dict = Record<string, Entry>;

const DICT: Dict = {
  // Nav
  "nav.home": { en: "Home", zh: "首页" },
  "nav.assets": { en: "Assets", zh: "资产" },
  "nav.convert": { en: "Convert", zh: "兑换" },
  "nav.pay": { en: "Pay", zh: "支付" },
  "nav.cards": { en: "Cards", zh: "卡片" },
  "nav.profile": { en: "Profile", zh: "我的" },

  // Common
  "common.back": { en: "Back", zh: "返回" },
  "common.next": { en: "Next", zh: "下一步" },
  "common.confirm": { en: "Confirm", zh: "确认" },
  "common.cancel": { en: "Cancel", zh: "取消" },
  "common.done": { en: "Done", zh: "完成" },
  "common.continue": { en: "Continue", zh: "继续" },
  "common.pending": { en: "Processing…", zh: "处理中…" },
  "common.success": { en: "Success", zh: "成功" },
  "common.seeAll": { en: "See all", zh: "查看全部" },
  "common.manage": { en: "Manage", zh: "管理" },
  "common.available": { en: "Available", zh: "可用余额" },
  "common.amount": { en: "Amount", zh: "金额" },
  "common.total": { en: "Total", zh: "合计" },

  // Home
  "home.welcome": { en: "Welcome back", zh: "欢迎回来" },
  "home.totalBalance": { en: "Total Balance", zh: "总资产" },
  "home.digital": { en: "Digital", zh: "数字资产" },
  "home.fiat": { en: "Fiat", zh: "法币" },
  "home.card": { en: "Card", zh: "卡片" },
  "home.deposit": { en: "Deposit", zh: "充值" },
  "home.withdraw": { en: "Withdraw", zh: "提现" },
  "home.convert": { en: "Convert", zh: "兑换" },
  "home.pay": { en: "Pay", zh: "支付" },
  "home.transfer": { en: "Transfer", zh: "转账" },
  "home.cards": { en: "Cards", zh: "卡片" },
  "home.cardBalanceSummary": { en: "Card Balance Summary", zh: "卡片余额汇总" },
  "home.manage": { en: "Manage", zh: "管理" },
  "home.recent": { en: "Recent Activity", zh: "最近交易" },
  "home.seeAll": { en: "See all", zh: "查看全部" },

  // Assets
  "assets.digital.title": { en: "Digital Assets", zh: "数字资产" },
  "assets.fiat.title": { en: "Fiat Wallet", zh: "法币钱包" },
  "assets.cards.title": { en: "Card Accounts", zh: "卡片账户" },

  // Actions/pages titles
  "page.deposit": { en: "Deposit", zh: "充值" },
  "page.withdraw": { en: "Withdraw", zh: "提现" },
  "page.convert": { en: "Convert", zh: "兑换" },
  "page.transfer": { en: "Transfer", zh: "转账" },
  "page.pay": { en: "Pay", zh: "支付" },
  "page.cards": { en: "Cards", zh: "卡片" },
  "page.history": { en: "History", zh: "交易记录" },
  "page.kyc": { en: "Identity Verification", zh: "身份认证" },

  // Profile
  "profile.title": { en: "Profile", zh: "我的" },
  "profile.language": { en: "Language", zh: "语言" },
  "profile.logout": { en: "Log Out", zh: "退出登录" },
  "profile.security": { en: "Security", zh: "安全" },
  "profile.account": { en: "Account", zh: "账户" },
  "profile.preferences": { en: "Preferences", zh: "偏好设置" },
  "profile.help": { en: "Help", zh: "帮助" },

  // Empty / states
  "empty.noData": { en: "No data yet", zh: "暂无数据" },
  "error.generic": { en: "Something went wrong", zh: "出错了，请重试" },
};

// External store makes SSR and first client render match, then re-renders after mount.
function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener("storage", handler);
  window.addEventListener("fastlink:lang", cb as EventListener);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("fastlink:lang", cb as EventListener);
  };
}

function getSnapshot(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "en" || v === "zh") return v;
  } catch {}
  return DEFAULT_LANG;
}

function getServerSnapshot(): Lang {
  return DEFAULT_LANG;
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string };
const LangCtx = createContext<Ctx>({ lang: DEFAULT_LANG, setLang: () => {}, t: (k) => k });

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Hydration-safe: server and first client render both return DEFAULT_LANG.
  // After mount, the store re-reads localStorage and triggers a re-render.
  const [hydrated, setHydrated] = useState(false);
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => setHydrated(true), []);
  const lang: Lang = hydrated ? stored : DEFAULT_LANG;

  const setLang = (l: Lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, l);
      window.dispatchEvent(new Event("fastlink:lang"));
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
