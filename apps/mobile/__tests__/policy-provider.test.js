const React = require("react");
const { AppState, Button, Text, View } = require("react-native");
const { act, fireEvent, render, waitFor } = require("@testing-library/react-native");

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const mockFetchAppConfig = jest.fn();
jest.mock("../src/lib/api/client", () => ({
  fetchAppConfig: (...args) => mockFetchAppConfig(...args)
}));

const AsyncStorage = require("@react-native-async-storage/async-storage");
const { APP_POLICY_STORAGE_KEY, APP_POLICY_DISMISSAL_STORAGE_KEY } = require("../src/constants/storage");
const { PolicyProvider, usePolicy } = require("../src/lib/policy");

function makeRelease() {
  return {
    appVersion: "1.2.0",
    appBuild: "12",
    runtimeVersion: "1",
    clientRevision: 1,
    apiContract: "/api/v1",
    updateIds: ["embedded"],
    storeUrl: "https://play.google.com/store/apps/details?id=com.capella.store",
    available: true
  };
}

function makeConfig(overrides = {}) {
  return {
    schemaVersion: 1,
    policyRevision: "policy-1",
    platform: "ios",
    cache: { maxAgeSeconds: 3600 },
    current: null,
    previous: null,
    recommendedUpdate: null,
    features: [],
    ...overrides
  };
}

function configWithRecommendation(policyRevision, releaseId) {
  const release = makeRelease();
  return makeConfig({
    policyRevision,
    current: { id: releaseId, release },
    recommendedUpdate: {
      releaseId,
      storeUrl: release.storeUrl,
      explanation: { ar: "يتوفر إصدار أحدث", en: "A newer release is available" }
    }
  });
}

async function seedCache(config, fetchedAt) {
  await AsyncStorage.setItem(APP_POLICY_STORAGE_KEY, JSON.stringify({ fetchedAt, config }));
}

function PolicyProbe() {
  const { config, ready, refreshing, features, recommendedUpdate, dismissed, refresh, dismissRecommendedUpdate } = usePolicy();

  return (
    <View>
      <Text testID="ready">{String(ready)}</Text>
      <Text testID="revision">{config ? config.policyRevision : "none"}</Text>
      <Text testID="recommended">{recommendedUpdate ? recommendedUpdate.releaseId : "none"}</Text>
      <Text testID="dismissed">{String(dismissed)}</Text>
      <Text testID="features">{String(features.length)}</Text>
      <Text testID="refreshing">{String(refreshing)}</Text>
      <Button title="Refresh" onPress={() => void refresh()} />
      <Button title="Dismiss" onPress={() => void dismissRecommendedUpdate()} />
    </View>
  );
}

