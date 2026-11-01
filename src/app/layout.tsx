import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";

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
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
