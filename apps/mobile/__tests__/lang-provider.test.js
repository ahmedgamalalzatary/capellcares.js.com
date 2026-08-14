const React = require("react");
const { Button, I18nManager, Text, View } = require("react-native");
const { act, fireEvent, render, waitFor } = require("@testing-library/react-native");

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
  const { dict, direction, lang, ready, setLang } = useLang();

  return (
    <View>
      <Text testID="ready">{String(ready)}</Text>
      <Text testID="lang">{lang}</Text>
      <Text testID="direction">{direction}</Text>
      <Text testID="brand">{dict.brand}</Text>
      <Button title="Arabic" onPress={() => void setLang("ar")} />
      <Button title="English" onPress={() => void setLang("en")} />
    </View>
  );
}

describe("LangProvider", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
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

  test("requires useLang consumers to be inside the provider", async () => {
    await expect(render(<LanguageProbe />)).rejects.toThrow(
      "useLang must be used within a LangProvider"
    );
  });
});
