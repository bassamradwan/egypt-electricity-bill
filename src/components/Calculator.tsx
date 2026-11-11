"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { BillChart } from "./BillChart";
import { BillLines } from "./BillLines";
import { Meter } from "./Meter";
import {
  calculateBill,
  consumptionFromReadings,
  maxKwhForBudget,
  parseWholeNumber,
  thresholdInsight,
} from "@/lib/bill";
import { formatMoney, formatNumber, plainDigits } from "@/lib/format";
import { translate, type Lang, type MessageKey } from "@/lib/i18n";
import { CURRENT_TARIFF } from "@/lib/tariff";
import { groupLimits } from "@/lib/tiers";

type Mode = "kwh" | "readings" | "budget";
const MODES: Mode[] = ["kwh", "readings", "budget"];
const MODE_LABEL: Record<Mode, MessageKey> = { kwh: "modeKwh", readings: "modeReadings", budget: "modeBudget" };

const MAX_KWH = 99_999; // what the meter's five drums can show, far above any home
const LANG_KEY = "electricity-bill-lang";

/** What the person typed, kept as text so a half-typed number is never lost. */
interface Inputs {
  mode: Mode;
  kwh: string;
  previous: string;
  current: string;
  budget: string;
}

// The page opens on 651 kWh: one kWh past a limit, so the jump shows straight away.
const DEFAULTS: Inputs = { mode: "kwh", kwh: "651", previous: "12000", current: "12651", budget: "1000" };

type Outcome = { kwh: number; budgetPiasters?: number } | { error: MessageKey };

/** The month's consumption from the inputs of the chosen mode, or why it can't be worked out. */
function evaluate(inputs: Inputs): Outcome {
  if (inputs.mode === "kwh") {
    const kwh = parseWholeNumber(inputs.kwh);
    if (kwh === null) return { error: "errorNumber" };
    return kwh > MAX_KWH ? { error: "errorTooLarge" } : { kwh };
  }
  if (inputs.mode === "readings") {
    const previous = parseWholeNumber(inputs.previous);
    const current = parseWholeNumber(inputs.current);
    if (previous === null || current === null) return { error: "errorNumber" };
    const result = consumptionFromReadings(previous, current);
    if (!result.ok) return { error: "errorReadings" };
    return result.kwh > MAX_KWH ? { error: "errorTooLarge" } : { kwh: result.kwh };
  }
  const egp = parseWholeNumber(inputs.budget);
  if (egp === null) return { error: "errorNumber" };
  const kwh = maxKwhForBudget(egp * 100);
  return kwh > MAX_KWH ? { error: "errorTooLarge" } : { kwh, budgetPiasters: egp * 100 };
}

/** A shared link (?kwh=651, ?prev=..&curr=.., ?budget=.., &lang=en) back into inputs. */
function readLink(search: string): { inputs: Inputs; lang: Lang | null } {
  const p = new URLSearchParams(search);
  const mode: Mode = p.has("budget") ? "budget" : p.has("prev") || p.has("curr") ? "readings" : "kwh";
  const lang = p.get("lang");
  return {
    inputs: {
      mode,
      kwh: p.get("kwh") ?? DEFAULTS.kwh,
      previous: p.get("prev") ?? DEFAULTS.previous,
      current: p.get("curr") ?? DEFAULTS.current,
      budget: p.get("budget") ?? DEFAULTS.budget,
    },
    lang: lang === "ar" || lang === "en" ? lang : null,
  };
}

/** The typed numbers rewritten with a language's digits (٦٥١ / 651); anything unreadable stays as typed. */
function withDigitsOf(inputs: Inputs, lang: Lang): Inputs {
  const convert = (text: string) => {
    const value = parseWholeNumber(text);
    return value === null ? text : plainDigits(value, lang);
  };
  return {
    ...inputs,
    kwh: convert(inputs.kwh),
    previous: convert(inputs.previous),
    current: convert(inputs.current),
    budget: convert(inputs.budget),
  };
}

/** The inputs as a link that opens the page on the same result. */
function makeLink(inputs: Inputs, lang: Lang): string {
  const clean = (text: string) => String(parseWholeNumber(text) ?? text);
  const p = new URLSearchParams();
  if (inputs.mode === "kwh") p.set("kwh", clean(inputs.kwh));
  if (inputs.mode === "readings") {
    p.set("prev", clean(inputs.previous));
    p.set("curr", clean(inputs.current));
  }
  if (inputs.mode === "budget") p.set("budget", clean(inputs.budget));
  if (lang === "en") p.set("lang", "en");
  return `${window.location.pathname}?${p}`;
}

// The address and the saved language only exist in the browser. useSyncExternalStore gives
// the static build (and the first render in the browser) `null`, then the real value, so the
// prebuilt HTML and the first browser render always match.
const noSubscription = () => () => {};
const readSearch = () => window.location.search;
const readSavedLang = (): string | null => {
  try {
    return localStorage.getItem(LANG_KEY);
  } catch {
    return null; // storage can be blocked (private mode); Arabic is the default anyway
  }
};
const onServer = () => null;

