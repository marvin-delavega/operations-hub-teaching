import Link from "next/link";

export default function Page() {
  return (
    <main className="mx-auto max-w-screen-md space-y-4 p-6">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="type-body text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Home
        </Link>
        <h1 className="type-page-title">Transfer</h1>
      </div>
      <p className="type-body text-muted-foreground">Coming soon</p>
    </main>
  );
}
