import type { Metadata } from "next";
import { Bodoni_Moda, Libre_Caslon_Text, Courier_Prime } from "next/font/google";
import "./globals.css";

// Display: the newspaper's didone. Masthead, headings, plate titles.
const bodoniModa = Bodoni_Moda({
  variable: "--font-bodoni-moda",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

// Text: the broadsheet's body face. Caslon is the historic standard for
// 18th–19th century newspaper composition.
const libreCaslon = Libre_Caslon_Text({
  variable: "--font-libre-caslon",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

// Mono: the ticker's own type. Reserved for the tape, addresses, and
// transaction hashes — never a general-purpose UI label face.
const courierPrime = Courier_Prime({
  variable: "--font-courier-prime",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Clockwork",
  description:
    "Trade tokenized equities on Robinhood Chain. Routed through public Uniswap V3/V4 pools, settled straight to your wallet — no custody, no accounts.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bodoniModa.variable} ${libreCaslon.variable} ${courierPrime.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
