import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconBuildingBank,
  IconAward,
  IconCalendarEvent,
  IconBooks,
  IconShieldCheck,
  IconInfoCircle,
  IconArrowUpRight,
} from "@tabler/icons-react";
import CertificateSearch from "../components/CertificateSearch.jsx";
import Reveal from "../components/Reveal.jsx";
import SampleCertificate from "../components/SampleCertificate.jsx";
import { useInView } from "../lib/useInView.js";
import { loadCertificates, loadJournals } from "../lib/data.js";

function useCountUp(target, active, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active || target == null) return;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setValue(target);
      return;
    }
    let raf;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);
  return value;
}

function StatBlock({ value, label, active }) {
  const count = useCountUp(value, active);
  return (
    <div>
      {value == null ? (
        <div className="skeleton h-9 w-16 mb-1" />
      ) : (
        <div className="font-mono text-3xl md:text-4xl font-bold text-ink tabular-nums">
          {count}
        </div>
      )}
      <div className="font-mono text-[11px] tracking-[0.15em] uppercase text-steel mt-1">
        {label}
      </div>
    </div>
  );
}

const DESTINATIONS = [
  {
    to: "/verify",
    label: "Verify",
    description: "Check a certificate number or QR code against the registry.",
    icon: IconShieldCheck,
    span: "sm:col-span-2 lg:col-span-2",
    featured: true,
  },
  {
    to: "/institute",
    label: "Institute",
    description: "Panorama Research Institute appointments.",
    icon: IconBuildingBank,
    accent: "seal",
  },
  {
    to: "/awards",
    label: "Awards",
    description: "Outstanding Paper Award certificates.",
    icon: IconAward,
  },
  {
    to: "/events",
    label: "Events",
    description: "Conference speaker invitations.",
    icon: IconCalendarEvent,
  },
  {
    to: "/journals",
    label: "Journals",
    description: "Every title published under Panorama Scholarly Group.",
    icon: IconBooks,
    accent: "grid",
  },
  {
    to: "/about",
    label: "About this registry",
    description: "What a PSG credential is, and how to report a concern.",
    icon: IconInfoCircle,
    span: "sm:col-span-2 lg:col-span-3",
    wide: true,
  },
];

function DestinationTile({ item }) {
  const Icon = item.icon;

  if (item.wide) {
    return (
      <Link
        to={item.to}
        className={`group flex items-center justify-between gap-4 border border-surface-line hover:border-ink px-6 py-5 transition-colors ${item.span || ""}`}
      >
        <span className="flex items-center gap-3 min-w-0">
          <Icon size={20} stroke={1.75} className="text-steel shrink-0" />
          <span className="min-w-0">
            <span className="block font-sans font-semibold text-ink">{item.label}</span>
            <span className="block text-sm text-steel truncate">{item.description}</span>
          </span>
        </span>
        <IconArrowUpRight
          size={20}
          stroke={1.75}
          className="text-steel group-hover:text-red group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0"
        />
      </Link>
    );
  }

  return (
    <Link
      to={item.to}
      className={`group relative flex flex-col justify-between gap-8 overflow-hidden border px-6 py-6 min-h-[168px] transition-colors ${item.span || ""} ${
        item.featured
          ? "bg-ink border-ink text-paper-pure hover:border-red"
          : "border-surface-line hover:border-ink"
      }`}
    >
      {item.accent === "seal" && (
        <img
          src="/seal/psg-official-seal.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none absolute -bottom-10 -right-10 w-40 h-40 opacity-[0.06]"
        />
      )}
      {item.accent === "grid" && (
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
      )}

      <div className="relative z-10 flex items-start justify-between">
        <Icon
          size={22}
          stroke={1.75}
          className={item.featured ? "text-paper-pure" : "text-steel"}
        />
        <IconArrowUpRight
          size={18}
          stroke={1.75}
          className={`transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
            item.featured ? "text-paper-pure/70 group-hover:text-paper-pure" : "text-steel group-hover:text-red"
          }`}
        />
      </div>

      <div className="relative z-10">
        <span className={`block font-sans font-semibold text-lg ${item.featured ? "text-paper-pure" : "text-ink"}`}>
          {item.label}
        </span>
        <span className={`block text-sm mt-1 ${item.featured ? "text-paper-pure/70" : "text-steel"}`}>
          {item.description}
        </span>
      </div>
    </Link>
  );
}

export default function Home() {
  const [stats, setStats] = useState(null);
  const [statsRef, statsInView] = useInView({ threshold: 0.4 });

  useEffect(() => {
    Promise.all([loadCertificates(), loadJournals()]).then(([certs, journals]) => {
      setStats({
        credentials: certs.filter((c) => c.status === "active").length,
        journals: journals.length,
      });
    });
  }, []);

  return (
    <div className="flex-grow flex flex-col">
      {/* Hero: search stays exactly where it always was, functionally --
          it's just no longer the whole page. */}
      <section className="px-4 md:px-16 pt-16 pb-12 md:pt-20 md:pb-16">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <h1 className="font-sans font-extrabold text-4xl md:text-5xl leading-tight tracking-tight text-balance mb-4">
              Verify any PSG credential.
            </h1>
            <p className="font-sans text-base text-steel max-w-md mb-8">
              Editorial appointments, paper awards, and conference invitations all
              check out here, independent of who's presenting them.
            </p>
            <CertificateSearch
              fullHeight={false}
              placeholder="e.g. Yulei Tao"
              emptyHint="Make sure it matches your full name exactly (no titles, no partial names), or contact the editorial office if you believe this is an error."
            />
          </div>

          <div className="hidden lg:flex flex-col items-center justify-center gap-4">
            <SampleCertificate className="w-full max-w-md animate-seal-draw-in" />
            <p className="font-mono text-xs text-steel-dim text-center max-w-[280px]">
              A sample. Every real certificate carries this seal, a unique number, and a QR code that verifies it.
            </p>
          </div>
        </div>
      </section>

      {/* Stats: real registry counts, not invented numbers. */}
      <section
        ref={statsRef}
        className="border-y border-surface-line px-4 md:px-16 py-10"
      >
        <div className="max-w-6xl mx-auto flex items-center gap-12 md:gap-20">
          <StatBlock value={stats?.credentials ?? null} label="Active credentials" active={statsInView} />
          <StatBlock value={stats?.journals ?? null} label="Journals & programs" active={statsInView} />
        </div>
      </section>

      {/* Destinations */}
      <section className="px-4 md:px-16 py-16 md:py-20">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <h2 className="font-sans font-bold text-2xl md:text-3xl text-ink mb-2">
              Browse the full registry
            </h2>
            <p className="text-steel text-sm mb-10 max-w-md">
              Every credential type Panorama Scholarly Group issues, in one place.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DESTINATIONS.map((item, i) => (
              <Reveal key={item.to} delay={i * 60} className={item.span || ""}>
                <DestinationTile item={item} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
