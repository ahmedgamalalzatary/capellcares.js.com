import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { pickLang, type Product } from "@capella/shared";
import { fetchProducts } from "@/lib/api/client";
import { useLang } from "@/lib/lang";
import { colors, fonts, radii, spacing } from "@/theme";

export default function HomeScreen() {
  const { dict, lang, setLang } = useLang();
  const [productState, setProductState] = useState<{
    lang: typeof lang;
    products: Product[];
    error: string | null;
    loaded: boolean;
  }>({ lang, products: [], error: null, loaded: false });

  useEffect(() => {
    let active = true;
    fetchProducts({ lang, throwOnError: true })
      .then((items) => {
        if (active) {
          setProductState({ lang, products: items, error: null, loaded: true });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setProductState({
            lang,
            products: [],
            error: error instanceof Error ? error.message : "Unable to load products",
            loaded: true
          });
        }
      });

    return () => {
      active = false;
    };
  }, [lang]);

  const loadingProducts = productState.lang !== lang || !productState.loaded;

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={{ ...styles.brand, fontFamily: fonts[lang].bold }}>{dict.brand}</Text>
      <View style={styles.languageRow}>
        {(["ar", "en"] as const).map((language) => (
          <TouchableOpacity
            key={language}
            accessibilityRole="button"
            accessibilityLabel={dict.langSwitch[language]}
            accessibilityState={{ selected: lang === language }}
            activeOpacity={0.72}
            onPress={() => void setLang(language)}
            style={[
              styles.languageButton,
              lang === language && styles.languageButtonSelected
            ]}
          >
            <Text
              style={{
                ...styles.languageLabel,
                color: lang === language ? colors.canvas : colors.ink,
                fontFamily: fonts[language].medium
              }}
            >
              {dict.langSwitch[language]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {loadingProducts ? (
        <Text style={{ ...styles.status, fontFamily: fonts[lang].regular }}>
          {dict.common.loading}
        </Text>
      ) : productState.error ? (
        <Text
          accessibilityRole="alert"
          style={{ ...styles.error, fontFamily: fonts[lang].regular }}
        >
          {productState.error}
        </Text>
      ) : (
        <ScrollView contentContainerStyle={styles.productList} style={styles.products}>
          {productState.products.map((product) => (
            <Text
              key={product.id}
              style={{ ...styles.productName, fontFamily: fonts[lang].regular }}
            >
              {pickLang(product.name, lang)}
            </Text>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    flex: 1,
    gap: spacing.xlarge,
    justifyContent: "center",
    padding: spacing.xlarge
  },
  brand: {
    color: colors.ink,
    fontSize: 30
  },
  languageRow: {
    flexDirection: "row",
    gap: spacing.small
  },
  languageButton: {
    borderColor: colors.hairline,
    borderRadius: radii.medium,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 96,
    paddingHorizontal: spacing.large,
    paddingVertical: spacing.medium
  },
  languageButtonSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  languageLabel: {
    fontSize: 16,
    textAlign: "center"
  },
  products: {
    maxHeight: 240,
    width: "100%"
  },
  productList: {
    gap: spacing.small
  },
  productName: {
    color: colors.ink2,
    fontSize: 16,
    textAlign: "center"
  },
  status: {
    color: colors.ink3,
    fontSize: 15
  },
  error: {
    color: colors.error,
    fontSize: 15,
    textAlign: "center"
  }
});
