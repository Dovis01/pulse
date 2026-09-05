import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-[400px] flex-col justify-center px-6">
      <div className="meta-label">404</div>
      <h1 className="display-headline mt-3 text-foreground">Nothing here.</h1>
      <p className="meta-mono mt-3 text-[12px] text-secondary">
        The story may have been pruned by the retention policy.
      </p>
      <Link href="/" className="meta-mono mt-6 text-[12px] text-secondary underline decoration-border underline-offset-4 hover:text-foreground">
        ← Back to Today
      </Link>
    </div>
  );
}
