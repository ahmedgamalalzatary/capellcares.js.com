const React = require("react");
const { AppState, Button, Text, View } = require("react-native");
const { act, fireEvent, render, waitFor } = require("@testing-library/react-native");

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const mockAuthState = { user: null, accessToken: null };
jest.mock("../src/lib/auth/auth-context", () => ({
  useAuth: () => mockAuthState
}));

const mockFetchCustomerCart = jest.fn();
const mockReplaceCustomerCart = jest.fn();
const mockFetchProducts = jest.fn();
const mockFetchOffers = jest.fn();
const mockFetchCollections = jest.fn();
jest.mock("../src/lib/api/client", () => ({
  fetchCustomerCart: (...args) => mockFetchCustomerCart(...args),
  replaceCustomerCart: (...args) => mockReplaceCustomerCart(...args),
  fetchProducts: (...args) => mockFetchProducts(...args),
  fetchOffers: (...args) => mockFetchOffers(...args),
  fetchCollections: (...args) => mockFetchCollections(...args)
}));

const AsyncStorage = require("@react-native-async-storage/async-storage");
const storageGet = AsyncStorage.getItem.getMockImplementation();
const { CART_STORAGE_KEY, CART_SYNCED_STORAGE_KEY, CART_PENDING_STORAGE_KEY, CART_OWNER_STORAGE_KEY } = require("../src/constants/storage");
const { CartProvider, useCart } = require("../src/lib/cart");

const productLine = (qty) => ({ type: "product", productId: 1, variantId: 1, qty });

function CartProbe() {
  const { lines, count, add, clear } = useCart();
  return (
    <View>
      <Text testID="count">{String(count)}</Text>
      <Text testID="lines">{JSON.stringify(lines)}</Text>
      <Button title="Add" onPress={() => add(productLine(2))} />
      <Button title="Clear" onPress={() => clear()} />
    </View>
  );
}

function renderCart() {
  return render(
    <CartProvider>
      <CartProbe />
    </CartProvider>
  );
}

