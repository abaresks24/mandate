import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "MANDATE — trust-minimized AI money management",
  description:
    "Randomly-drawn bonded TEE guardian committee attests cross-chain facts. Bond = insurance.",
  metadataBase: new URL("https://mandate.example"),
  openGraph: {
    title: "MANDATE — trust-minimized AI money management",
    description:
      "An AI agent proposes templated actions; a bond-weighted TEE guardian committee attests cross-chain facts the contract can't read. Lie and get slashed.",
    siteName: "MANDATE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MANDATE — trust-minimized AI money management",
    description:
      "Bond-weighted TEE guardian committee attests cross-chain facts. Bond = insurance.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="max-w-6xl mx-auto px-5 py-8">{children}</main>
        <footer className="max-w-6xl mx-auto px-5 py-10 text-xs text-slate-600">
          MANDATE · NEAR Hackathon demo · reads live from
          coordinator.mandate-arthur.testnet + demo.vaults.mandate-arthur.testnet
          · set NEXT_PUBLIC_MOCK=1 for the offline mock
        </footer>
      </body>
    </html>
  );
}
