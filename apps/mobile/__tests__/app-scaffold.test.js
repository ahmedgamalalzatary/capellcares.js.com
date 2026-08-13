const { existsSync } = require("node:fs");
const path = require("node:path");
const { render } = require("@testing-library/react-native");

jest.mock("@capella/shared", () => ({
  getDict: jest.fn((locale) => ({
    brand: locale === "ar" ? "Capella Arabic brand" : "Capella non-Arabic brand"
  }))
}));

const { getDict } = require("@capella/shared");

describe("Expo Router scaffold", () => {
  test.each(["_layout.tsx", "index.tsx"])("provides app/%s", (route) => {
    expect(existsSync(path.resolve(__dirname, "../app", route))).toBe(true);
  });

  test("renders the shared Arabic brand on the placeholder screen", async () => {
    const HomeScreen = require("../app/index").default;

    const view = await render(<HomeScreen />);

    expect(getDict).toHaveBeenCalledWith("ar");
    expect(view.getByText("Capella Arabic brand")).toBeTruthy();
  });
});