describe("CartProvider", () => {
  beforeEach(async () => {
    AsyncStorage.getItem.mockImplementation(storageGet);
    await AsyncStorage.clear();
    jest.clearAllMocks();
    mockAuthState.user = null;
    mockAuthState.accessToken = null;
    mockFetchProducts.mockResolvedValue([]);
    mockFetchOffers.mockResolvedValue([]);
    mockFetchCollections.mockResolvedValue([]);
    mockReplaceCustomerCart.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("a guest add persists locally without any API call", async () => {
    const view = renderCart();
    await waitFor(() => expect(view.getByTestId("count").props.children).toBe("0"));

    fireEvent.press(view.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(view.getByTestId("count").props.children).toBe("2"));
    expect(JSON.parse(await AsyncStorage.getItem(CART_STORAGE_KEY))).toEqual([productLine(2)]);
    expect(mockFetchCustomerCart).not.toHaveBeenCalled();
    expect(mockReplaceCustomerCart).not.toHaveBeenCalled();
  });

  test("does not double already-synced quantities on a signed-in reload", async () => {
    await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify([productLine(2)]));
    await AsyncStorage.setItem(CART_SYNCED_STORAGE_KEY, JSON.stringify([productLine(2)]));
    mockAuthState.user = { id: 1, name: "A", email: "a@capella.test" };
    mockAuthState.accessToken = "token-1";
    mockFetchCustomerCart.mockResolvedValue([productLine(2)]);

    const view = renderCart();

    await waitFor(() => expect(mockFetchCustomerCart).toHaveBeenCalledWith("token-1"));
    await waitFor(() => expect(view.getByTestId("count").props.children).toBe("2"));
    await waitFor(() => expect(mockReplaceCustomerCart).toHaveBeenCalled());
    expect(mockReplaceCustomerCart.mock.calls[0][1]).toEqual([productLine(2)]);
  });

  test("does not sum a failed-upload snapshot on top of the same local cart", async () => {
    await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify([productLine(2)]));
    await AsyncStorage.setItem(CART_SYNCED_STORAGE_KEY, JSON.stringify([productLine(2)]));
    await AsyncStorage.setItem(CART_PENDING_STORAGE_KEY, JSON.stringify({ customerId: 1, lines: [productLine(2)] }));
    mockAuthState.user = { id: 1, name: "A", email: "a@capella.test" };
    mockAuthState.accessToken = "token-1";
    mockFetchCustomerCart.mockResolvedValue([productLine(2)]);

    const view = renderCart();

    await waitFor(() => expect(mockFetchCustomerCart).toHaveBeenCalledWith("token-1"));
    await waitFor(() => expect(mockReplaceCustomerCart).toHaveBeenCalled());
    expect(view.getByTestId("count").props.children).toBe("2");
    expect(mockReplaceCustomerCart.mock.calls[0][1]).toEqual([productLine(2)]);
  });

  test("keeps the local cart and never PUTs when the pull fails", async () => {
    await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify([productLine(2)]));
    mockAuthState.user = { id: 1, name: "A", email: "a@capella.test" };
    mockAuthState.accessToken = "token-1";
    mockFetchCustomerCart.mockRejectedValue(new Error("offline"));

    const view = renderCart();

    await waitFor(() => expect(mockFetchCustomerCart).toHaveBeenCalled());
    await waitFor(() => expect(view.getByTestId("count").props.children).toBe("2"));
    expect(mockReplaceCustomerCart).not.toHaveBeenCalled();
  });

  test("re-pulls on foreground after a failed GET so local changes are not stranded", async () => {
    mockAuthState.user = { id: 1, name: "A", email: "a@capella.test" };
    mockAuthState.accessToken = "token-1";
    mockFetchCustomerCart.mockRejectedValueOnce(new Error("offline")).mockResolvedValue([]);
    const spy = jest.spyOn(AppState, "addEventListener");

    const view = renderCart();
    await waitFor(() => expect(mockFetchCustomerCart).toHaveBeenCalledTimes(1));

    const handler = spy.mock.calls.find(([event]) => event === "change")?.[1];
    await act(async () => {
      handler("active");
    });

    await waitFor(() => expect(mockFetchCustomerCart).toHaveBeenCalledTimes(2));
    // With the baseline established, the pending local cart is pushed.
    await waitFor(() => expect(mockReplaceCustomerCart).toHaveBeenCalled());
  });

  test("does not re-pull on foreground once the account is already synced", async () => {
    mockAuthState.user = { id: 1, name: "A", email: "a@capella.test" };
    mockAuthState.accessToken = "token-1";
    mockFetchCustomerCart.mockResolvedValue([]);
    const spy = jest.spyOn(AppState, "addEventListener");

    const view = renderCart();
    await waitFor(() => expect(mockFetchCustomerCart).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockReplaceCustomerCart).toHaveBeenCalled());

    const handler = spy.mock.calls.find(([event]) => event === "change")?.[1];
    await act(async () => {
      handler("active");
    });
    await act(async () => {});

    expect(mockFetchCustomerCart).toHaveBeenCalledTimes(1);
  });

  test("does not merge a persisted cart owned by a different account on cold start", async () => {
    // The cart on disk belongs to customer 7; this session is customer 1.
    await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify([productLine(2)]));
    await AsyncStorage.setItem(CART_OWNER_STORAGE_KEY, JSON.stringify({ customerId: 7 }));
    mockAuthState.user = { id: 1, name: "A", email: "a@capella.test" };
    mockAuthState.accessToken = "token-1";
    mockFetchCustomerCart.mockResolvedValue([]);

    const view = renderCart();

    await waitFor(() => expect(mockFetchCustomerCart).toHaveBeenCalledWith("token-1"));
    await waitFor(() => expect(view.getByTestId("count").props.children).toBe("0"));
    expect(view.getByTestId("lines").props.children).toBe("[]");
  });

  test("clears the account cart on logout so it cannot leak into the next session", async () => {
    function Harness() {
      const [account, setAccount] = React.useState(1);
      mockAuthState.user = account == null ? null : { id: account, name: `U${account}`, email: `u${account}@capella.test` };
      mockAuthState.accessToken = account == null ? null : `token-${account}`;
      return (
        <View>
          <CartProvider>
            <CartProbe />
          </CartProvider>
          <Button title="Logout" onPress={() => setAccount(null)} />
        </View>
      );
    }

    await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify([productLine(2)]));
    mockFetchCustomerCart.mockResolvedValue([]);

    const view = render(<Harness />);
    await waitFor(() => expect(mockFetchCustomerCart).toHaveBeenCalledWith("token-1"));
    await waitFor(() => expect(view.getByTestId("count").props.children).toBe("2"));

    fireEvent.press(view.getByRole("button", { name: "Logout" }));

    await waitFor(() => expect(view.getByTestId("count").props.children).toBe("0"));
    expect(await AsyncStorage.getItem(CART_STORAGE_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(CART_OWNER_STORAGE_KEY)).toBeNull();
  });

  test("isolates carts when the signed-in account changes", async () => {
    function Harness() {
      const [account, setAccount] = React.useState(1);
      mockAuthState.user = { id: account, name: `U${account}`, email: `u${account}@capella.test` };
      mockAuthState.accessToken = `token-${account}`;
      return (
        <View>
          <CartProvider>
            <CartProbe />
          </CartProvider>
          <Button title="Switch" onPress={() => setAccount(2)} />
        </View>
      );
    }

    await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify([productLine(2)]));
    mockFetchCustomerCart.mockResolvedValue([]);

    const view = render(<Harness />);

    await waitFor(() => expect(mockFetchCustomerCart).toHaveBeenCalledWith("token-1"));
    await waitFor(() => expect(view.getByTestId("count").props.children).toBe("2"));

    fireEvent.press(view.getByRole("button", { name: "Switch" }));

    await waitFor(() => expect(mockFetchCustomerCart).toHaveBeenCalledWith("token-2"));
    await waitFor(() => expect(view.getByTestId("count").props.children).toBe("0"));
    expect(view.getByTestId("lines").props.children).not.toContain("productId");
  });

  test("a checkout clear during an in-flight pull is not undone by the stale response", async () => {
    mockAuthState.user = { id: 1, name: "A", email: "a@capella.test" };
    mockAuthState.accessToken = "token-1";
    let resolvePull;
    mockFetchCustomerCart.mockImplementation(() => new Promise((resolve) => { resolvePull = resolve; }));

    const view = renderCart();
    await waitFor(() => expect(mockFetchCustomerCart).toHaveBeenCalled());

    fireEvent.press(view.getByRole("button", { name: "Clear" }));

    resolvePull([productLine(1)]);
    await waitFor(() => expect(mockFetchCustomerCart).toHaveBeenCalled());
    await waitFor(() => expect(view.getByTestId("count").props.children).toBe("0"));
    expect(view.getByTestId("lines").props.children).toBe("[]");
  });

  test("serializes uploads and sends only the latest snapshot once the in-flight PUT settles", async () => {
    mockAuthState.user = { id: 1, name: "A", email: "a@capella.test" };
    mockAuthState.accessToken = "token-1";
    mockFetchCustomerCart.mockResolvedValue([]);
    let resolvePut;
    mockReplaceCustomerCart.mockImplementationOnce(() => new Promise((resolve) => { resolvePut = resolve; }));

    const view = renderCart();
    await waitFor(() => expect(mockFetchCustomerCart).toHaveBeenCalledWith("token-1"));
    await waitFor(() => expect(mockReplaceCustomerCart).toHaveBeenCalledTimes(1));

    fireEvent.press(view.getByRole("button", { name: "Add" }));
    fireEvent.press(view.getByRole("button", { name: "Add" }));
    // The first PUT is still in flight, so no second request is issued yet.
    expect(mockReplaceCustomerCart).toHaveBeenCalledTimes(1);

    resolvePut([]);
    await waitFor(() => expect(mockReplaceCustomerCart).toHaveBeenCalledTimes(2));
    // Only the latest coalesced snapshot is sent once the active request completes.
    expect(mockReplaceCustomerCart.mock.calls[1][1]).toEqual([productLine(4)]);
  });

  test("ignores account A's pull when account changes during its storage reads", async () => {
    const originalGet = AsyncStorage.getItem.getMockImplementation();
    let resolvePending;
    let blocked = false;
    jest.spyOn(AsyncStorage, "getItem").mockImplementation(key => {
      if (key === CART_PENDING_STORAGE_KEY && !blocked) {
        blocked = true; return new Promise(resolve => { resolvePending = resolve; });
      }
      return originalGet(key);
    });
    function Harness() {
      const [account, setAccount] = React.useState(1);
      mockAuthState.user = { id: account, name: `U${account}`, email: `u${account}@capella.test` };
      mockAuthState.accessToken = `token-${account}`;
      return <View><CartProvider><CartProbe /></CartProvider><Button title="Switch" onPress={() => setAccount(2)} /></View>;
    }
    mockFetchCustomerCart.mockImplementation(token => Promise.resolve(token === "token-1" ? [productLine(9)] : []));
    const view = render(<Harness />);
    await waitFor(() => expect(resolvePending).toBeDefined());
    fireEvent.press(view.getByRole("button", { name: "Switch" }));
    await waitFor(() => expect(mockFetchCustomerCart).toHaveBeenCalledWith("token-2"));
    await act(async () => resolvePending(null));
    await waitFor(() => expect(view.getByTestId("count").props.children).toBe("0"));
    expect(view.getByTestId("lines").props.children).toBe("[]");
  });

  test("switching accounts clears the old cart even if the new pull is offline", async () => {
    function Harness() {
      const [account, setAccount] = React.useState(1);
      mockAuthState.user = { id: account, name: `U${account}`, email: `u${account}@capella.test` };
      mockAuthState.accessToken = `token-${account}`;
      return <View><CartProvider><CartProbe /></CartProvider><Button title="Switch" onPress={() => setAccount(2)} /></View>;
    }
    mockFetchCustomerCart.mockImplementation(token => token === "token-1" ? Promise.resolve([productLine(2)]) : Promise.reject(new Error("offline")));
    mockReplaceCustomerCart.mockImplementation(async (_token, lines) => lines);
    const view = render(<Harness />);
    await waitFor(() => expect(view.getByTestId("count").props.children).toBe("2"));
    fireEvent.press(view.getByRole("button", { name: "Switch" }));
    await waitFor(() => expect(mockFetchCustomerCart).toHaveBeenCalledWith("token-2"));
    expect(view.getByTestId("count").props.children).toBe("0");
  });

  test("an old-account upload cannot replace the new account's sync snapshot", async () => {
    let completeOldUpload;
    function Harness() {
      const [account, setAccount] = React.useState(1);
      mockAuthState.user = { id: account, name: `U${account}`, email: `u${account}@capella.test` };
      mockAuthState.accessToken = `token-${account}`;
      return <View><CartProvider><CartProbe /></CartProvider><Button title="Switch" onPress={() => setAccount(2)} /></View>;
    }
    mockFetchCustomerCart.mockImplementation(token => Promise.resolve(token === "token-1" ? [productLine(2)] : []));
    mockReplaceCustomerCart.mockImplementation(token => token === "token-1" ? new Promise(resolve => { completeOldUpload = resolve; }) : new Promise(() => {}));
    const view = render(<Harness />);
    await waitFor(() => expect(completeOldUpload).toBeDefined());
    fireEvent.press(view.getByRole("button", { name: "Switch" }));
    await waitFor(() => expect(view.getByTestId("count").props.children).toBe("0"));
    await act(async () => completeOldUpload([productLine(2)]));
    expect(JSON.parse(await AsyncStorage.getItem(CART_SYNCED_STORAGE_KEY))).toEqual([]);
  });
});
