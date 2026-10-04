const { StyleSheet } = require("react-native");
const { act, fireEvent, render } = require("@testing-library/react-native");

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

async function renderHomeScreen() {
  const HomeScreen = require("../app/index").default;
  const view = render(<HomeScreen />);
  await act(async () => {});
  return view;
}

describe("Expo Router scaffold", () => {
  test("renders the active dictionary with its language font", async () => {
    const view = await renderHomeScreen();

    expect(view.getByText("Capella Arabic brand").props.style).toEqual(
      expect.objectContaining({ fontFamily: "Tajawal_700Bold" })
    );
  });

  test("keeps home content inside the device safe area", async () => {
    const view = await renderHomeScreen();

    expect(view.getByTestId("home-safe-area")).toBeTruthy();
  });

  test("provides temporary controls for device RTL acceptance", async () => {
    const view = await renderHomeScreen();

    fireEvent.press(view.getByRole("button", { name: "English" }));

    expect(mockSetLang).toHaveBeenCalledWith("en");
    expect(view.getByRole("button", { name: "العربية" })).toBeTruthy();
  });

  test("gives language controls an accessible touch target", async () => {
    const view = await renderHomeScreen();
    const englishButton = view.getByRole("button", { name: "English" });

    expect(StyleSheet.flatten(englishButton.props.style)).toEqual(
      expect.objectContaining({ minHeight: 48 })
    );
  });

  test("lists products returned by the Phase 3 API client", async () => {
    const view = await renderHomeScreen();

    expect(mockFetchProducts).toHaveBeenCalledWith({
      lang: "ar",
      throwOnError: true
    });
  });
});