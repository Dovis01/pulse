"use client";

/**
 * Light/dark toggle — writes localStorage + toggles the .dark class.
 * The label is CSS-driven (dark: variant), so no state sync is needed.
 */
export function ThemeToggle() {
  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("pulse-theme", next ? "dark" : "light");
    } catch {
      /* private mode */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch theme"
      className="meta-mono rounded-sm border border-border px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-secondary transition-colors duration-150 hover:border-border-strong hover:text-foreground"
    >
      <span className="dark:hidden">Light</span>
      <span className="hidden dark:inline">Dark</span>
    </button>
  );
}
