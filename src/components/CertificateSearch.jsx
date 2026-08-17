import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { IconSearch, IconArrowRight } from "@tabler/icons-react";
import { searchByName } from "../lib/data.js";
import DocumentCard from "./DocumentCard.jsx";

export default function CertificateSearch({
  heading,
  description,
  placeholder,
  emptyHint,
  scope,
  fieldLabel = "Full Name",
  fullHeight = true,
}) {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const [inputQ, setInputQ] = useState(q);
  const [phase, setPhase] = useState(q ? "loading" : "idle");
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!q) {
      setPhase("idle");
      setResults([]);
      return;
    }
    setPhase("loading");
    searchByName(q, { scope }).then((r) => {
      setResults(r);
      setPhase("done");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!inputQ.trim()) return;
    setParams({ q: inputQ.trim() });
  }

  function reset() {
    setInputQ("");
    setParams({});
  }

  return (
    <div
      className={
        fullHeight
          ? "flex-grow flex items-center justify-center px-4 md:px-16 py-20"
          : "w-full"
      }
    >
      <DocumentCard>
        {(heading || description) && (
          <div className="text-center mb-10 relative z-10">
            {heading && (
              <h1 className="font-sans font-extrabold text-3xl md:text-5xl leading-tight tracking-tight uppercase mb-4 text-balance">
                {heading}
              </h1>
            )}
            {description && (
              <p className="font-sans text-base text-steel max-w-lg mx-auto">
                {description}
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 relative z-10">
          <div className="flex flex-col">
            <label
              htmlFor="name-q"
              className="font-mono text-xs font-semibold tracking-[0.15em] uppercase text-steel mb-2"
            >
              {fieldLabel}
            </label>
            <input
              id="name-q"
              type="text"
              autoComplete="off"
              required
              value={inputQ}
              onChange={(e) => setInputQ(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-surface border-0 border-b border-ink focus:ring-0 focus:border-red focus:border-b-2 py-3 px-4 font-mono text-sm text-ink placeholder-steel-dim outline-none transition-colors focus-visible:outline-2 focus-visible:outline-red focus-visible:outline-offset-2"
            />
          </div>
          <button
            type="submit"
            className="w-full py-4 border-2 border-ink bg-ink text-paper-pure font-mono text-xs font-semibold tracking-[0.2em] uppercase hover:bg-paper-pure hover:text-ink active:scale-[0.98] active:translate-y-px transition-all duration-150 flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-red focus-visible:outline-offset-2"
          >
            Search
            <IconSearch size={18} stroke={1.75} />
          </button>
        </form>

        {phase === "loading" && (
          <p className="mt-8 text-center font-mono text-xs tracking-[0.2em] uppercase text-steel relative z-10">
            Searching&hellip;
          </p>
        )}

        {phase === "done" && (
          <div className="mt-10 border-t border-surface-line pt-8 relative z-10">
            {results.length === 0 ? (
              <p className="text-center text-sm text-steel">
                No certificate found for &ldquo;{q}&rdquo;. {emptyHint}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {results.map((r) => (
                  <li key={r.certificate_id}>
                    <Link
                      to={`/certificate/${r.certificate_id}`}
                      className="flex items-center justify-between gap-4 border border-surface-line hover:border-ink px-5 py-4 transition-colors group focus-visible:outline-2 focus-visible:outline-red focus-visible:outline-offset-2"
                    >
                      <span className="min-w-0">
                        <span className="block font-sans font-semibold text-ink truncate">
                          {r.display_name}
                        </span>
                        <span className="block font-mono text-xs text-steel mt-1 truncate">
                          {r.role} &middot; {r.journal}
                        </span>
                        {r.detail && (
                          <span className="block font-mono text-xs text-steel-dim mt-0.5 truncate">
                            {r.detail}
                          </span>
                        )}
                      </span>
                      <IconArrowRight
                        size={20}
                        stroke={1.75}
                        className="text-steel group-hover:text-red group-hover:translate-x-0.5 transition-all shrink-0"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={reset}
              className="mt-6 font-mono text-xs tracking-[0.1em] uppercase text-steel hover:text-ink transition-colors underline underline-offset-4 decoration-1"
            >
              New search
            </button>
          </div>
        )}
      </DocumentCard>
    </div>
  );
}
