import type { Metadata } from "next";
import { clash, satoshi, geistMono } from "./fonts";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sigma · on-chain risk engine",
  description:
    "Stylus-powered portfolio VaR for tokenized equity collateral on Robinhood Chain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${clash.variable} ${satoshi.variable} ${geistMono.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