export function Calculator() {
  const search = useSyncExternalStore(noSubscription, readSearch, onServer);
  const savedLang = useSyncExternalStore(noSubscription, readSavedLang, onServer);

  const link = search === null ? null : readLink(search);
  const saved: Lang | null = savedLang === "ar" || savedLang === "en" ? savedLang : null;

  // The key starts the calculator again once the browser values are known,
  // so its state starts from the shared link instead of the defaults.
  return (
    <CalculatorView
      key={search === null ? "static" : "browser"}
      initialInputs={link?.inputs ?? DEFAULTS}
      initialLang={link?.lang ?? saved ?? "ar"}
      inBrowser={search !== null}
    />
  );
}

function CalculatorView({
  initialInputs,
  initialLang,
  inBrowser,
}: {
  initialInputs: Inputs;
  initialLang: Lang;
  inBrowser: boolean;
}) {
  const [inputs, setInputs] = useState<Inputs>(() => withDigitsOf(initialInputs, initialLang));
  const [lang, setLang] = useState<Lang>(initialLang);
  const [copied, setCopied] = useState(false);

  // The page's language and direction follow the toggle.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.title = translate(lang, "pageTitle");
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      // Not saved: the toggle still works for this visit.
    }
  }, [lang]);

  // Keep the address bar in step, so copying it shares the same result.
  useEffect(() => {
    if (inBrowser) window.history.replaceState(null, "", makeLink(inputs, lang));
  }, [inputs, lang, inBrowser]);

  const outcome = useMemo(() => evaluate(inputs), [inputs]);
  const kwh = "kwh" in outcome ? outcome.kwh : null;
  const bill = useMemo(() => (kwh === null ? null : calculateBill(kwh)), [kwh]);
  const insight = useMemo(() => (kwh === null ? null : thresholdInsight(kwh)), [kwh]);

  const t = (key: MessageKey, vars?: Record<string, string>) => translate(lang, key, vars);
  const n = (value: number) => formatNumber(value, lang);
  const money = (piasters: number) => formatMoney(piasters, lang);

  let alert: string | null = null;
  if (insight?.previous?.near) {
    const { limit, overBy, savingPiasters } = insight.previous;
    alert = t("overLimit", { limit: n(limit), overBy: n(overBy), saving: money(savingPiasters) });
  } else if (insight?.next?.near) {
    const { limit, remaining, jumpPiasters } = insight.next;
    alert = t(remaining === 0 ? "onLimit" : "nearLimit", { limit: n(limit), remaining: n(remaining), jump: money(jumpPiasters) });
  }

  function setField(field: keyof Omit<Inputs, "mode">, value: string) {
    setInputs((current) => ({ ...current, [field]: value }));
  }

  /** The +1 / −1 buttons and the chart both set a consumption in kWh. */
  function chooseKwh(value: number) {
    const clamped = Math.min(Math.max(value, 0), MAX_KWH);
    setInputs((current) => ({ ...current, mode: "kwh", kwh: plainDigits(clamped, lang) }));
  }

  function switchLanguage() {
    const next: Lang = lang === "ar" ? "en" : "ar";
    setInputs((current) => withDigitsOf(current, next));
    setLang(next);
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: t("pageTitle"), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // The person closed the share sheet, or the clipboard is blocked: nothing to do.
    }
  }

  const error = "error" in outcome ? outcome.error : null;
  const limitsList = groupLimits()
    .map(n)
    .join(lang === "ar" ? "، " : ", ");

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between gap-4 py-5">
        <p className="font-semibold">{t("pageTitle")}</p>
        <button
          type="button"
          onClick={switchLanguage}
          lang={lang === "ar" ? "en" : "ar"}
          className="rounded-full border border-line px-4 py-1.5 text-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {t("switchLanguage")}
        </button>
      </header>

      {/* minmax(0, …): a column may shrink below its content's width (the chart is 640 units wide).
          content-start: the rows keep their height instead of sharing the screen's spare height. */}
      <main className="grid flex-1 grid-cols-[minmax(0,1fr)] content-start gap-10 pb-14 pt-2 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:pt-8">
        <section aria-labelledby="question" className="flex flex-col gap-6">
          <div>
            <h1 id="question" className="text-[2rem] font-semibold leading-tight text-balance sm:text-[2.6rem]">
              {t("question")}
            </h1>
            <p className="mt-3 max-w-[44ch] leading-relaxed text-muted">{t("intro")}</p>
          </div>

          <Meter kwh={kwh} lang={lang} unit={t("meterUnit")} />

          <div role="group" aria-label={t("modesLabel")} className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface p-1">
            {MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={inputs.mode === mode}
                onClick={() => setInputs((current) => ({ ...current, mode }))}
                className={`min-h-11 rounded-lg px-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink ${
                  inputs.mode === mode ? "bg-ink text-paper" : "text-muted hover:text-ink"
                }`}
              >
                {t(MODE_LABEL[mode])}
              </button>
            ))}
          </div>

          {inputs.mode === "kwh" && (
            <Field id="kwh" label={t("kwhLabel")}>
              {/* − on the left and + on the right in both languages, like any number stepper. */}
              <div dir="ltr" className="flex gap-2">
                <StepButton label={t("decrease")} onClick={() => chooseKwh((kwh ?? 0) - 1)}>
                  −
                </StepButton>
                <NumberInput id="kwh" value={inputs.kwh} invalid={error !== null} onChange={(v) => setField("kwh", v)} />
                <StepButton label={t("increase")} onClick={() => chooseKwh((kwh ?? 0) + 1)}>
                  +
                </StepButton>
              </div>
            </Field>
          )}

          {inputs.mode === "readings" && (
            <div className="grid grid-cols-2 gap-3">
              <Field id="previous" label={t("previousLabel")}>
                <NumberInput id="previous" value={inputs.previous} invalid={error !== null} onChange={(v) => setField("previous", v)} />
              </Field>
              <Field id="current" label={t("currentLabel")}>
                <NumberInput id="current" value={inputs.current} invalid={error !== null} onChange={(v) => setField("current", v)} />
              </Field>
            </div>
          )}

          {inputs.mode === "budget" && (
            <Field id="budget" label={t("budgetLabel")}>
              <NumberInput id="budget" value={inputs.budget} invalid={error !== null} onChange={(v) => setField("budget", v)} />
            </Field>
          )}

          {error && (
            <p id="input-error" role="alert" className="text-sm text-alert">
              {t(error)}
            </p>
          )}
        </section>

        <section aria-label={t("total")} className="flex flex-col gap-8">
          <div aria-live="polite">
            <p className="text-sm text-muted">{t("total")}</p>
            <p className="mt-1 text-5xl font-semibold tabular-nums sm:text-6xl">{bill ? money(bill.totalPiasters) : "–"}</p>
            {"budgetPiasters" in outcome && outcome.budgetPiasters !== undefined && (
              <p className="mt-3 leading-relaxed">
                {outcome.kwh === 0
                  ? t("budgetTooSmall")
                  : t("budgetResult", { budget: money(outcome.budgetPiasters), kwh: n(outcome.kwh) })}
              </p>
            )}
          </div>

          {alert && <p className="rounded-md border-s-4 border-alert bg-alert-soft px-4 py-3 leading-relaxed">{alert}</p>}

          <figure>
            <figcaption className="mb-3">
              <span className="font-medium">{t("chartTitle")}</span>
              <span className="mt-0.5 block text-sm text-muted">{t("chartHint")}</span>
            </figcaption>
            <BillChart
              kwh={kwh}
              lang={lang}
              onPick={chooseKwh}
              label={t("chartAria", { limits: limitsList })}
              units={{ money: t("chartMoneyUnit"), kwh: t("chartKwhUnit") }}
            />
          </figure>

          {bill && (
            <div>
              <h2 className="mb-2 font-medium">{t("breakdown")}</h2>
              {bill.restartedFromZero && insight?.previous && (
                <p className="mb-2 text-sm leading-relaxed text-muted">{t("restartNote", { limit: n(insight.previous.limit) })}</p>
              )}
              {bill.kwh === 0 && <p className="mb-2 text-sm text-muted">{t("zeroNote")}</p>}
              <BillLines bill={bill} lang={lang} />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={share}
              className="min-h-11 rounded-lg bg-ink px-5 text-paper hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {t("share")}
            </button>
            <span role="status" className="text-sm text-muted">
              {copied ? t("copied") : ""}
            </span>
          </div>
        </section>
      </main>

      <footer className="space-y-2 border-t border-line py-6 text-sm leading-relaxed text-muted">
        <p>
          {t("sourceNote")}{" "}
          <a href={CURRENT_TARIFF.source.url} className="underline underline-offset-4 hover:text-ink" target="_blank" rel="noreferrer">
            {t("sourceLink")}
          </a>
        </p>
        <p>{t("excludedNote")}</p>
        <p className="flex flex-wrap gap-x-5 gap-y-1">
          <a href="https://github.com/bassamradwan" className="underline underline-offset-4 hover:text-ink">
            {t("madeBy")}
          </a>
          <a href="https://github.com/bassamradwan/egypt-electricity-bill" className="underline underline-offset-4 hover:text-ink">
            {t("sourceCode")}
          </a>
        </p>
      </footer>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function NumberInput({
  id,
  value,
  invalid,
  onChange,
}: {
  id: string;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <input
      id={id}
      // Text, not type="number": number fields reject Arabic digits in some browsers.
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid}
      aria-describedby={invalid ? "input-error" : undefined}
      className="min-h-12 w-full min-w-0 flex-1 rounded-lg border border-line bg-surface px-4 text-center text-xl tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink aria-invalid:border-alert"
    />
  );
}

function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="min-h-12 w-12 shrink-0 rounded-lg border border-line bg-surface text-2xl hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink"
    >
      {children}
    </button>
  );
}
