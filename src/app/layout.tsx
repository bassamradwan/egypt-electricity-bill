import type { Metadata } from "next";
import { Readex_Pro } from "next/font/google";
import "./globals.css";

// One family for Arabic and English text.
const readex = Readex_Pro({
  variable: "--font-readex",
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  title: "حاسبة فاتورة الكهرباء | Egyptian electricity bill calculator",
  description:
    "احسب فاتورة الكهرباء المنزلية في مصر شريحة شريحة، واعرف لماذا تقفز عند ١٠٠ و٦٥٠ و١٠٠٠ كيلووات. Calculate an Egyptian home electricity bill tier by tier.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${readex.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
