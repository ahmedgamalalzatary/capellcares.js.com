import { useMemo, type ReactNode } from "react";
import { PaperProvider } from "react-native-paper";
import { useLang } from "@/lib/lang";
import { paperTheme } from "./paper-theme";
export function UiProvider({ children }: { children: ReactNode }) {
  const { lang } = useLang(); const theme = useMemo(() => paperTheme(lang), [lang]);
  return <PaperProvider theme={theme}>{children}</PaperProvider>;
}