describe("PolicyProvider", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    mockFetchAppConfig.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("hydrates a fresh cached policy without a network call", async () => {
    await seedCache(makeConfig({ policyRevision: "cached" }), Date.now());
    const view = render(
      <PolicyProvider>
        <PolicyProbe />
      </PolicyProvider>
    );

    await waitFor(() => expect(view.getByTestId("ready").props.children).toBe("true"));

    expect(view.getByTestId("revision").props.children).toBe("cached");
    expect(mockFetchAppConfig).not.toHaveBeenCalled();
  });

  test("refreshes a stale cached policy and rewrites the cache", async () => {
    await seedCache(makeConfig({ policyRevision: "old", cache: { maxAgeSeconds: 60 } }), Date.now() - 120_000);
    mockFetchAppConfig.mockResolvedValue(makeConfig({ policyRevision: "fresh" }));

    const view = render(
      <PolicyProvider>
        <PolicyProbe />
      </PolicyProvider>
    );

    await waitFor(() => expect(view.getByTestId("revision").props.children).toBe("fresh"));
    expect(mockFetchAppConfig).toHaveBeenCalledTimes(1);

    const stored = JSON.parse(await AsyncStorage.getItem(APP_POLICY_STORAGE_KEY));
    expect(stored.config.policyRevision).toBe("fresh");
    expect(typeof stored.fetchedAt).toBe("number");
  });

  test("settles ready with no config when offline and uncached", async () => {
    mockFetchAppConfig.mockRejectedValue(new Error("offline"));

    const view = render(
      <PolicyProvider>
        <PolicyProbe />
      </PolicyProvider>
    );

    await waitFor(() => expect(view.getByTestId("ready").props.children).toBe("true"));
    expect(view.getByTestId("revision").props.children).toBe("none");
  });

  test("keeps the cached policy when a refresh fails", async () => {
    await seedCache(makeConfig({ policyRevision: "cached", cache: { maxAgeSeconds: 0 } }), Date.now() - 5000);
    mockFetchAppConfig.mockRejectedValue(new Error("offline"));

    const view = render(
      <PolicyProvider>
        <PolicyProbe />
      </PolicyProvider>
    );

    await waitFor(() => expect(mockFetchAppConfig).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(view.getByTestId("ready").props.children).toBe("true"));
    expect(view.getByTestId("revision").props.children).toBe("cached");
  });

  test("deduplicates concurrent refreshes into one request", async () => {
    let resolveFetch;
    mockFetchAppConfig.mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve; }));
    const view = render(
      <PolicyProvider>
        <PolicyProbe />
      </PolicyProvider>
    );

    await waitFor(() => expect(view.getByTestId("ready").props.children).toBe("true"));

    fireEvent.press(view.getByRole("button", { name: "Refresh" }));
    fireEvent.press(view.getByRole("button", { name: "Refresh" }));

    expect(mockFetchAppConfig).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch(makeConfig({ policyRevision: "one" }));
    });
    await waitFor(() => expect(view.getByTestId("revision").props.children).toBe("one"));
  });

  test("treats an invalid cached payload as no cache and refetches", async () => {
    await AsyncStorage.setItem(APP_POLICY_STORAGE_KEY, "{not valid json");
    mockFetchAppConfig.mockResolvedValue(makeConfig({ policyRevision: "recovered" }));

    const view = render(
      <PolicyProvider>
        <PolicyProbe />
      </PolicyProvider>
    );

    await waitFor(() => expect(mockFetchAppConfig).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(view.getByTestId("revision").props.children).toBe("recovered"));
  });

  test("refreshes on foreground when the cached policy is stale", async () => {
    await seedCache(makeConfig({ policyRevision: "p1", cache: { maxAgeSeconds: 0 } }), Date.now());
    mockFetchAppConfig.mockResolvedValue(makeConfig({ policyRevision: "p2", cache: { maxAgeSeconds: 0 } }));
    const spy = jest.spyOn(AppState, "addEventListener");

    const view = render(
      <PolicyProvider>
        <PolicyProbe />
      </PolicyProvider>
    );
    await waitFor(() => expect(mockFetchAppConfig).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(view.getByTestId("revision").props.children).toBe("p2"));

    const handler = spy.mock.calls.find(([event]) => event === "change")?.[1];
    await act(async () => {
      handler("active");
    });

    await waitFor(() => expect(mockFetchAppConfig).toHaveBeenCalledTimes(2));
  });

  test("dismisses a recommendation only for the current policy and release", async () => {
    await seedCache(configWithRecommendation("policy-1", "release-a"), Date.now());
    const view = render(
      <PolicyProvider>
        <PolicyProbe />
      </PolicyProvider>
    );

    await waitFor(() => expect(view.getByTestId("recommended").props.children).toBe("release-a"));

    fireEvent.press(view.getByRole("button", { name: "Dismiss" }));

    await waitFor(() => expect(view.getByTestId("recommended").props.children).toBe("none"));
    expect(view.getByTestId("dismissed").props.children).toBe("true");
    expect(await AsyncStorage.getItem(APP_POLICY_DISMISSAL_STORAGE_KEY)).toBe("policy-1:release-a");

    // A new recommendation identity is not suppressed by an older dismissal.
    await act(async () => {
      await AsyncStorage.setItem(APP_POLICY_STORAGE_KEY, JSON.stringify({
        fetchedAt: Date.now(),
        config: configWithRecommendation("policy-2", "release-b")
      }));
    });
    const reopened = render(
      <PolicyProvider>
        <PolicyProbe />
      </PolicyProvider>
    );
    await waitFor(() => expect(reopened.getByTestId("recommended").props.children).toBe("release-b"));
  });
});
