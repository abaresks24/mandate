import type { Metadata } from "next";
import "./globals.css";
import "@near-wallet-selector/modal-ui/styles.css";
import { Toaster } from "sonner";
import { WalletProvider } from "@/components/wallet/WalletProvider";

export const metadata: Metadata = {
  title: "YieldAI — agent-managed yield, bounded on-chain",
  description:
    "An AI agent earns yield inside limits you set on-chain. The contract rejects anything out of bounds, and cross-chain facts are verified by a bonded guardian committee.",
  metadataBase: new URL("https://mandate.example"),
  openGraph: {
    title: "YieldAI — agent-managed yield, bounded on-chain",
    description:
      "An AI agent earns yield inside on-chain limits. The contract enforces the rules; a bonded committee verifies cross-chain facts.",
    siteName: "YieldAI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "YieldAI — agent-managed yield, bounded on-chain",
    description:
      "An AI agent earns yield inside limits you set on-chain, verified by a bonded guardian committee.",
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
