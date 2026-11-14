import { AppTopBar } from "@/components/AppTopBar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppTopBar />
      {/* A parchment "sheet" laid on the red desk — keeps the data UI readable. */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="sheet px-5 py-8 sm:px-10 sm:py-12">{children}</div>
      </main>
    </div>
  );
}
