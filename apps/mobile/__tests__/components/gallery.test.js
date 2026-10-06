const React = require("react");
const { AppState } = require("react-native");
const { render, fireEvent, act } = require("@testing-library/react-native");
jest.mock("../../src/lib/api/base", () => ({ API_BASE: "https://api.example.com" }));
jest.mock("../../src/lib/lang", () => ({ useLang: () => ({ lang: "en", dict: require("@capella/shared").getDict("en") }) }));
jest.mock("../../src/lib/policy", () => ({ usePolicy: () => ({ recommendedUpdate: null }) }));
jest.mock("expo-image", () => ({ Image: props => require("react").createElement(require("react-native").Image, props) }));
jest.mock("@expo/vector-icons", () => ({ Feather: props => require("react").createElement(require("react-native").View, props) }));
const mockListeners = new Map();
const mockPlayer = { status: "readyToPlay", playing: false,
  pause() { this.playing = false; }, play() { this.playing = true; },
  async replaceAsync() { this.status = "readyToPlay"; mockListeners.get("statusChange")?.({ status: "readyToPlay" }); },
  addListener(event, listener) { mockListeners.set(event, listener); return { remove: () => mockListeners.delete(event) }; }
};
jest.mock("expo-video", () => ({ useVideoPlayer: () => mockPlayer,
  VideoView: props => require("react").createElement(require("react-native").View, props) }));
jest.mock("react-native-webview", () => ({ WebView: props => require("react").createElement(require("react-native").View, props) }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: props => require("react").createElement(require("react-native").View, props) }));
function components() { try { return require("../../src/components"); } catch (e) { if (e.code === "MODULE_NOT_FOUND") return {}; throw e; } }
beforeEach(() => { mockPlayer.status = "readyToPlay"; mockPlayer.playing = false; mockListeners.clear(); });
afterEach(async () => { await act(async () => {}); jest.restoreAllMocks(); });

test("gallery navigation changes the selected image and full-screen closes back to the same item", () => {
  const { MediaGallery } = components(); expect(typeof MediaGallery).toBe("function");
  const view = render(<MediaGallery label="Serum" media={[
    { type: "image", arUrl: null, enUrl: "https://cdn.example.com/first.jpg" },
    { type: "image", arUrl: null, enUrl: "https://cdn.example.com/second.jpg" }
  ]} />);
  fireEvent.press(view.getByRole("button", { name: "Next media" }));
  expect(view.getByLabelText("Serum").props.source.uri).toBe("https://cdn.example.com/second.jpg");
  fireEvent.press(view.getByRole("button", { name: "View full screen" }));
  fireEvent.press(view.getByRole("button", { name: "Close" }));
  expect(view.getByLabelText("Serum").props.source.uri).toBe("https://cdn.example.com/second.jpg");
});

test("file playback stays paused until requested and stops when hidden or backgrounded", async () => {
  const { VideoPanel } = components(); expect(typeof VideoPanel).toBe("function");
  const listener = jest.spyOn(AppState, "addEventListener");
  const item = { kind: "file", url: "https://cdn.example.com/video.mp4" };
  const view = render(<VideoPanel item={item} label="Video" active />);
  expect(mockPlayer.playing).toBe(false);
  fireEvent.press(view.getByRole("button", { name: "Play video" })); expect(mockPlayer.playing).toBe(true);
  view.rerender(<VideoPanel item={item} label="Video" active={false} />); expect(mockPlayer.playing).toBe(false);
  view.rerender(<VideoPanel item={item} label="Video" active />);
  fireEvent.press(view.getByRole("button", { name: "Play video" }));
  await act(async () => listener.mock.calls.find(([name]) => name === "change")[1]("background"));
  expect(mockPlayer.playing).toBe(false);
});

test("a playback error shows useful retry and does not expose native error details", async () => {
  const { VideoPanel } = components(); expect(typeof VideoPanel).toBe("function");
  const view = render(<VideoPanel item={{ kind: "file", url: "https://cdn.example.com/video.mp4" }} label="Video" active />);
  await act(async () => mockListeners.get("statusChange")({ status: "error", error: { message: "private decoder" } }));
  expect(view.getByRole("alert")).toBeTruthy(); expect(view.queryByText("private decoder")).toBeNull();
  await act(async () => fireEvent.press(view.getByRole("button", { name: "Try again" })));
  expect(view.queryByRole("alert")).toBeNull();
});

test("linked players are not mounted until play and are removed when hidden", () => {
  const { VideoPanel } = components(); expect(typeof VideoPanel).toBe("function");
  const item = { kind: "embed", provider: "youtube", url: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", thumbnail: null };
  const view = render(<VideoPanel item={item} label="Linked video" active />);
  expect(view.queryByLabelText("Linked video")).toBeNull();
  fireEvent.press(view.getByRole("button", { name: "Play video" }));
  expect(view.getByLabelText("Linked video")).toBeTruthy();
  view.rerender(<VideoPanel item={item} label="Linked video" active={false} />);
  expect(view.queryByLabelText("Linked video")).toBeNull();
});
