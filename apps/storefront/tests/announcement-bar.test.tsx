import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { AnnouncementBarDto, Language } from "@minikoshk/shared";
import { AnnouncementBar } from "@/components/header/AnnouncementBar";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";

const configuredBar: AnnouncementBarDto = {
  enabled: true,
  items: [{
    id: 10,
    text: { ar: "عرض من لوحة التحكم", en: "ERP managed offer" },
    isActive: true,
    sortOrder: 0
  }]
};

function renderBar(config: AnnouncementBarDto, lang: Language = "en") {
  return render(
    <LocaleProvider lang={lang}>
      <AnnouncementBar config={config} />
    </LocaleProvider>
  );
}

afterEach(cleanup);

describe("AnnouncementBar", () => {
  it("renders the configured translation for the current locale", () => {
    renderBar(configuredBar, "en");
    expect(screen.getAllByText("ERP managed offer").length).toBeGreaterThan(0);
    expect(screen.queryByText("عرض من لوحة التحكم")).not.toBeInTheDocument();
  });

  it("renders Arabic configured text on Arabic routes", () => {
    renderBar(configuredBar, "ar");
    expect(screen.getAllByText("عرض من لوحة التحكم").length).toBeGreaterThan(0);
    expect(screen.queryByText("ERP managed offer")).not.toBeInTheDocument();
  });

  it("renders no strip when globally disabled", () => {
    const { container } = renderBar({ ...configuredBar, enabled: false });
    expect(container).toBeEmptyDOMElement();
  });

  it("renders no strip when there are no announcements", () => {
    const { container } = renderBar({ enabled: true, items: [] });
    expect(container).toBeEmptyDOMElement();
  });
});
