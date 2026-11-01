"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Flips the "dark" class on <html> and remembers the choice. Both icons are in the markup and
 * CSS picks one, so the server and client HTML match whatever theme the script in layout chose. */
export default function ThemeToggle() {
  function toggle() {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      // private mode: the theme just resets on reload
    }
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={toggle}
      aria-label="Toggle dark mode"
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}
