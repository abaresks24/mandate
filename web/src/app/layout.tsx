import type { Metadata } from "next";
import "./globals.css";
import "@near-wallet-selector/modal-ui/styles.css";
import { Toaster } from "sonner";
import { WalletProvider } from "@/components/wallet/WalletProvider";

export const metadata: Metadata = {
  title: "YieldAI — earn yield you can actually trust",
  description:
    "An AI agent manages your yield within an on-chain mandate — and you never have to trust the agent. Every risky cross-chain move is verified by a randomly-drawn committee of bonded guardians. Bond is insurance.",
  metadataBase: new URL("https://mandate.example"),
  openGraph: {
    title: "YieldAI — earn yield you can actually trust",
    description:
      "An AI agent manages your yield, bounded on-chain and verified by a bonded guardian committee. Your funds stay yours.",
    siteName: "YieldAI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "YieldAI — earn yield you can actually trust",
    description:
      "An AI yield agent whose power is bounded on-chain and checked by bonded guardians.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* No bg here — the red textured field is painted by globals body::before. */}
      <body className="min-h-screen font-sans text-ink">
        <WalletProvider>{children}</WalletProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
