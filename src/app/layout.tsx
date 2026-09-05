import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { pulseConfig } from "@config/pulse.config";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${pulseConfig.site.name} — ${pulseConfig.site.tagline}`,
    template: `%s — ${pulseConfig.site.name}`,
  },
  description: "Personal global intelligence feed. Less noise, more signal.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF9" },
    { media: "(prefers-color-scheme: dark)", color: "#0D0D0C" },
  ],
};

/** Theme bootstrap — runs before paint to avoid a flash. */
const themeScript = `
(function(){
  try {
    var stored = localStorage.getItem('pulse-theme');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans`}>{children}</body>
    </html>
  );
}
