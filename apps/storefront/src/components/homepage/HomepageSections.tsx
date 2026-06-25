"use client";

import { useEffect, useState } from "react";
import type { HomepageBannersDto, HomepageBannerSectionDto } from "@capella/shared";

type HomepageSectionsMap = HomepageBannersDto["sections"];

function CarouselSection({
  section,
  ariaLabel,
  autoRotate
}: {
  section: HomepageBannerSectionDto;
  ariaLabel: string;
  autoRotate: boolean;
}) {
  const [index, setIndex] = useState(0);
  const total = section.items.length;

  useEffect(() => {
    if (!autoRotate || total <= 1) {
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % total);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [autoRotate, total]);

  if (total === 0) {
    return null;
  }

  const item = section.items[index] ?? section.items[0];

  return (
    <section aria-label={ariaLabel} role="region" style={{ padding: "24px 0" }}>
      <div style={{ position: "relative" }}>
        <a href={item.href}>
          <img
            src={item.imagePath}
            alt={`${ariaLabel} image ${index + 1}`}
            style={{ width: "100%", height: "clamp(280px, 48vw, 560px)", objectFit: "cover", borderRadius: 24 }}
          />
        </a>
        {total > 1 && (
          <>
            <button
              type="button"
              aria-label={`${ariaLabel} previous`}
              onClick={() => setIndex((current) => (current - 1 + total) % total)}
              style={{ position: "absolute", top: "50%", left: 16, transform: "translateY(-50%)" }}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label={`${ariaLabel} next`}
              onClick={() => setIndex((current) => (current + 1) % total)}
              style={{ position: "absolute", top: "50%", right: 16, transform: "translateY(-50%)" }}
            >
              ›
            </button>
          </>
        )}
      </div>
      {total > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
          {section.items.map((slideItem, slideIndex) => (
            <button
              key={slideItem.id}
              type="button"
              aria-label={`${ariaLabel} slide ${slideIndex + 1}`}
              onClick={() => setIndex(slideIndex)}
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                border: 0,
                background: slideIndex === index ? "#111827" : "#d1d5db"
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function GridSection({ section, ariaLabel }: { section: HomepageBannerSectionDto; ariaLabel: string }) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(section.items.length / 4));
  const visibleItems = section.items.slice(page * 4, page * 4 + 4);

  if (section.items.length === 0) {
    return null;
  }

  return (
    <section aria-label={ariaLabel} role="region" style={{ padding: "24px 0" }}>
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
        }}
      >
        {visibleItems.map((item) => (
          <a key={item.id} href={item.href}>
            <img
              src={item.imagePath}
              alt={`${ariaLabel} image ${item.id}`}
              style={{ width: "100%", height: 240, objectFit: "cover", borderRadius: 20 }}
            />
          </a>
        ))}
      </div>
      {pageCount > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 12 }}>
          <button type="button" aria-label={`${ariaLabel} previous`} onClick={() => setPage((current) => (current - 1 + pageCount) % pageCount)}>
            ‹
          </button>
          {Array.from({ length: pageCount }, (_, pageIndex) => (
            <button
              key={pageIndex}
              type="button"
              aria-label={`${ariaLabel} page ${pageIndex + 1}`}
              onClick={() => setPage(pageIndex)}
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                border: 0,
                background: pageIndex === page ? "#111827" : "#d1d5db"
              }}
            />
          ))}
          <button type="button" aria-label={`${ariaLabel} next`} onClick={() => setPage((current) => (current + 1) % pageCount)}>
            ›
          </button>
        </div>
      )}
    </section>
  );
}

function SingleSection({ section, ariaLabel }: { section: HomepageBannerSectionDto; ariaLabel: string }) {
  const item = section.items[0];
  if (!item) {
    return null;
  }

  return (
    <section aria-label={ariaLabel} role="region" style={{ padding: "24px 0" }}>
      <a href={item.href}>
        <img
          src={item.imagePath}
          alt={`${ariaLabel} image`}
          style={{ width: "100%", height: "clamp(220px, 32vw, 420px)", objectFit: "cover", borderRadius: 24 }}
        />
      </a>
    </section>
  );
}

export function HomepageSections({ sections }: { sections: HomepageSectionsMap }) {
  return (
    <div className="container">
      <CarouselSection section={sections.hero_primary} ariaLabel="Homepage hero primary" autoRotate />
      <GridSection section={sections.grid_featured} ariaLabel="Homepage featured grid" />
      <SingleSection section={sections.single_mid} ariaLabel="Homepage single middle" />
      <CarouselSection section={sections.hero_secondary} ariaLabel="Homepage hero secondary" autoRotate />
      <SingleSection section={sections.single_footer} ariaLabel="Homepage single footer" />
    </div>
  );
}
