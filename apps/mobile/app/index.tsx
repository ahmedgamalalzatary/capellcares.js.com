import { getDict } from "@capella/shared";
import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.brand}>{getDict("ar").brand}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    backgroundColor: "#f1f0ed",
    flex: 1,
    justifyContent: "center"
  },
  brand: {
    color: "#0e0d0b",
    fontSize: 30,
    fontWeight: "700"
  }
});
