import { useEffect, useState } from "react";
import { IconExternalLink } from "@tabler/icons-react";
import { loadJournals } from "../lib/data.js";

export default function JournalsPage() {
  const [journals, setJournals] = useState(null);

  useEffect(() => {
    loadJournals().then(setJournals);
  }, []);

  return (
    <div className="flex-grow flex flex-col items-center px-4 md:px-16 py-20">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-12">
          <h1 className="font-sans font-extrabold text-3xl md:text-5xl leading-tight tracking-tight uppercase mb-4 text-balance">
            Panorama Journals
          </h1>
          <p className="font-sans text-base text-steel max-w-lg mx-auto">
            Titles published under Panorama Scholarly Group. Not sure which
            journal your certificate belongs to? Find it here, then search by
            name on the relevant page.
          </p>
        </div>

        {!journals && (
          <p className="text-center font-mono text-xs tracking-[0.2em] uppercase text-steel">
            Loading&hellip;
          </p>
        )}

        {journals && (
          <ul className="flex flex-col divide-y divide-surface-line border-t border-b border-surface-line">
            {journals.map((j) => (
              <li key={j.journal} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4">
                <div className="min-w-0">
                  <span className="block font-sans font-semibold text-ink">
                    {j.journal}
                    {j.type === "event" && (
                      <span className="ml-2 font-mono text-[10px] tracking-[0.1em] uppercase text-steel-dim">
                        Conference
                      </span>
                    )}
                  </span>
                  <span className="block font-mono text-xs text-steel mt-1">
                    {[j.code, j.issn && `ISSN ${j.issn}`, j.editor_in_chief]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                {j.website_url && (
                  <a
                    href={j.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1.5 font-mono text-xs tracking-[0.1em] uppercase text-ink hover:text-red transition-colors underline underline-offset-4 decoration-1"
                  >
                    Official page
                    <IconExternalLink size={14} stroke={1.75} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
