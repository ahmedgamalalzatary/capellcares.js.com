const React = require("react");
const { render, waitFor } = require("@testing-library/react-native");

let mockFontsLoaded = false;
let mockLanguageReady = false;
let mockFontError = null;
const mockUseFonts = jest.fn(() => [mockFontsLoaded, mockFontError]);
const mockPreventAutoHideAsync = jest.fn().mockResolvedValue(true);
const mockHideAsync = jest.fn().mockResolvedValue(undefined);

jest.mock("expo-font", () => ({ useFonts: (...args) => mockUseFonts(...args) }));
jest.mock("expo-splash-screen", () => ({
  hideAsync: (...args) => mockHideAsync(...args),
  preventAutoHideAsync: (...args) => mockPreventAutoHideAsync(...args)
}));
jest.mock("@expo-google-fonts/roboto/400Regular", () => ({
  Roboto_400Regular: "Roboto_400Regular_asset"
}));
jest.mock("@expo-google-fonts/roboto/500Medium", () => ({
  Roboto_500Medium: "Roboto_500Medium_asset"
}));
jest.mock("@expo-google-fonts/roboto/700Bold", () => ({
  Roboto_700Bold: "Roboto_700Bold_asset"
}));
jest.mock("@expo-google-fonts/tajawal/400Regular", () => ({
  Tajawal_400Regular: "Tajawal_400Regular_asset"
}));
jest.mock("@expo-google-fonts/tajawal/500Medium", () => ({
  Tajawal_500Medium: "Tajawal_500Medium_asset"
}));
jest.mock("@expo-google-fonts/tajawal/700Bold", () => ({
  Tajawal_700Bold: "Tajawal_700Bold_asset"
}));
jest.mock("@expo-google-fonts/lobster/400Regular", () => ({
  Lobster_400Regular: "Lobster_400Regular_asset"
}));
jest.mock("expo-router", () => {
  const ReactModule = require("react");
  const { View: NativeView } = require("react-native");
  return {
    Stack: () => ReactModule.createElement(NativeView, { testID: "router-stack" })
  };
});
jest.mock("react-native-safe-area-context", () => {
  const ReactModule = require("react");
  const { View: NativeView } = require("react-native");
  return {
    SafeAreaProvider: ({ children }) =>
      ReactModule.createElement(NativeView, { testID: "safe-area" }, children)
  };
});
jest.mock("../src/lib/lang", () => ({
  LangProvider: ({ children }) => children,
  useLang: () => ({ ready: mockLanguageReady })
}));

const RootLayout = require("../app/_layout").default;

describe("mobile root layout", () => {
  beforeEach(() => {
    mockFontsLoaded = false;
    mockFontError = null;
    mockLanguageReady = false;
    mockHideAsync.mockClear();
    mockUseFonts.mockClear();
  });

  test("holds the native splash screen as soon as the module loads", () => {
    expect(mockPreventAutoHideAsync).toHaveBeenCalledTimes(1);
  });

  test("loads every font name exposed by the theme", async () => {
    await render(<RootLayout />);

    expect(mockUseFonts).toHaveBeenCalledWith({
      Lobster_400Regular: "Lobster_400Regular_asset",
      Roboto_400Regular: "Roboto_400Regular_asset",
      Roboto_500Medium: "Roboto_500Medium_asset",
      Roboto_700Bold: "Roboto_700Bold_asset",
      Tajawal_400Regular: "Tajawal_400Regular_asset",
      Tajawal_500Medium: "Tajawal_500Medium_asset",
      Tajawal_700Bold: "Tajawal_700Bold_asset"
    });
  });

  test("keeps navigation hidden until fonts and language are both ready", async () => {
    mockFontsLoaded = true;
    const view = await render(<RootLayout />);

    expect(view.queryByTestId("router-stack")).toBeNull();
    expect(mockHideAsync).not.toHaveBeenCalled();
  });

  test("renders inside safe area and hides the splash when startup is ready", async () => {
    mockFontsLoaded = true;
    mockLanguageReady = true;
    const view = await render(<RootLayout />);

    expect(view.getByTestId("safe-area")).toBeTruthy();
    expect(view.getByTestId("router-stack")).toBeTruthy();
    await waitFor(() => expect(mockHideAsync).toHaveBeenCalledTimes(1));
  });

  test("surfaces a font load failure instead of rendering with missing fonts", async () => {
    mockFontError = new Error("font load failed");
    mockLanguageReady = true;
    const view = await render(<RootLayout />);

    expect(view.getByRole("alert")).toHaveTextContent(/Unable to load app fonts/);
    expect(view.queryByTestId("router-stack")).toBeNull();
    await waitFor(() => expect(mockHideAsync).toHaveBeenCalledTimes(1));
  });
});
