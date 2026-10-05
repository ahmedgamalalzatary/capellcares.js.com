const React = require("react");
const { Button, I18nManager, Platform, Text, View } = require("react-native");
const { act, fireEvent, render, waitFor } = require("@testing-library/react-native");
const originalPlatform = Platform.OS;
const originalDocument = global.document;

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const mockReloadAppAsync = jest.fn().mockResolvedValue(undefined);
jest.mock("expo", () => ({
  reloadAppAsync: (...args) => mockReloadAppAsync(...args)
}));

const AsyncStorage = require("@react-native-async-storage/async-storage");
const { LANG_STORAGE_KEY } = require("../src/constants/storage");
const { LangProvider, useLang } = require("../src/lib/lang");

function LanguageProbe() {
  const { dict, direction, error, lang, pending, ready, retry, setLang, holdLanguageChanges } = useLang();
  const holds = React.useRef([]);

  return (
    <View>
      <Text testID="ready">{String(ready)}</Text>
      <Text testID="lang">{lang}</Text>
      <Text testID="direction">{direction}</Text>
      <Text testID="pending">{String(pending)}</Text>
      <Text testID="error">{String(Boolean(error))}</Text>
      <Text testID="brand">{dict.brand}</Text>
      <Button title="Arabic" onPress={() => void setLang("ar")} />
      <Button title="English" onPress={() => void setLang("en")} />
      <Button title="Retry" onPress={() => void retry()} />
      <Button title="Begin critical operation" onPress={() => holds.current.push(holdLanguageChanges?.() ?? (() => {}))} />
      <Button title="End critical operation" onPress={() => holds.current.pop()?.()} />
    </View>
  );
}

