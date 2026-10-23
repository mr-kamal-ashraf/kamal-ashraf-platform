import type { ReactElement } from "react";
import type { LoginRequiredReason } from "./login-required-config";

const ICON_PROPS = {
  className: "size-8",
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function LockIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function GraduationIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" />
    </svg>
  );
}

function VideoOffIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

const REASON_TO_ICON: Record<LoginRequiredReason, () => ReactElement> = {
  guest: LockIcon,
  "stage-mismatch": GraduationIcon,
  "no-video": VideoOffIcon,
  "generic-error": AlertIcon,
};

export function PopupReasonIcon({ reason }: { reason: LoginRequiredReason }) {
  const Icon = REASON_TO_ICON[reason] ?? LockIcon;
  return <Icon />;
}
