export default function DocumentCard({ children, className = "" }) {
  return (
    <div
      className={`max-w-2xl w-full bg-paper-pure border-2 border-ink relative overflow-hidden ${className}`}
    >
      <div className="absolute top-0 right-0 w-8 h-8 bg-red" aria-hidden="true" />
      <img
        src="/seal/psg-official-seal.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute -bottom-16 -right-16 w-72 h-72 opacity-[0.05] dark:opacity-[0.22]"
      />
      <div className="relative p-8 md:p-14">{children}</div>
    </div>
  );
}
