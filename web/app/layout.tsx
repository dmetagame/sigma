import type { Metadata } from "next";
import { clash, satoshi } from "./fonts";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://sigma-two-iota.vercel.app"),
  title: "Sigma · on-chain risk engine",
  description:
    "Stylus-powered portfolio VaR for tokenized equity collateral on Robinhood Chain.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Sigma · on-chain risk engine",
    description:
      "Stylus-powered portfolio VaR for tokenized equity collateral on Robinhood Chain.",
    url: "/",
    siteName: "Sigma",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sigma · on-chain risk engine",
    description:
      "Stylus-powered portfolio VaR for tokenized equity collateral on Robinhood Chain.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${clash.variable} ${satoshi.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
