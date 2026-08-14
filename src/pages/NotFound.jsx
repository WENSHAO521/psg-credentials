import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex-grow flex flex-col items-center justify-center gap-4 py-20 px-4 text-center">
      <span className="font-mono text-xs tracking-[0.2em] uppercase text-steel">
        404
      </span>
      <h1 className="font-sans font-extrabold text-2xl uppercase">
        Page not found
      </h1>
      <Link
        to="/"
        className="font-mono text-xs tracking-[0.15em] uppercase text-ink hover:text-red underline underline-offset-4 decoration-1"
      >
        Back to search
      </Link>
    </div>
  );
}
