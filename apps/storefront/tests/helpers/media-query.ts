import { vi } from "vitest";
import { CARD_SLIDER_MEDIA_QUERY } from "@/constants/ui";

/** Makes the page look like a touch or small screen, where storefront cards swipe through their pictures. The setup file restores the desktop stub before the next case. */
export function useCardSliderScreen() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === CARD_SLIDER_MEDIA_QUERY,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));
}
