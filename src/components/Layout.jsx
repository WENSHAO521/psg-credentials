import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  IconMenu2,
  IconX,
  IconChevronDown,
  IconShieldCheck,
  IconBuildingBank,
  IconAward,
  IconCalendarEvent,
  IconReceipt,
} from "@tabler/icons-react";

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

// One lookup page per certificate type, grouped under a single
// "Certificates" menu so a new type adds a row here rather than another
// top-level nav item.
const CERTIFICATE_SECTIONS = [
  { to: "/institute", label: "Institute", description: "Research Institute appointments", icon: IconBuildingBank },
  { to: "/awards", label: "Awards", description: "Outstanding Paper Awards", icon: IconAward },
  { to: "/events", label: "Events", description: "Conference speaker invitations", icon: IconCalendarEvent },
  { to: "/sponsorship", label: "Sponsorship", description: "Publication (APC) sponsorships", icon: IconReceipt },
];

const PRIMARY_ITEMS = [{ to: "/", label: "Search", end: true }];
const SECONDARY_ITEMS = [
  { to: "/journals", label: "Journals" },
  { to: "/about", label: "About" },
];

function CertificatesMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const location = useLocation();
  const active = CERTIFICATE_SECTIONS.some((s) => location.pathname.startsWith(s.to));

  useEffect(() => {
    setOpen(false);
  }, [location]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setOpen(false);
        // The focused link is about to unmount; keep keyboard users where
        // they were instead of dropping focus back to the page body.
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="certificates-menu"
        className={`pb-1 border-b-2 flex items-center gap-1 uppercase tracking-[0.15em] transition-colors focus-visible:outline-2 focus-visible:outline-red focus-visible:outline-offset-4 ${
          active ? "border-red text-ink" : "border-transparent text-steel hover:text-ink"
        }`}
      >
        Certificates
        <IconChevronDown
          size={14}
          stroke={2}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          id="certificates-menu"
          className="absolute left-1/2 -translate-x-1/2 top-full mt-3 w-80 bg-paper-pure border-2 border-ink shadow-[0_12px_32px_rgba(0,0,0,0.12)] normal-case tracking-normal"
        >
          <div className="h-1 bg-red" />
          <ul className="py-2">
            {CERTIFICATE_SECTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-red focus-visible:-outline-offset-2 ${
                        isActive ? "bg-surface" : ""
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          size={18}
                          stroke={1.75}
                          className={`mt-0.5 shrink-0 ${isActive ? "text-red" : "text-steel group-hover:text-ink"}`}
                        />
                        <span className="min-w-0">
                          <span className={`block font-mono text-xs font-semibold tracking-[0.15em] uppercase ${isActive ? "text-red" : "text-ink"}`}>
                            {item.label}
                          </span>
                          <span className="block font-sans text-sm text-steel mt-0.5">
                            {item.description}
                          </span>
                        </span>
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function VerifyButton({ className = "" }) {
  return (
    <NavLink
      to="/verify"
      className={({ isActive }) =>
        `inline-flex items-center justify-center gap-2 py-2 px-4 border-2 font-mono text-xs font-semibold tracking-[0.15em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-red focus-visible:outline-offset-2 ${
          isActive
            ? "border-red bg-red text-white"
            : "border-ink bg-ink text-paper-pure hover:bg-paper-pure hover:text-ink"
        } ${className}`
      }
    >
      <IconShieldCheck size={16} stroke={1.75} />
      Verify
    </NavLink>
  );
}

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
      <header className="print:hidden w-full border-b-2 border-ink bg-paper/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="px-4 md:px-8 lg:px-16 py-3 flex items-center justify-between gap-6">
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-red focus-visible:outline-offset-4"
          >
            <Monogram className="h-7 w-auto text-ink" />
            <span className="font-mono text-xs font-semibold tracking-[0.2em] uppercase text-ink whitespace-nowrap">
              PSG Credentials
            </span>
          </Link>

          <nav className="hidden lg:flex font-mono text-xs tracking-[0.15em] uppercase items-center gap-x-6 whitespace-nowrap">
            {PRIMARY_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                {item.label}
              </NavLink>
            ))}
            <CertificatesMenu />
            {SECONDARY_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} className={navLinkClass}>
                {item.label}
              </NavLink>
            ))}
            <VerifyButton className="ml-2" />
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="lg:hidden p-2 -mr-2 text-ink focus-visible:outline-2 focus-visible:outline-red focus-visible:outline-offset-2"
          >
            {menuOpen ? <IconX size={22} stroke={1.75} /> : <IconMenu2 size={22} stroke={1.75} />}
          </button>
        </div>

        {menuOpen && (
          <nav
            id="mobile-nav"
            className="lg:hidden border-t border-surface-line px-4 pt-2 pb-4 font-mono text-sm tracking-[0.1em] uppercase flex flex-col"
          >
            {PRIMARY_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={mobileNavLinkClass}>
                {item.label}
              </NavLink>
            ))}
            <div className="pt-4 pb-1 px-1 text-[11px] tracking-[0.2em] text-steel">Certificates</div>
            {CERTIFICATE_SECTIONS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `${mobileNavLinkClass({ isActive })} pl-4`}
              >
                {item.label}
              </NavLink>
            ))}
            {SECONDARY_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} className={mobileNavLinkClass}>
                {item.label}
              </NavLink>
            ))}
            <VerifyButton className="mt-4 py-3 w-full" />
          </nav>
        )}
      </header>

      <main className="flex-grow flex flex-col relative z-10">{children}</main>

      <footer className="print:hidden w-full border-t-2 border-ink bg-ink text-paper px-4 md:px-16 py-5 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="font-mono text-[11px] tracking-[0.1em] uppercase text-paper/80">
          &copy; {new Date().getFullYear()} Panorama Scholarly Group. All rights reserved.
        </div>
        <div className="font-mono text-[11px] tracking-[0.1em] uppercase text-paper/50 flex items-center gap-4">
          <span>Official credential verification registry</span>
          <a
            href="https://panorama-sg.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-paper/80 hover:text-paper underline underline-offset-4 decoration-1"
          >
            panorama-sg.com
          </a>
        </div>
      </footer>
    </div>
  );
}
