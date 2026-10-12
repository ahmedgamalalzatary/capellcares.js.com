const React = require("react");
const { View } = require("react-native");
const { render, fireEvent, act } = require("@testing-library/react-native");
let mockLanguage = "en";
jest.mock("../../src/lib/lang", () => ({ useLang: () => ({ lang: mockLanguage,
  dict: require("@capella/shared").getDict(mockLanguage), isRtl: mockLanguage === "ar" }) }));
jest.mock("../../src/lib/policy", () => ({ usePolicy: () => ({ recommendedUpdate: null }) }));
jest.mock("expo-image", () => ({ Image: props => require("react").createElement(require("react-native").Image, props) }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: props => require("react").createElement(require("react-native").View, props) }));
jest.mock("@expo/vector-icons", () => ({ Feather: props => require("react").createElement(require("react-native").View, props) }));
jest.mock("react-native-paper/lib/commonjs/components/MaterialCommunityIcon", () => () => null);
jest.mock("expo-video", () => ({ useVideoPlayer: jest.fn(), VideoView: require("react-native").View }));
jest.mock("react-native-webview", () => ({ WebView: require("react-native").View }));

function components() {
  try { return require("../../src/components"); } catch (error) {
    if (error.code === "MODULE_NOT_FOUND") return {};
    throw error;
  }
}
beforeEach(() => { mockLanguage = "en"; });
afterEach(async () => { await act(async () => {}); });

test("button disables repeated async actions and recovers from failure without exposing raw errors", async () => {
  const { Button } = components(); expect(typeof Button).toBe("function");
  let reject; let attempts = 0;
  const view = render(<Button label="Save" onPress={() => { attempts++; return new Promise((_r, j) => { reject = j; }); }} />);
  fireEvent.press(view.getByRole("button", { name: "Save" }));
  fireEvent.press(view.getByRole("button", { name: "Save" }));
  expect(attempts).toBe(1);
  expect(view.getByRole("button").props.accessibilityState.disabled).toBe(true);
  expect(view.getByRole("button").props.accessibilityHint).toBe("Loading…");
  await act(async () => reject(new Error("private server detail")));
  expect(view.getByRole("alert")).toBeTruthy();
  expect(view.queryByText("private server detail")).toBeNull();
  fireEvent.press(view.getByRole("button", { name: "Save" }));
  expect(attempts).toBe(2);
});

test("input has a persistent label and readable validation hint", () => {
  const { Input } = components(); expect(typeof Input).toBe("function");
  const view = render(<Input label="Email" value="bad" error="Enter a valid email" onChangeText={() => {}} />);
  expect(view.getByLabelText("Email").props.accessibilityHint).toBe("Enter a valid email");
  expect(view.getByRole("alert").props.children).toBe("Enter a valid email");
});

test("quantity controls enforce stock boundaries and announce their value", () => {
  const { QtyStepper } = components(); expect(typeof QtyStepper).toBe("function");
  let quantity = 1;
  function Harness() { const [q, setQ] = React.useState(1); return <QtyStepper value={q} max={2} onChange={n => { quantity = n; setQ(n); }} />; }
  const view = render(<Harness />);
  fireEvent.press(view.getByRole("button", { name: "Decrease quantity" })); expect(quantity).toBe(1);
  fireEvent.press(view.getByRole("button", { name: "Increase quantity" })); expect(quantity).toBe(2);
  fireEvent.press(view.getByRole("button", { name: "Increase quantity" })); expect(quantity).toBe(2);
  expect(view.getByLabelText("Quantity").props.accessibilityValue.now).toBe(2);
});

test("price keeps original and discounted amounts readable in both languages", () => {
  const { PriceText } = components(); expect(typeof PriceText).toBe("function");
  const view = render(<PriceText amount={90} original={100} />);
  expect(view.getByText(/^EGP\s*90$/)).toBeTruthy(); expect(view.getByText(/^EGP\s*100$/)).toBeTruthy();
  mockLanguage = "ar"; view.rerender(<PriceText amount={90} original={100} />);
  expect(view.getByText(/٩٠.*ج\.م/)).toBeTruthy();
});

