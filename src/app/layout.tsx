import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import OpenStreetMapAttribution from "@/components/OpenStreetMapAttribution";

export const metadata: Metadata = {
  title: "Tripbook — Place Reviews & Day-by-Day Trip Planning",
  description: "MESW LES / DOO 2026-27 - Group 7",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Dark by default; the script drops the class if the person chose light. It runs before React,
    // hence suppressHydrationWarning.
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("theme")==="light")document.documentElement.classList.remove("dark")}catch(e){}`,
          }}
        />
      </head>

      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-900 antialiased">
        <SiteHeader />

        <div className="flex-1">{children}</div>

        <footer className="border-t border-slate-200 px-4 py-4">
          <OpenStreetMapAttribution />
        </footer>
      </body>
    </html>
  );
}
