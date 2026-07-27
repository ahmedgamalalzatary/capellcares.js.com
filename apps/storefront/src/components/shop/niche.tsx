import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The niche wall — the shop's signature, and its primary navigation.
 *
 * Đespacito's café (public/real-place.png) has a cream organic form cut into a
 * pink wall, with irregular blob-shaped recesses at varying sizes and heights.
 * A warm LED strip hides behind the form's wavy lip. Each recess holds exactly
 * one object, lit from above.
 *
 * This builds that wall. Each alcove holds one real product and is the entry to
 * one of the four lines the shop sells, so the motif carries the page's
 * navigation rather than decorating around it. The alcoves are deliberately
 * uneven — matching sizes and a shared baseline would read as generic category
 * tiles, which is exactly what the real wall is not.
 */

export interface Alcove {
  href: string;
  label: string;
  image: string;
  alt: string;
}

/**
 * Per-alcove geometry, transcribed from the wall: no two recesses share a
 * width, an aspect, a drop, or a corner profile. Index-keyed so the arrangement
 * is stable across renders rather than randomised.
 */
const SHAPES = [
  // Wide and flat, like the big oval recess left of centre on the real wall.
  { width: "30%", aspect: "5 / 4", drop: "8%", radius: "58% 42% 38% 62% / 62% 58% 42% 38%" },
  // Tall and narrow, sitting high.
  { width: "22%", aspect: "3 / 5", drop: "0%", radius: "42% 58% 60% 40% / 34% 38% 62% 66%" },
  // Small and nearly round, dropped low.
  { width: "19%", aspect: "1 / 1", drop: "26%", radius: "62% 38% 52% 48% / 46% 64% 36% 54%" },
  // Medium, upright, mid-height.
  { width: "25%", aspect: "4 / 5", drop: "12%", radius: "38% 62% 44% 56% / 58% 36% 64% 42%" }
] as const;

export function Niche({
  children,
  alcoves = [],
  className = ""
}: {
  /** The copy block: eyebrow, heading, description, call to action. */
  children: ReactNode;
  alcoves?: Alcove[];
  className?: string;
}) {
  return (
    // Rounded on the bottom corners only: the panel runs up to meet the header,
    // so a square top edge reads as continuous with it.
    <section className={`niche overflow-hidden rounded-b-xl ${className}`}>
      <div className="niche__form">
        {/* The LED behind the lip. Inside the form, so the clip-path cuts the
            light to the wave exactly as the real strip is cut by the plaster. */}
        <div aria-hidden className="niche__glow" />

        <div className="niche__content">
          <div className="niche__layout">
            <div className="niche__copy">{children}</div>

            {alcoves.length > 0 ? (
              <ul className="niche__shelf">
                {alcoves.slice(0, SHAPES.length).map((alcove, index) => {
                  const shape = SHAPES[index];
                  return (
                    <li
                      key={alcove.href}
                      className="alcove"
                      style={{
                        width: shape.width,
                        marginBlockStart: shape.drop,
                        animationDelay: `${420 + index * 90}ms`
                      }}
                    >
                      <Link href={alcove.href} className="alcove__link">
                        <span
                          className="alcove__recess"
                          style={{ aspectRatio: shape.aspect, borderRadius: shape.radius }}
                        >
                          <Image
                            src={alcove.image}
                            alt={alcove.alt}
                            fill
                            className="alcove__img"
                            sizes="(min-width: 1024px) 16vw, 40vw"
                          />
                          {/* Light spilling onto the object from the recess lip. */}
                          <span aria-hidden className="alcove__light" />
                        </span>
                        <span className="alcove__label">{alcove.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
