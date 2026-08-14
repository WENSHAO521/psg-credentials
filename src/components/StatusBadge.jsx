const VARIANTS = {
  verified: {
    icon: "check_circle",
    label: "Verified",
    ring: "border-ink",
    icon_color: "text-ink",
    fill: true,
  },
  revoked: {
    icon: "cancel",
    label: "Revoked",
    ring: "border-red",
    icon_color: "text-red",
    fill: true,
  },
  expired: {
    icon: "schedule",
    label: "Term ended",
    ring: "border-steel",
    icon_color: "text-steel",
    fill: false,
  },
  not_found: {
    icon: "error",
    label: "Not found",
    ring: "border-red",
    icon_color: "text-red",
    fill: false,
  },
  invalid: {
    icon: "error",
    label: "Invalid link",
    ring: "border-red",
    icon_color: "text-red",
    fill: false,
  },
};

export default function StatusBadge({ variant, size = "lg" }) {
  const v = VARIANTS[variant] || VARIANTS.not_found;
  const dims = size === "lg" ? "w-16 h-16" : "w-9 h-9";
  const iconSize = size === "lg" ? "text-5xl" : "text-xl";

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`${dims} rounded-full border-2 ${v.ring} flex items-center justify-center animate-pop-in`}
      >
        <span
          className={`material-symbols-outlined ${v.icon_color} ${iconSize}`}
          style={
            v.fill
              ? { fontVariationSettings: "'FILL' 1, 'wght' 500" }
              : undefined
          }
        >
          {v.icon}
        </span>
      </div>
      <span
        className={`font-mono text-xs tracking-[0.15em] uppercase ${v.icon_color}`}
      >
        {v.label}
      </span>
    </div>
  );
}
