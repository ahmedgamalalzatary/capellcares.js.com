const { existsSync } = require("node:fs");
const path = require("node:path");
const { StyleSheet } = require("react-native");
const { fireEvent, render } = require("@testing-library/react-native");

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children, ...props }) =>
      React.createElement(View, { ...props, testID: "home-safe-area" }, children)
  };
});

const mockSetLang = jest.fn().mockResolvedValue(undefined);
const mockFetchProducts = jest.fn().mockResolvedValue([
  { id: 1, name: { ar: "Arabic serum", en: "English serum" } }
]);
jest.mock("../src/lib/lang", () => ({
  useLang: () => ({
    dict: {
      brand: "Capella Arabic brand",
      common: { loading: "Loading" },
      langSwitch: { ar: "العربية", en: "English" }
    },
    lang: "ar",
    setLang: mockSetLang
  })
}));
jest.mock("../src/lib/api/client", () => ({
  fetchProducts: (...args) => mockFetchProducts(...args)
}));

describe("Expo Router scaffold", () => {
  test.each(["_layout.tsx", "index.tsx"])("provides app/%s", (route) => {
    expect(existsSync(path.resolve(__dirname, "../app", route))).toBe(true);
  });

  test("renders the active dictionary with its language font", async () => {
    const HomeScreen = require("../app/index").default;

    const view = await render(<HomeScreen />);

    expect(view.getByText("Capella Arabic brand").props.style).toEqual(
      expect.objectContaining({ fontFamily: "Tajawal_700Bold" })
    );
  });

  test("keeps home content inside the device safe area", async () => {
    const HomeScreen = require("../app/index").default;

    const view = await render(<HomeScreen />);

    expect(view.getByTestId("home-safe-area")).toBeTruthy();
  });

  test("provides temporary controls for device RTL acceptance", async () => {
    const HomeScreen = require("../app/index").default;
    const view = await render(<HomeScreen />);

    fireEvent.press(view.getByRole("button", { name: "English" }));

    expect(mockSetLang).toHaveBeenCalledWith("en");
    expect(view.getByRole("button", { name: "العربية" })).toBeTruthy();
  });

  test("gives language controls an accessible touch target", async () => {
    const HomeScreen = require("../app/index").default;
    const view = await render(<HomeScreen />);
    const englishButton = view.getByRole("button", { name: "English" });

    expect(StyleSheet.flatten(englishButton.props.style)).toEqual(
      expect.objectContaining({ minHeight: 48 })
    );
  });

  test("lists products returned by the Phase 3 API client", async () => {
    const HomeScreen = require("../app/index").default;
    const view = await render(<HomeScreen />);

    expect(await view.findByText("Arabic serum")).toBeTruthy();
    expect(mockFetchProducts).toHaveBeenCalledWith({
      lang: "ar",
      throwOnError: true
    });
  });
});
