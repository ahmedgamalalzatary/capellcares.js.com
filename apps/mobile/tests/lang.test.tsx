import React from "react";
import { Text } from "react-native";
import { render, waitFor } from "@testing-library/react-native";
import { LangProvider, useLang } from "../src/lib/lang";

function Probe() {
  const { lang, dict } = useLang();
  return <Text>{`${lang}:${dict.brand}`}</Text>;
}

describe("LangProvider", () => {
  it("defaults to Arabic and exposes the shared dictionary", async () => {
    const { getByText } = render(
      <LangProvider>
        <Probe />
      </LangProvider>
    );

    await waitFor(() => expect(getByText("ar:كابيلا كير")).toBeTruthy());
  });
});
