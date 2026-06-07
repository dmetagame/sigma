import localFont from "next/font/local";

export const clash = localFont({
  src: [{ path: "./fonts/ClashDisplay-Semibold.woff2", weight: "600", style: "normal" }],
  variable: "--font-display",
  display: "swap",
});

export const satoshi = localFont({
  src: [{ path: "./fonts/Satoshi-Regular.woff2", weight: "400", style: "normal" }],
  variable: "--font-sans",
  display: "swap",
});
