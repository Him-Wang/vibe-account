import { useId } from "react";

interface LogoMarkProps {
  size?: number;
  className?: string;
}

/**
 * 随口记 mark: a lilac ticket carrying a voice wave.
 * The scalloped bottom edge is the receipt, the three bars are the voice.
 */
export function LogoMark({ size = 36, className }: LogoMarkProps) {
  const gid = useId().replace(/:/g, "");
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      role="img"
      aria-label="随口记"
    >
      <defs>
        <linearGradient id={gid} x1="5" y1="2" x2="34" y2="39" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3A353F" />
          <stop offset="0.55" stopColor="#2A262E" />
          <stop offset="1" stopColor="#1D1A20" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${gid})`} />
      <rect x="0.6" y="0.6" width="38.8" height="38.8" rx="10.5" stroke="#F4F0E8" strokeOpacity="0.22" />
      <path
        d="M12 10.5a1.5 1.5 0 0 1 1.5-1.5h13a1.5 1.5 0 0 1 1.5 1.5v16.3l-2.67-1.9-2.66 1.9-2.67-1.9-2.67 1.9-2.66-1.9-2.67 1.9V10.5Z"
        fill="#F4F0E8"
      />
      <rect x="16.2" y="15.8" width="2.2" height="4.4" rx="1.1" fill="#8B76AC" />
      <rect x="19" y="13.4" width="2.2" height="9.2" rx="1.1" fill="#8B76AC" />
      <rect x="21.8" y="15.8" width="2.2" height="4.4" rx="1.1" fill="#8B76AC" />
    </svg>
  );
}
