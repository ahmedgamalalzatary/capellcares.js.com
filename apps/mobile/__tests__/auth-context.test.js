const React = require("react");
const { AppState, Button, Text, View } = require("react-native");
const { act, fireEvent, render, waitFor } = require("@testing-library/react-native");

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const mockSecureStoreData = new Map();
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key) => (mockSecureStoreData.has(key) ? mockSecureStoreData.get(key) : null)),
  setItemAsync: jest.fn(async (key, value) => { mockSecureStoreData.set(key, value); }),
  deleteItemAsync: jest.fn(async (key) => { mockSecureStoreData.delete(key); })
}));

const mockAuthJSON = jest.fn();
const mockApiError = class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
};
jest.mock("../src/lib/api/http", () => ({
  authJSON: (...args) => mockAuthJSON(...args),
  ApiError: mockApiError,
  configureAuthSessionAdapter: jest.fn()
}));

const AsyncStorage = require("@react-native-async-storage/async-storage");
const { AUTH_STORAGE_KEY, CUSTOMER_REFRESH_TOKEN_KEY } = require("../src/constants/storage");
const tokenStore = require("../src/lib/auth/token-store");
const { AuthProvider, useAuth } = require("../src/lib/auth/auth-context");

function AuthProbe() {
  const { user, accessToken, hydrated, login, signup, logout } = useAuth();
  return (
    <View>
      <Text testID="hydrated">{String(hydrated)}</Text>
      <Text testID="user">{user ? user.name : "none"}</Text>
      <Text testID="token">{accessToken ?? "none"}</Text>
      <Button title="Login" onPress={() => void login("a@capella.test", "Password123!")} />
      <Button title="Signup" onPress={() => void signup("New", "new@capella.test", "Password123!")} />
      <Button title="Logout" onPress={() => void logout()} />
    </View>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>
  );
}

