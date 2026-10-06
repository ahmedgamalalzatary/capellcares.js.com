const React = require("react");
const { View, Text, Linking } = require("react-native");
const { render: nativeRender, fireEvent, act } = require("@testing-library/react-native");
const { PaperProvider } = require("react-native-paper");
const { paperTheme } = require("../../src/components/ui/paper-theme");
function render(element) { return nativeRender(element, { wrapper: ({ children }) =>
  <PaperProvider theme={paperTheme(mockLanguage)} settings={{ icon: () => null }}>{children}</PaperProvider> }); }
let mockLanguage = "en";
const mockPolicy = { recommendedUpdate: null, dismissRecommendedUpdate: async () => {}, config: { platform: "android" } };
jest.mock("../../src/lib/lang", () => ({ useLang: () => ({ lang: mockLanguage, dict: require("@capella/shared").getDict(mockLanguage) }) }));
jest.mock("../../src/lib/policy", () => ({ usePolicy: () => mockPolicy }));
jest.mock("expo-video", () => ({ useVideoPlayer: jest.fn(), VideoView: require("react-native").View }));
jest.mock("react-native-webview", () => ({ WebView: require("react-native").View }));
beforeEach(() => { jest.clearAllMocks(); mockLanguage = "en"; mockPolicy.recommendedUpdate = null;
  Object.defineProperty(require("react-native").Platform, "OS", { value: "android", configurable: true }); });
afterEach(async () => { await act(async () => {}); jest.restoreAllMocks(); });
const requirement = { code: "APP_UPDATE_REQUIRED", feature: "checkout", policyRevision: "r2", requiredRelease: "r2",
  message: "Update", explanation: { ar: "حدّث التطبيق لإتمام الطلب", en: "Update to place an order" },
  storeUrl: "https://play.google.com/store/apps/details?id=com.capellacare.app" };
function components() { try { return require("../../src/components"); } catch (e) { if (e.code === "MODULE_NOT_FOUND") return {}; throw e; } }

test("recommended updates are dismissible without hiding compatible content", async () => {
  const { RecommendedUpdate } = components(); expect(typeof RecommendedUpdate).toBe("function");
  mockPolicy.recommendedUpdate = { releaseId: "r2", storeUrl: requirement.storeUrl, explanation: requirement.explanation };
  mockPolicy.dismissRecommendedUpdate = async () => { mockPolicy.recommendedUpdate = null; };
  const view = render(<View><RecommendedUpdate /><Text>Browse products</Text></View>);
  await act(async () => fireEvent.press(view.getByRole("button", { name: "Not now" })));
  view.rerender(<View><RecommendedUpdate /><Text>Browse products</Text></View>);
  expect(view.queryByText("An update is available")).toBeNull(); expect(view.getByText("Browse products")).toBeTruthy();
});

test("feature blocking uses the selected language and keeps surrounding tasks available", () => {
  const { FeatureUpdateRequired } = components(); expect(typeof FeatureUpdateRequired).toBe("function");
  mockLanguage = "ar";
  const view = render(<View><FeatureUpdateRequired requirement={requirement} /><Text>Support</Text></View>);
  expect(view.getByText(requirement.explanation.ar)).toBeTruthy(); expect(view.getByText("Support")).toBeTruthy();
  expect(view.queryByRole("button", { name: "ليس الآن" })).toBeNull();
});

test("store action opens a validated destination and exposes useful retry after a failed open", async () => {
  const { FeatureUpdateRequired } = components(); expect(typeof FeatureUpdateRequired).toBe("function");
  const opened = [];
  jest.spyOn(Linking, "openURL").mockImplementation(async url => { opened.push(url); if (opened.length === 1) throw new Error("private failure"); });
  const view = render(<FeatureUpdateRequired requirement={requirement} />);
  await act(async () => fireEvent.press(view.getByRole("button", { name: "Open app store" })));
  expect(view.getByRole("alert")).toBeTruthy(); expect(view.queryByText("private failure")).toBeNull();
  await act(async () => fireEvent.press(view.getByRole("button", { name: "Open app store" })));
  expect(opened).toEqual([requirement.storeUrl, requirement.storeUrl]);
});

test("an unsafe update destination never reaches the platform linker", async () => {
  const { FeatureUpdateRequired } = components(); expect(typeof FeatureUpdateRequired).toBe("function");
  const linker = jest.spyOn(Linking, "openURL");
  const view = render(<FeatureUpdateRequired requirement={{ ...requirement, storeUrl: "javascript:alert(1)" }} />);
  await act(async () => fireEvent.press(view.getByRole("button", { name: "Open app store" })));
  expect(linker).not.toHaveBeenCalled(); expect(view.getByRole("alert")).toBeTruthy();
});

test("confirmation supports cancel/native back without performing the protected action", () => {
  const { ConfirmDialog } = components(); expect(typeof ConfirmDialog).toBe("function");
  let confirmed = 0, cancelled = 0;
  const view = render(<ConfirmDialog visible title="Remove item?" message="Remove this item from your cart?"
    confirmLabel="Remove" onConfirm={() => { confirmed++; }} onCancel={() => { cancelled++; }} />);
  fireEvent.press(view.getByRole("button", { name: "Cancel" })); expect(cancelled).toBe(1); expect(confirmed).toBe(0);
  fireEvent.press(view.getByRole("button", { name: "Remove" })); expect(confirmed).toBe(1);
});
