import { Text, type TextProps } from "react-native";
import { useLang } from "@/lib/lang";
import { colors, fonts } from "@/theme";
export function UiText({ style, weight = "regular", ...props }: TextProps & { weight?: "regular" | "medium" | "bold" }) {
  const { lang } = useLang();
  return <Text {...props} style={[{ color: colors.ink2, fontFamily: fonts[lang][weight], fontSize: 16,
    textAlign: lang === "ar" ? "right" : "left", writingDirection: lang === "ar" ? "rtl" : "ltr" }, style]} />;
}
