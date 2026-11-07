import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "MANDATE — hand your money to an AI agent, without trusting it",
  description:
    "An AI agent proposes templated actions; a randomly-drawn, bonded TEE guardian committee attests cross-chain facts the contract can't read. Bond = insurance. Lie and get slashed.",
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
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark`}>
      <body className="font-sans min-h-screen flex flex-col">
        <div className="app-backdrop" aria-hidden />
        <Nav />
        <main className="w-full max-w-6xl mx-auto px-5 sm:px-6 py-10 sm:py-14 flex-1">
          {children}
        </main>
        <Footer />
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#111114",
              border: "1px solid #26262b",
              color: "#e4e4e7",
            },
          }}
        />
      </body>
    </html>
  );
}