test("rating is one readable accessibility value rather than five focus targets", () => {
  const { RatingStars } = components(); expect(typeof RatingStars).toBe("function");
  const view = render(<RatingStars rating={4.5} count={8} />);
  expect(view.getByLabelText("4.5 out of 5, 8 reviews")).toBeTruthy();
});

test("image uses the other language as fallback and offers retry after failure", () => {
  const { MediaImage } = components(); expect(typeof MediaImage).toBe("function");
  mockLanguage = "ar";
  const view = render(<MediaImage media={{ type: "image", arUrl: null, enUrl: "https://cdn.example.com/product.jpg" }} label="Serum" />);
  expect(view.getByLabelText("Serum").props.source.uri).toBe("https://cdn.example.com/product.jpg");
  fireEvent(view.getByLabelText("Serum"), "error", { error: "private" });
  expect(view.getByRole("alert")).toBeTruthy();
  fireEvent.press(view.getByRole("button", { name: "حاول مرة أخرى" }));
  expect(view.getByLabelText("Serum")).toBeTruthy();
});

test("product card selects the cheapest in-stock variant and respects existing quantity", () => {
  const { ProductCard } = components(); expect(typeof ProductCard).toBe("function");
  const product = { id: 1, slug: "serum", name: { ar: "سيروم", en: "Serum" }, imagePath: "", media: [],
    isNew: true, isBestseller: false, variants: [{ id: 1, productId: 1, size: "30ml", price: 10, stock: 0 },
      { id: 2, productId: 1, size: "50ml", price: 20, stock: 2 }] };
  let chosen;
  const view = render(<ProductCard product={product} onOpen={() => {}} onAdd={variant => { chosen = variant.id; }} />);
  fireEvent.press(view.getByRole("button", { name: "Add to cart" })); expect(chosen).toBe(2);
  view.rerender(<ProductCard product={product} quantity={2} onOpen={() => {}} onQuantityChange={() => {}} />);
  expect(view.getByRole("button", { name: "Increase quantity" }).props.accessibilityState.disabled).toBe(true);
});

test("selection controls expose selected state and preserve stable values", () => {
  const { ChoiceGroup } = components(); expect(typeof ChoiceGroup).toBe("function");
  let selected;
  const view = render(<ChoiceGroup label="Sort" value="price" options={[{ value: "name", label: "Name" }, { value: "price", label: "Price" }]}
    onChange={value => { selected = value; }} />);
  expect(view.getByRole("radio", { name: "Price" }).props.accessibilityState.checked).toBe(true);
  fireEvent.press(view.getByRole("radio", { name: "Name" })); expect(selected).toBe("name");
});

test("empty and error states give a real recovery action", () => {
  const { EmptyState, ErrorState } = components(); expect(typeof EmptyState).toBe("function");
  let retried = false;
  const view = render(<View><EmptyState title="No results" description="Try another search" /><ErrorState message="Couldn't load products"
    onRetry={() => { retried = true; }} /></View>);
  expect(view.getByText("Try another search")).toBeTruthy();
  fireEvent.press(view.getByRole("button", { name: "Try again" })); expect(retried).toBe(true);
});

test("share passes a safe public link and rejects script URLs", async () => {
  const { ShareButton } = components(); expect(typeof ShareButton).toBe("function");
  const sent = [];
  jest.spyOn(require("react-native").Share, "share").mockImplementation(async data => { sent.push(data); return { action: "sharedAction" }; });
  const view = render(<ShareButton title="Serum" url="https://capellacares.com/en/products/serum" />);
  await act(async () => fireEvent.press(view.getByRole("button", { name: "Share" })));
  expect(sent[0].message).toContain("https://capellacares.com/en/products/serum");
  view.rerender(<ShareButton title="Serum" url="javascript:alert(1)" />);
  await act(async () => fireEvent.press(view.getByRole("button", { name: "Share" })));
  expect(sent).toHaveLength(1); expect(view.getByRole("alert")).toBeTruthy();
});