describe("LangProvider", () => {
  afterEach(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform });
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
  });
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    mockReloadAppAsync.mockReset().mockResolvedValue(undefined);
    I18nManager.allowRTL = jest.fn();
    I18nManager.forceRTL = jest.fn();
    Object.defineProperty(I18nManager, "isRTL", { configurable: true, value: false });
  });

  test("hydrates a stored English preference with the shared dictionary and LTR direction", async () => {
    await AsyncStorage.setItem(LANG_STORAGE_KEY, "en");
    const view = await render(
      <LangProvider>
        <LanguageProbe />
      </LangProvider>
    );

    await waitFor(() => expect(view.getByTestId("ready").props.children).toBe("true"));

    expect(view.getByTestId("lang").props.children).toBe("en");
    expect(view.getByTestId("direction").props.children).toBe("ltr");
    expect(view.getByTestId("brand").props.children).toBeTruthy();
    expect(I18nManager.allowRTL).toHaveBeenCalledWith(false);
    expect(I18nManager.forceRTL).toHaveBeenCalledWith(false);
    expect(mockReloadAppAsync).not.toHaveBeenCalled();
  });

  test("defaults missing or invalid storage to persisted Arabic", async () => {
    await AsyncStorage.setItem(LANG_STORAGE_KEY, "unsupported");
    const view = await render(
      <LangProvider>
        <LanguageProbe />
      </LangProvider>
    );

    await waitFor(() => expect(view.getByTestId("ready").props.children).toBe("true"));

    expect(view.getByTestId("lang").props.children).toBe("ar");
    expect(view.getByTestId("direction").props.children).toBe("rtl");
    await expect(AsyncStorage.getItem(LANG_STORAGE_KEY)).resolves.toBe("ar");
    expect(I18nManager.forceRTL).toHaveBeenCalledWith(true);
    expect(mockReloadAppAsync).toHaveBeenCalledTimes(1);
  });

  test("forces stored English to LTR on a device whose locale defaults to RTL", async () => {
    await AsyncStorage.setItem(LANG_STORAGE_KEY, "en");
    Object.defineProperty(I18nManager, "isRTL", { configurable: true, value: true });

    const view = await render(
      <LangProvider>
        <LanguageProbe />
      </LangProvider>
    );

    await waitFor(() => expect(view.getByTestId("ready").props.children).toBe("true"));
    expect(I18nManager.allowRTL).toHaveBeenCalledWith(false);
    expect(I18nManager.forceRTL).toHaveBeenCalledWith(false);
    expect(mockReloadAppAsync).toHaveBeenCalledTimes(1);
  });

  test("persists a changed language, updates native RTL, and reloads through Expo core", async () => {
    await AsyncStorage.setItem(LANG_STORAGE_KEY, "en");
    const view = await render(
      <LangProvider>
        <LanguageProbe />
      </LangProvider>
    );
    await waitFor(() => expect(view.getByTestId("ready").props.children).toBe("true"));

    await act(async () => {
      fireEvent.press(view.getByRole("button", { name: "Arabic" }));
    });

    await waitFor(() => expect(view.getByTestId("lang").props.children).toBe("ar"));
    await expect(AsyncStorage.getItem(LANG_STORAGE_KEY)).resolves.toBe("ar");
    expect(I18nManager.allowRTL).toHaveBeenLastCalledWith(true);
    expect(I18nManager.forceRTL).toHaveBeenLastCalledWith(true);
    expect(mockReloadAppAsync).toHaveBeenCalledTimes(1);
  });

  test("does not reload when selecting the active language", async () => {
    await AsyncStorage.setItem(LANG_STORAGE_KEY, "en");
    const view = await render(
      <LangProvider>
        <LanguageProbe />
      </LangProvider>
    );
    await waitFor(() => expect(view.getByTestId("ready").props.children).toBe("true"));

    fireEvent.press(view.getByRole("button", { name: "English" }));

    expect(mockReloadAppAsync).not.toHaveBeenCalled();
  });

  test("keeps the active language when persistence fails", async () => {
    await AsyncStorage.setItem(LANG_STORAGE_KEY, "en");
    const view = await render(
      <LangProvider>
        <LanguageProbe />
      </LangProvider>
    );
    await waitFor(() => expect(view.getByTestId("ready").props.children).toBe("true"));
    AsyncStorage.setItem.mockRejectedValueOnce(new Error("storage unavailable"));

    fireEvent.press(view.getByRole("button", { name: "Arabic" }));

    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith(LANG_STORAGE_KEY, "ar"));
    expect(view.getByTestId("lang").props.children).toBe("en");
    expect(I18nManager.forceRTL).toHaveBeenLastCalledWith(false);
    expect(mockReloadAppAsync).not.toHaveBeenCalled();
  });

  test("rolls back persistence and direction when a required reload fails", async () => {
    await AsyncStorage.setItem(LANG_STORAGE_KEY, "en");
    const view = await render(
      <LangProvider>
        <LanguageProbe />
      </LangProvider>
    );
    await waitFor(() => expect(view.getByTestId("ready").props.children).toBe("true"));
    mockReloadAppAsync.mockRejectedValueOnce(new Error("reload unavailable"));

    fireEvent.press(view.getByRole("button", { name: "Arabic" }));

    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(LANG_STORAGE_KEY, "en"));
    expect(view.getByTestId("lang").props.children).toBe("en");
    expect(I18nManager.allowRTL).toHaveBeenLastCalledWith(false);
    expect(I18nManager.forceRTL).toHaveBeenLastCalledWith(false);
  });

  test("requires useLang consumers to be inside the provider", () => {
    expect(() => render(<LanguageProbe />)).toThrow(
      "useLang must be used within a LangProvider"
    );
  });

  test("does not report ready when a required startup reload fails, then recovers on retry", async () => {
    await AsyncStorage.setItem(LANG_STORAGE_KEY, "ar");
    mockReloadAppAsync.mockRejectedValueOnce(new Error("reload unavailable"));

    const view = render(
      <LangProvider>
        <LanguageProbe />
      </LangProvider>
    );

    await waitFor(() => expect(view.getByTestId("error").props.children).toBe("true"));
    expect(view.getByTestId("ready").props.children).toBe("false");

    fireEvent.press(view.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(view.getByTestId("ready").props.children).toBe("true"));
    expect(view.getByTestId("lang").props.children).toBe("ar");
    expect(view.getByTestId("error").props.children).toBe("false");
  });

  test("keeps overlapping language selections consistent with persisted state", async () => {
    await AsyncStorage.setItem(LANG_STORAGE_KEY, "en");
    const view = render(
      <LangProvider>
        <LanguageProbe />
      </LangProvider>
    );
    await waitFor(() => expect(view.getByTestId("ready").props.children).toBe("true"));

    AsyncStorage.setItem.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 30))
    );
    fireEvent.press(view.getByRole("button", { name: "Arabic" }));
    fireEvent.press(view.getByRole("button", { name: "English" }));

    await waitFor(() => expect(view.getByTestId("pending").props.children).toBe("false"));
    expect(view.getByTestId("lang").props.children).toBe("en");
    await expect(AsyncStorage.getItem(LANG_STORAGE_KEY)).resolves.toBe("en");
  });

  test("boots the browser in persisted Arabic without invoking native RTL or reloading", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    global.document = { documentElement: { dir: "ltr", lang: "en" } };
    await AsyncStorage.setItem(LANG_STORAGE_KEY, "ar");
    const view = render(<LangProvider><LanguageProbe /></LangProvider>);

    await waitFor(() => expect(view.getByTestId("ready").props.children).toBe("true"));
    expect(global.document.documentElement).toEqual({ dir: "rtl", lang: "ar" });
    expect(I18nManager.forceRTL).not.toHaveBeenCalled();
    expect(mockReloadAppAsync).not.toHaveBeenCalled();
  });

  test("switches browser direction and persists English without a native reload", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    global.document = { documentElement: { dir: "ltr", lang: "en" } };
    const view = render(<LangProvider><LanguageProbe /></LangProvider>);
    await waitFor(() => expect(view.getByTestId("ready").props.children).toBe("true"));
    fireEvent.press(view.getByRole("button", { name: "English" }));

    await waitFor(() => expect(view.getByTestId("lang").props.children).toBe("en"));
    expect(global.document.documentElement).toEqual({ dir: "ltr", lang: "en" });
    await expect(AsyncStorage.getItem(LANG_STORAGE_KEY)).resolves.toBe("en");
    expect(mockReloadAppAsync).not.toHaveBeenCalled();
  });

  test("defers language persistence and reload until every critical operation finishes", async () => {
    await AsyncStorage.setItem(LANG_STORAGE_KEY, "en");
    const view = render(<LangProvider><LanguageProbe /></LangProvider>);
    await waitFor(() => expect(view.getByTestId("ready").props.children).toBe("true"));
    fireEvent.press(view.getByRole("button", { name: "Begin critical operation" }));
    fireEvent.press(view.getByRole("button", { name: "Begin critical operation" }));
    fireEvent.press(view.getByRole("button", { name: "Arabic" }));
    await act(async () => {});
    expect(view.getByTestId("lang").props.children).toBe("en");
    await expect(AsyncStorage.getItem(LANG_STORAGE_KEY)).resolves.toBe("en");
    expect(view.getByTestId("pending").props.children).toBe("true");
    expect(mockReloadAppAsync).not.toHaveBeenCalled();

    fireEvent.press(view.getByRole("button", { name: "End critical operation" }));
    await act(async () => {});
    expect(mockReloadAppAsync).not.toHaveBeenCalled();
    fireEvent.press(view.getByRole("button", { name: "End critical operation" }));
    await waitFor(() => expect(view.getByTestId("lang").props.children).toBe("ar"));
    await expect(AsyncStorage.getItem(LANG_STORAGE_KEY)).resolves.toBe("ar");
    expect(mockReloadAppAsync).toHaveBeenCalledTimes(1);
  });

  test("cancels a queued language change when the original language is selected again", async () => {
    await AsyncStorage.setItem(LANG_STORAGE_KEY, "en");
    const view = render(<LangProvider><LanguageProbe /></LangProvider>);
    await waitFor(() => expect(view.getByTestId("ready").props.children).toBe("true"));
    fireEvent.press(view.getByRole("button", { name: "Begin critical operation" }));
    fireEvent.press(view.getByRole("button", { name: "Arabic" }));
    fireEvent.press(view.getByRole("button", { name: "English" }));
    fireEvent.press(view.getByRole("button", { name: "End critical operation" }));
    await act(async () => {});
    expect(view.getByTestId("pending").props.children).toBe("false");
    await expect(AsyncStorage.getItem(LANG_STORAGE_KEY)).resolves.toBe("en");
    expect(mockReloadAppAsync).not.toHaveBeenCalled();
  });

  test("does not reload after the language provider unmounts during a storage write", async () => {
    await AsyncStorage.setItem(LANG_STORAGE_KEY, "en");
    const view = render(<LangProvider><LanguageProbe /></LangProvider>);
    await waitFor(() => expect(view.getByTestId("ready").props.children).toBe("true"));
    let finishWrite;
    AsyncStorage.setItem.mockImplementationOnce(() => new Promise((resolve) => { finishWrite = resolve; }));
    // Stop the old implementation's erroneous native call rather than allowing
    // its unmounted retry loop to run indefinitely.
    mockReloadAppAsync.mockRejectedValueOnce(new Error("unexpected reload"));
    fireEvent.press(view.getByRole("button", { name: "Arabic" }));
    await act(async () => {});
    await view.unmount();
    await act(async () => { finishWrite(); });
    expect(mockReloadAppAsync).not.toHaveBeenCalled();
  });

  test("resumes a queued switch when the critical operation ends during storage reconciliation", async () => {
    await AsyncStorage.setItem(LANG_STORAGE_KEY, "en");
    const view = render(<LangProvider><LanguageProbe /></LangProvider>);
    await waitFor(() => expect(view.getByTestId("ready").props.children).toBe("true"));
    let finishWrite;
    let finishReconciliation;
    AsyncStorage.setItem
      .mockImplementationOnce(() => new Promise((resolve) => { finishWrite = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { finishReconciliation = resolve; }));
    fireEvent.press(view.getByRole("button", { name: "Arabic" }));
    await act(async () => {});
    fireEvent.press(view.getByRole("button", { name: "Begin critical operation" }));
    await act(async () => { finishWrite(); });
    expect(mockReloadAppAsync).not.toHaveBeenCalled();
    fireEvent.press(view.getByRole("button", { name: "End critical operation" }));
    await act(async () => { finishReconciliation(); });
    await waitFor(() => expect(view.getByTestId("lang").props.children).toBe("ar"));
    await expect(AsyncStorage.getItem(LANG_STORAGE_KEY)).resolves.toBe("ar");
    expect(view.getByTestId("pending").props.children).toBe("false");
  });
});
