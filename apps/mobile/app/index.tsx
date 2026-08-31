import { Text, View } from "react-native";
import { getDict } from "@capella/shared/i18n";

export default function Index() {
  const brand = getDict("ar").brand;

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f1f0ed" }}>
      <Text>{brand}</Text>
    </View>
  );
}
