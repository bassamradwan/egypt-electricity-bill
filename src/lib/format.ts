import type { Lang } from "./i18n";

// Arabic uses Arabic-Indic digits (٠١٢٣), like an Egyptian bill; English uses 0123.
const LOCALE: Record<Lang, string> = { ar: "ar-EG", en: "en-US" };

// No thousands separator in Arabic: in many fonts "٬" (thousands) and "٫" (decimal) look
// alike, so ١٬٣٩٢٫١٠ reads as three groups. ١٣٩٢٫١٠ has only one separator.
const groupsThousands = (lang: Lang) => lang === "en";

export function formatNumber(value: number, lang: Lang): string {
  return new Intl.NumberFormat(LOCALE[lang], { useGrouping: groupsThousands(lang) }).format(value);
}

/** 36960 piasters → "٣٦٩٫٦٠" / "369.60": the amount in pounds, without the currency. */
export function formatAmount(piasters: number, lang: Lang): string {
  return new Intl.NumberFormat(LOCALE[lang], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: groupsThousands(lang),
  }).format(piasters / 100);
}

/** 139210 piasters → "١٣٩٢٫١٠ جنيه" / "EGP 1,392.10". */
export function formatMoney(piasters: number, lang: Lang): string {
  const amount = formatAmount(piasters, lang);
  return lang === "ar" ? `${amount} جنيه` : `EGP ${amount}`;
}

/** A whole number written with the language's digits and no separators, for input fields: 650 → "٦٥٠". */
export function plainDigits(value: number, lang: Lang): string {
  const glyphs = digitGlyphs(lang);
  return String(value).replace(/\d/g, (d) => glyphs[Number(d)]!);
}

/** The ten digit glyphs for the meter's drums. */
export function digitGlyphs(lang: Lang): string[] {
  return lang === "ar" ? [..."٠١٢٣٤٥٦٧٨٩"] : [..."0123456789"];
}
