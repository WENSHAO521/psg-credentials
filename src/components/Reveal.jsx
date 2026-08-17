import { useInView } from "../lib/useInView.js";

// Fades a section up into place the first time it scrolls into view. Neutral
// (no motion at all) under prefers-reduced-motion, see .reveal in styles.css.
export default function Reveal({ children, className = "", delay = 0 }) {
  const [ref, inView] = useInView();
  return (
    <div
      ref={ref}
      className={`reveal ${inView ? "is-visible" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
