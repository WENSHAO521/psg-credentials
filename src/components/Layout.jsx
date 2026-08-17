import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { IconMenu2, IconX } from "@tabler/icons-react";

function Monogram({ className }) {
  return (
    <svg viewBox="0 0 190 200" className={className} aria-hidden="true">
      <rect x="0" y="0" width="30" height="200" fill="currentColor" />
      <path d="M30 0 H120 C150 0, 150 70, 120 70 H30 Z" fill="#E30613" />
      <path
        d="M0 100 H120 V130 H30 V150 H120 V200 H0 V170 H90 V150 H0 Z"
        fill="currentColor"
      />
      <path d="M150 200 H50 V170 H150 V50 H180 V200 Z" fill="currentColor" />
      <rect x="160" y="10" width="30" height="30" fill="#E30613" />
    </svg>
  );
}

function navLinkClass({ isActive }) {
  return `pb-1 border-b-2 transition-colors focus-visible:outline-2 focus-visible:outline-red focus-visible:outline-offset-4 ${
    isActive ? "border-red text-ink" : "border-transparent text-steel hover:text-ink"
  }`;
}

// Same link, styled for the stacked mobile panel instead of the inline
// underline-on-active desktop nav.
function mobileNavLinkClass({ isActive }) {
  return `block w-full py-3 px-1 border-b border-surface-line transition-colors ${
    isActive ? "text-red" : "text-ink"
  }`;
}

const NAV_ITEMS = [
  { to: "/", label: "Search", end: true },
  { to: "/institute", label: "Institute" },
  { to: "/awards", label: "Awards" },
  { to: "/events", label: "Events" },
  { to: "/journals", label: "Journals" },
  { to: "/verify", label: "Verify" },
  { to: "/about", label: "About" },
];

export default function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Close the mobile menu whenever navigation happens, so a tapped link
  // doesn't leave the panel hanging open over the next page.
  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink grid-bg font-sans">
      <header className="w-full border-b-2 border-ink bg-paper/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="px-4 md:px-16 py-3 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-red focus-visible:outline-offset-4"
          >
            <Monogram className="h-7 w-auto text-ink" />
            <span className="font-mono text-xs font-semibold tracking-[0.2em] uppercase text-ink">
              PSG Credentials
            </span>
          </Link>

          <nav className="hidden md:flex font-mono text-xs tracking-[0.15em] uppercase items-center gap-x-6">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="md:hidden p-2 -mr-2 text-ink focus-visible:outline-2 focus-visible:outline-red focus-visible:outline-offset-2"
          >
            {menuOpen ? <IconX size={22} stroke={1.75} /> : <IconMenu2 size={22} stroke={1.75} />}
          </button>
        </div>

        {menuOpen && (
          <nav
            id="mobile-nav"
            className="md:hidden border-t border-surface-line px-4 py-2 font-mono text-sm tracking-[0.1em] uppercase flex flex-col"
          >
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={mobileNavLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-grow flex flex-col relative z-10">{children}</main>

      <footer className="w-full border-t-2 border-ink bg-ink text-paper px-4 md:px-16 py-5 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="font-mono text-[11px] tracking-[0.1em] uppercase text-paper/80">
          &copy; {new Date().getFullYear()} Panorama Scholarly Group. All rights reserved.
        </div>
        <div className="font-mono text-[11px] tracking-[0.1em] uppercase text-paper/50">
          Official credential verification registry
        </div>
      </footer>
    </div>
  );
}
