import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "MANDATE — trust-minimized AI money management",
  description:
    "Randomly-drawn bonded TEE guardian committee attests cross-chain facts. Bond = insurance.",
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
          MANDATE · NEAR Hackathon demo · data source is mock unless
          NEXT_PUBLIC_MOCK=0
        </footer>
      </body>
    </html>
  );
}
