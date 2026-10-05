/* global jest, describe, beforeEach, test, expect */
const React = require("react");
const { fireEvent, render, waitFor } = require("@testing-library/react-native");

let mockFontsLoaded = false;
let mockLanguageReady = false;
let mockFontError = null;
let mockLanguageError = null;
let mockLang = "en";
const mockRetryLanguage = jest.fn();
const mockReloadAppAsync = jest.fn().mockResolvedValue(undefined);
const mockUseFonts = jest.fn(() => [mockFontsLoaded, mockFontError]);
const mockPreventAutoHideAsync = jest.fn().mockResolvedValue(true);
const mockHideAsync = jest.fn().mockResolvedValue(undefined);

jest.mock("expo-font", () => ({ useFonts: (...args) => mockUseFonts(...args) }));
jest.mock("expo", () => ({ reloadAppAsync: (...args) => mockReloadAppAsync(...args) }));
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
    ...require("react-native-safe-area-context/jest/mock").default,
    SafeAreaProvider: ({ children }) =>
      ReactModule.createElement(NativeView, { testID: "safe-area" }, ReactModule.createElement(
        require("react-native-safe-area-context/jest/mock").default.SafeAreaProvider, null, children))
  };
});
jest.mock("../src/lib/lang", () => ({
  LangProvider: ({ children }) => children,
  useLang: () => ({ ready: mockLanguageReady, lang: mockLang, error: mockLanguageError, retry: mockRetryLanguage })
}));
jest.mock("../src/lib/auth/auth-context", () => ({
  AuthProvider: ({ children }) => children
}));
jest.mock("../src/lib/policy", () => ({
  PolicyProvider: ({ children }) => children
}));
jest.mock("../src/lib/cart", () => ({
  CartProvider: ({ children }) => children
}));

const RootLayout = require("../app/_layout").default;

describe("mobile root layout", () => {
  beforeEach(() => {
    mockFontsLoaded = false;
    mockFontError = null;
    mockLanguageReady = false;
    mockLanguageError = null;
    mockLang = "en";
    mockRetryLanguage.mockReset();
    mockReloadAppAsync.mockReset().mockResolvedValue(undefined);
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

  test("shows Arabic font recovery when Arabic is selected", async () => {
    mockLang = "ar";
    mockFontError = new Error("font load failed");
    mockLanguageReady = true;
    const view = await render(<RootLayout />);

    expect(view.getByRole("alert")).toHaveTextContent(/تعذر تحميل خطوط التطبيق/);
    fireEvent.press(view.getByRole("button", { name: "حاول مرة أخرى" }));
    await waitFor(() => expect(mockReloadAppAsync).toHaveBeenCalledTimes(1));
  });

  test("exposes language startup recovery before language is ready", async () => {
    mockFontsLoaded = true;
    mockLanguageError = new Error("RTL reload failed");
    const view = await render(<RootLayout />);

    expect(view.getByRole("alert")).toHaveTextContent(/Unable to prepare app language/);
    expect(view.queryByTestId("router-stack")).toBeNull();
    fireEvent.press(view.getByRole("button", { name: "Try again" }));
    expect(mockRetryLanguage).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockHideAsync).toHaveBeenCalledTimes(1));
  });

  test("allows another attempt after a failed font recovery without exposing native errors", async () => {
    mockLanguageReady = true;
    mockFontError = new Error("font load failed");
    mockReloadAppAsync.mockRejectedValueOnce(new Error("private native details"));
    const view = await render(<RootLayout />);

    fireEvent.press(view.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(view.getByRole("alert")).toHaveTextContent(/Unable to restart the app/));
    expect(view.queryByText(/private native details/)).toBeNull();
    fireEvent.press(view.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(mockReloadAppAsync).toHaveBeenCalledTimes(2));
  });

  test("handles a native splash dismissal rejection", async () => {
    mockFontsLoaded = true;
    mockLanguageReady = true;
    mockHideAsync.mockRejectedValueOnce(new Error("private native details"));
    const report = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      await render(<RootLayout />);
      await waitFor(() => expect(report).toHaveBeenCalledWith("Unable to hide the startup splash screen."));
    } finally {
      report.mockRestore();
    }
  });

  test("handles a native splash hold rejection during module startup", async () => {
    mockPreventAutoHideAsync.mockRejectedValueOnce(new Error("private native details"));
    const report = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      jest.isolateModules(() => require("../app/_layout"));
      await waitFor(() => expect(report).toHaveBeenCalledWith("Unable to hold the startup splash screen."));
    } finally {
      report.mockRestore();
    }
  });
});
