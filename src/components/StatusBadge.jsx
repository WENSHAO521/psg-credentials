import {
  IconCircleCheckFilled,
  IconCircleXFilled,
  IconClock,
  IconAlertCircle,
} from "@tabler/icons-react";

const VARIANTS = {
  verified: {
    Icon: IconCircleCheckFilled,
    label: "Verified",
    ring: "border-ink",
    icon_color: "text-ink",
  },
  revoked: {
    Icon: IconCircleXFilled,
    label: "Revoked",
    ring: "border-red",
    icon_color: "text-red",
  },
  expired: {
    Icon: IconClock,
    label: "Term ended",
    ring: "border-steel",
    icon_color: "text-steel",
  },
  not_found: {
    Icon: IconAlertCircle,
    label: "Not found",
    ring: "border-red",
    icon_color: "text-red",
  },
  invalid: {
    Icon: IconAlertCircle,
    label: "Invalid link",
    ring: "border-red",
    icon_color: "text-red",
  },
};

export default function StatusBadge({ variant, size = "lg" }) {
  const v = VARIANTS[variant] || VARIANTS.not_found;
  const dims = size === "lg" ? "w-16 h-16" : "w-9 h-9";
  const iconPx = size === "lg" ? 40 : 18;

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`${dims} rounded-full border-2 ${v.ring} flex items-center justify-center animate-pop-in`}
      >
        <v.Icon size={iconPx} stroke={1.75} className={v.icon_color} />
      </div>
      <span
        className={`font-mono text-xs tracking-[0.15em] uppercase ${v.icon_color}`}
      >
        {v.label}
      </span>
    </div>
  );
}
