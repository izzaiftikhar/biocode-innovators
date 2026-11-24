"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Shows /images/biocode-logo.png. If the file is missing, empty or broken,
 * a simple helix monogram is shown instead so the header never has a blank gap.
 */
export default function BrandLogo({ size = 40, className = "" }: { size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // The image can fail before React hydrates (onError never fires), so also check after mount.
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        role="img"
        aria-label="BioCode Innovators logo"
        className={className}
      >
        <circle cx="24" cy="24" r="24" fill="#0B1F4D" />
        <path d="M16 8c0 10 16 12 16 22s-16 12-16 10" fill="none" stroke="#43DDE5" strokeWidth="3" strokeLinecap="round" />
        <path d="M32 8c0 10-16 12-16 22s16 12 16 10" fill="none" stroke="#087F8C" strokeWidth="3" strokeLinecap="round" />
        <path d="M19 15h10M17 24h14M19 33h10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
      </svg>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src="/images/biocode-logo.png"
      alt="BioCode Innovators logo"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