describe("AuthProvider", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockSecureStoreData.clear();
    mockAuthJSON.mockReset();
    await tokenStore.clearSession();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("login stores the user, persists the profile and publishes the access token", async () => {
    mockAuthJSON.mockImplementation((action) =>
      action === "login"
        ? Promise.resolve({ accessToken: "access-1", refreshToken: "refresh-1", user: { id: 1, name: "Ada", email: "a@capella.test" } })
        : Promise.resolve(null)
    );

    const view = renderProvider();
    await waitFor(() => expect(view.getByTestId("hydrated").props.children).toBe("true"));

    fireEvent.press(view.getByRole("button", { name: "Login" }));

    await waitFor(() => expect(view.getByTestId("user").props.children).toBe("Ada"));
    expect(view.getByTestId("token").props.children).toBe("access-1");
    expect(JSON.parse(await AsyncStorage.getItem(AUTH_STORAGE_KEY))).toEqual({ id: 1, name: "Ada", email: "a@capella.test" });
    expect(mockSecureStoreData.get(CUSTOMER_REFRESH_TOKEN_KEY)).toBe("refresh-1");
  });

  test("restores the stored profile and silently refreshes on cold start", async () => {
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: 2, name: "Stored", email: "s@capella.test" }));
    mockSecureStoreData.set(CUSTOMER_REFRESH_TOKEN_KEY, "stored-refresh");
    mockAuthJSON.mockResolvedValue({ accessToken: "access-restored", refreshToken: "rotated-refresh" });

    const view = renderProvider();

    await waitFor(() => expect(view.getByTestId("hydrated").props.children).toBe("true"));
    await waitFor(() => expect(view.getByTestId("token").props.children).toBe("access-restored"));
    expect(view.getByTestId("user").props.children).toBe("Stored");
    expect(mockAuthJSON).toHaveBeenCalledWith("refresh", undefined, { refreshToken: "stored-refresh" });
  });

  test("does not restore a signed-in profile without a recoverable session", async () => {
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: 9, name: "Ghost", email: "g@capella.test" }));
    // No refresh token is stored, so the session cannot be recovered.

    const view = renderProvider();

    await waitFor(() => expect(view.getByTestId("hydrated").props.children).toBe("true"));
    expect(view.getByTestId("user").props.children).toBe("none");
    expect(view.getByTestId("token").props.children).toBe("none");
    expect(await AsyncStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(mockAuthJSON).not.toHaveBeenCalled();
  });

  test("clears an orphaned refresh token when no profile is stored", async () => {
    // A refresh token with no profile is unusable; it must not linger in SecureStore forever.
    mockSecureStoreData.set(CUSTOMER_REFRESH_TOKEN_KEY, "orphan-refresh");

    const view = renderProvider();

    await waitFor(() => expect(view.getByTestId("hydrated").props.children).toBe("true"));
    expect(view.getByTestId("user").props.children).toBe("none");
    expect(mockSecureStoreData.has(CUSTOMER_REFRESH_TOKEN_KEY)).toBe(false);
    expect(mockAuthJSON).not.toHaveBeenCalled();
  });

  test("retries a transient cold-start refresh when the app returns to the foreground", async () => {
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: 4, name: "Transient", email: "t@capella.test" }));
    mockSecureStoreData.set(CUSTOMER_REFRESH_TOKEN_KEY, "stored-refresh");
    mockAuthJSON
      .mockRejectedValueOnce(new mockApiError(500, "Unable to refresh session"))
      .mockResolvedValue({ accessToken: "access-retried", refreshToken: "rotated-2" });
    const spy = jest.spyOn(AppState, "addEventListener");

    const view = renderProvider();
    await waitFor(() => expect(view.getByTestId("hydrated").props.children).toBe("true"));
    // A transient failure still restores the profile, but leaves the session without a usable token.
    expect(view.getByTestId("user").props.children).toBe("Transient");
    expect(view.getByTestId("token").props.children).toBe("none");

    const handler = spy.mock.calls.find(([event]) => event === "change")?.[1];
    await act(async () => {
      handler("active");
    });

    await waitFor(() => expect(view.getByTestId("token").props.children).toBe("access-retried"));
    expect(view.getByTestId("user").props.children).toBe("Transient");
  });

  test("logout clears the local session even when the API call fails", async () => {
    mockAuthJSON.mockImplementation((action) =>
      action === "login"
        ? Promise.resolve({ accessToken: "access-1", refreshToken: "refresh-1", user: { id: 3, name: "Out", email: "o@capella.test" } })
        : Promise.reject(new Error("offline"))
    );

    const view = renderProvider();
    await waitFor(() => expect(view.getByTestId("hydrated").props.children).toBe("true"));
    fireEvent.press(view.getByRole("button", { name: "Login" }));
    await waitFor(() => expect(view.getByTestId("user").props.children).toBe("Out"));

    fireEvent.press(view.getByRole("button", { name: "Logout" }));

    await waitFor(() => expect(view.getByTestId("user").props.children).toBe("none"));
    expect(view.getByTestId("token").props.children).toBe("none");
    expect(await AsyncStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(mockSecureStoreData.has(CUSTOMER_REFRESH_TOKEN_KEY)).toBe(false);
  });

  test("logout removes local access while remote revocation is still waiting", async () => {
    let resolveLogout;
    mockAuthJSON.mockImplementation(action => action === "login"
      ? Promise.resolve({ accessToken: "access", refreshToken: "refresh", user: { id: 1, name: "Ada", email: "a@capella.test" } })
      : new Promise(resolve => { resolveLogout = resolve; }));
    const view = renderProvider();
    await waitFor(() => expect(view.getByTestId("hydrated").props.children).toBe("true"));
    fireEvent.press(view.getByRole("button", { name: "Login" }));
    await waitFor(() => expect(view.getByTestId("user").props.children).toBe("Ada"));
    fireEvent.press(view.getByRole("button", { name: "Logout" }));
    await waitFor(() => expect(view.getByTestId("token").props.children).toBe("none"));
    expect(view.getByTestId("user").props.children).toBe("none");
    await act(async () => resolveLogout(null));
  });
});
