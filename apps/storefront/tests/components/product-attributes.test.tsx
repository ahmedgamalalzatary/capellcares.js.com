import { createElement } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getDict, type Product } from "@capella/shared";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/products",
  useSearchParams: () => new URLSearchParams()
}));
vi.mock("@/components/products/product-card", () => ({
  ProductCard: ({ product }: any) => createElement("div", { "data-testid": "card" }, product.name.en)
}));

import { ProductGrid } from "@/components/products/grid/product-grid";
import { ProductAttributeLinks } from "@/components/products/product-attribute-links";
import { ProductAttributesProvider } from "@/components/providers/product-attributes-provider";

const dict = getDict("en");
const attributes = {
  ageGroups: [
    { id: 1, slug: "3-5", name: { ar: "٣-٥", en: "3-5 years" } },
    { id: 2, slug: "6-8", name: { ar: "٦-٨", en: "6-8 years" } },
    { id: 3, slug: "unused", name: { ar: "غير", en: "Unused" } }
  ]
};

const product = (id: number, over: Partial<Product>) => ({
  id, slug: `p${id}`, name: { ar: `${id}`, en: `Toy ${id}` }, description: { ar: "", en: "" },
  categoryId: 1, status: "active", variants: [{ id, size: "One", price: 100, stock: 3 }],
  ageGroupIds: [], ...over
}) as unknown as Product;

const products = [
  product(1, { ageGroupIds: [1] }),
  product(2, { ageGroupIds: [2] })
];

function renderGrid(extra: object = {}) {
  render(
    <ProductAttributesProvider value={attributes}>
      <ProductGrid products={products} categories={[]} lang="en" dict={dict} {...extra} />
    </ProductAttributesProvider>
  );
  return within(screen.getByRole("dialog", { hidden: true }));
}
const cards = () => screen.getAllByTestId("card").map((el) => el.textContent);

describe("product list filters", () => {
  it("narrows the list by age", () => {
    const panel = renderGrid();
    fireEvent.click(panel.getByRole("button", { name: "6-8 years", hidden: true }));
    expect(cards()).toEqual(["Toy 2"]);
  });

  it("has no brand or character filter", () => {
    renderGrid();
    expect(screen.queryByText(/^(Brand|Character)$/)).toBeNull();
  });

  it("only offers choices that some listed product has", () => {
    const panel = renderGrid();
    expect(panel.queryByRole("button", { name: "Unused", hidden: true })).toBeNull();
  });

  it("clears the choices", () => {
    const panel = renderGrid();
    fireEvent.click(panel.getByRole("button", { name: "3-5 years", hidden: true }));
    fireEvent.click(panel.getByRole("button", { name: dict.common.clear, hidden: true }));
    expect(cards()).toEqual(["Toy 1", "Toy 2"]);
  });
});

describe("product page details", () => {
  it("names the ages", () => {
    render(
      <ProductAttributesProvider value={attributes}>
        <ProductAttributeLinks product={products[0]!} lang="en" dict={dict} />
      </ProductAttributesProvider>
    );
    expect(screen.getByText("3-5 years")).toBeInTheDocument();
    expect(screen.queryByText("6-8 years")).toBeNull();
  });

  it("shows nothing for a product with none of them", () => {
    const { container } = render(
      <ProductAttributesProvider value={attributes}>
        <ProductAttributeLinks product={product(9, {})} lang="en" dict={dict} />
      </ProductAttributesProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });
});
