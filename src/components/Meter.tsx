import { digitGlyphs, formatNumber } from "@/lib/format";
import type { Lang } from "@/lib/i18n";

const DRUMS = 5;
const ROW = 1.25; // height of one digit on a drum, in em

/**
 * The month's consumption on number drums, like the counter of an electricity meter.
 * Each drum is a column of the ten digits that slides to show the right one.
 */
export function Meter({ kwh, lang, unit }: { kwh: number | null; lang: Lang; unit: string }) {
  const glyphs = digitGlyphs(lang);
  const digits = kwh === null ? null : String(Math.min(kwh, 10 ** DRUMS - 1)).padStart(DRUMS, "0");
  // Leading zeros are dimmed so the real number stands out ("00000" keeps its last zero bright).
  const firstNonZero = digits === null ? -1 : digits.search(/[1-9]/);
  const firstSignificant = firstNonZero === -1 ? DRUMS - 1 : firstNonZero;

  return (
    <figure className="rounded-2xl border border-line bg-surface px-5 pb-4 pt-5">
      {/* Numbers read left to right in Arabic too. */}
      <div dir="ltr" aria-hidden="true" className="flex justify-center gap-1.5 text-[3.4rem] font-medium leading-none sm:text-7xl">
        {Array.from({ length: DRUMS }, (_, i) => {
          const digit = digits === null ? null : Number(digits[i]);
          return (
            <div
              key={i}
              className={`relative w-[0.95em] overflow-hidden rounded-lg bg-drum text-drum-digit ${i < firstSignificant ? "opacity-45" : ""}`}
              style={{ height: `${ROW}em` }}
            >
              {digit === null ? (
                <span className="flex h-full items-center justify-center">–</span>
              ) : (
                <div className="drum-column flex flex-col" style={{ transform: `translateY(-${digit * ROW}em)` }}>
                  {glyphs.map((g) => (
                    <span key={g} className="flex items-center justify-center tabular-nums" style={{ height: `${ROW}em` }}>
                      {g}
                    </span>
                  ))}
                </div>
              )}
              {/* Shading at the top and bottom, so each window reads as a turning drum. */}
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgb(0_0_0/0.5),transparent_32%,transparent_68%,rgb(0_0_0/0.5))]" />
            </div>
          );
        })}
      </div>
      <figcaption className="mt-3 text-center text-sm text-muted">
        <span className="sr-only">{kwh === null ? "" : formatNumber(kwh, lang)} </span>
        {unit}
      </figcaption>
    </figure>
  );
}
