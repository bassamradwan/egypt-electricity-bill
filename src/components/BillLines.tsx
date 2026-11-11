import type { Bill } from "@/lib/bill";
import { formatMoney, formatNumber } from "@/lib/format";
import { translate, type Lang } from "@/lib/i18n";
import { priceColor } from "@/lib/tiers";

/** The bill line by line: each band, the customer service fee and the total. */
export function BillLines({ bill, lang }: { bill: Bill; lang: Lang }) {
  const n = (value: number) => formatNumber(value, lang);

  return (
    <table className="w-full border-collapse text-[0.95rem]">
      <tbody>
        {bill.lines.map((line) => (
          <tr key={line.fromKwh} className="border-b border-line">
            <td className="py-3">
              <span className="flex items-center gap-2.5">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: priceColor(line.piasters) }} />
                {translate(lang, "lineRange", { from: n(line.fromKwh), to: n(line.toKwh) })}
              </span>
              <span className="ms-5 block text-sm text-muted">
                {translate(lang, "linePrice", { kwh: n(line.kwh), price: formatMoney(line.piasters, lang) })}
              </span>
            </td>
            <td className="py-3 text-end align-top tabular-nums">{formatMoney(line.amountPiasters, lang)}</td>
          </tr>
        ))}
        <tr className="border-b border-line">
          <td className="py-3">{translate(lang, "serviceFee")}</td>
          <td className="py-3 text-end tabular-nums">{formatMoney(bill.serviceFeePiasters, lang)}</td>
        </tr>
        <tr className="font-semibold">
          <td className="pt-3">{translate(lang, "total")}</td>
          <td className="pt-3 text-end tabular-nums">{formatMoney(bill.totalPiasters, lang)}</td>
        </tr>
      </tbody>
    </table>
  );
}
