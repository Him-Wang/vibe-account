import type { ReactNode } from "react";

interface IconProps {
  size?: number;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Svg({ size = 22, children }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 10.6 12 4l8 6.6V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />
    </Svg>
  );
}

export function BillsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3h12a1 1 0 0 1 1 1v16l-3-2-2 2-2-2-2 2-2-2-3 2V4a1 1 0 0 1 1-1z" />
      <path d="M9 8h6M9 12h6" />
    </Svg>
  );
}

export function JournalIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v18H6.5A1.5 1.5 0 0 1 5 19.5z" />
      <path d="M9 3v18" />
    </Svg>
  );
}

export function MineIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20.5c1.4-3.4 4.2-5 7.5-5s6.1 1.6 7.5 5" />
    </Svg>
  );
}

export function ReceiptIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" />
      <path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" />
      <path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" />
      <path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <path d="M7 10h10M7 14h6" />
    </Svg>
  );
}

export function CartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 4h2l2.2 10.2A2 2 0 0 0 9.2 16h8.4a2 2 0 0 0 1.9-1.4L21 8H6" />
      <circle cx="9.5" cy="19.5" r="1.3" />
      <circle cx="18" cy="19.5" r="1.3" />
    </Svg>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="2.8" width="6" height="11" rx="3" />
      <path d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0M12 17.8V21" />
    </Svg>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 19V5M6.2 10.8 12 5l5.8 5.8" />
    </Svg>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20h4L19.4 8.6a2.1 2.1 0 0 0-3-3L5 17z" />
      <path d="M14.5 5.5 18 9" />
    </Svg>
  );
}

export function TagIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 11.2V4.5a1 1 0 0 1 1-1h6.7l9 9-7.7 7.7z" />
      <circle cx="8" cy="8" r="1.3" />
    </Svg>
  );
}

export function StickerIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="4.5" width="15" height="15" rx="3.4" />
      <path d="M8.7 10.3h.01M15.3 10.3h.01" strokeWidth="2.4" />
      <path d="M8.8 13.9c.9 1.1 2 1.6 3.2 1.6s2.3-.5 3.2-1.6" />
    </Svg>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8.6A2.6 2.6 0 0 1 6.6 6h1.7l1.1-1.6h5.2L15.7 6h1.7A2.6 2.6 0 0 1 20 8.6v7.8a2.6 2.6 0 0 1-2.6 2.6H6.6A2.6 2.6 0 0 1 4 16.4z" />
      <circle cx="12" cy="12.4" r="3.2" />
    </Svg>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2.6" />
      <circle cx="9" cy="10" r="1.4" />
      <path d="M5 16.6 9.4 12l3 3L16 11.6l3 3.2" />
    </Svg>
  );
}

export function PaletteIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.6c-4.7 0-8.4 3.6-8.4 8.2s3.7 8.2 8.4 8.2c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.2-1.5-1.2-2.6 0-.9.7-1.6 1.7-1.6h1.2a5 5 0 0 0 4.9-5c0-3.9-3.6-5.5-8.4-5.5z" />
      <circle cx="7.8" cy="11.4" r=".9" />
      <circle cx="10.2" cy="8" r=".9" />
      <circle cx="14.2" cy="8.1" r=".9" />
    </Svg>
  );
}

export function TextIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 6.6V5h14v1.6M12 5v14M9 19h6" />
    </Svg>
  );
}

export function BrushIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M11.2 15.4 19 4.8" />
      <path d="M5.6 18.4c.3-2.1 1.6-3.2 3.3-3.2 1.7 0 3 1.3 3 3s-1.5 2.9-3.4 2.9c-2 0-3.1-1.2-2.9-2.7z" />
    </Svg>
  );
}

export function UndoIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9.2 5.4 4.6 10l4.6 4.6" />
      <path d="M4.6 10h9a5 5 0 0 1 0 10h-2.8" />
    </Svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4v11M7.6 10.6 12 15l4.4-4.4" />
      <path d="M4.6 19.6h14.8" />
    </Svg>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14.5a7.6 7.6 0 0 0 0-5l1.4-1.5-1.8-1.8-1.5 1.4a7.6 7.6 0 0 0-5 0L11 6.2 9.2 8l1.4 1.5a7.6 7.6 0 0 0 0 5L9.2 16l1.8 1.8 1.5-1.4a7.6 7.6 0 0 0 5 0l1.5 1.4 1.8-1.8z" />
    </Svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3l7 3v5.6c0 4.3-2.9 7.4-7 9.4-4.1-2-7-5.1-7-9.4V6z" />
      <path d="M9.2 11.8l1.9 1.9 3.7-3.7" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5l1.7 5.1a2 2 0 0 0 1.2 1.2l5.1 1.7-5.1 1.7a2 2 0 0 0-1.2 1.2L12 19.5l-1.7-5.1a2 2 0 0 0-1.2-1.2L4 11.5l5.1-1.7a2 2 0 0 0 1.2-1.2z" />
    </Svg>
  );
}

export function ChevronIcon(props: IconProps) {

  return (
    <Svg {...props}>
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </Svg>
  );
}
