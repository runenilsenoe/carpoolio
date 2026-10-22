import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Moon, Sun } from "lucide-react";
import { translate, type Language } from "@/lib/translations";

const STORAGE_KEY = "carpoolio-preferences";
const PreferencesContext = createContext<{
  language: Language;
  dark: boolean;
  setLanguage: (language: Language) => void;
  setDark: (dark: boolean) => void;
}>({
  language: "en" as Language,
  dark: false,
  setLanguage: () => {},
  setDark: () => {},
});

// Apply a saved theme before first paint. New visitors always start in light mode.
export const preferencesScript = `try{const p=JSON.parse(localStorage.getItem('${STORAGE_KEY}')||'{}');document.documentElement.classList.toggle('dark',p.dark===true);document.documentElement.lang=p.language==='nb'?'nb':'en'}catch{}`;

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      setLanguage(saved.language === "nb" ? "nb" : "en");
      setDark(saved.dark === true);
    } catch {
      /* Storage may be blocked. Controls still work for this visit. */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = language;
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ language, dark }));
    } catch {
      /* Optional persistence. */
    }
  }, [language, dark, ready]);
  const value = useMemo(
    () => ({ language, dark, setLanguage, setDark }),
    [language, dark],
  );
  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const preferences = useContext(PreferencesContext);
  const t = useMemo(
    () => (text: string, values?: unknown[]) =>
      translate(preferences.language, text, values),
    [preferences.language],
  );
  return { ...preferences, t };
}

export function PreferenceControls() {
  const { language, dark, setLanguage, setDark, t } = usePreferences();
  return (
    <nav
      aria-label={t("Appearance and language")}
      className="mx-auto flex h-16 max-w-md items-center justify-end gap-3 px-6"
    >
      <div
        className="flex rounded-full border border-border p-1"
        role="group"
        aria-label="Language / Språk"
      >
        {(["nb", "en"] as const).map((locale) => (
          <button
            key={locale}
            type="button"
            lang={locale}
            aria-label={locale === "nb" ? "Norsk" : "English"}
            aria-pressed={language === locale}
            onClick={() => setLanguage(locale)}
            className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${language === locale ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {locale === "nb" ? "NO" : "EN"}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label={t("Dark mode")}
        title={t(dark ? "Light mode" : "Dark mode")}
        aria-pressed={dark}
        onClick={() => setDark(!dark)}
        className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {dark ? (
          <Sun className="size-4" aria-hidden />
        ) : (
          <Moon className="size-4" aria-hidden />
        )}
      </button>
    </nav>
  );
}
