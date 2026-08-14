import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/80 bg-muted/30">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © {new Date().getFullYear()} NFL Edge Simulator 2026 · Entertainment &
          education only
        </p>
        <div className="flex flex-wrap gap-4">
          <Link href="/about" className="hover:text-foreground transition-colors">
            Methodology
          </Link>
          <Link href="/schedule" className="hover:text-foreground transition-colors">
            Full schedule
          </Link>
          <Link href="/teams" className="hover:text-foreground transition-colors">
            Team ratings
          </Link>
        </div>
      </div>
    </footer>
  );
}
