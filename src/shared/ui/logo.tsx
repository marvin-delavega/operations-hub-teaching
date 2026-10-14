// -------------------------------------------------------------------
// Operations Hub brand mark — a flat 3D isometric cube with the wordmark
// "OH" embedded across its faces. The cube reads as the hub that bridges
// scanner and ERP; flat shading (three opacities of a single colour) gives
// depth without a second hue, so the mark is theme-aware via currentColor.
//
//   • Left face  — an "O" (annulus cut as negative space).
//   • Right face — an "H" (two legs + a single connecting dash), the dash
//                  bridging the face's two vertical edges.
//   • Top face   — left plain for the lid of the cube.
//
// The O and dash are painted in each face's own slanted coordinate space
// (the matrix transforms below), so the glyphs follow the isometric slant
// of the plane they sit on. Negative space means the glyphs show whatever
// is behind the mark, keeping it legible on any background.
//
// Colour comes from currentColor — callers set it theme-aware
// (e.g. `text-primary dark:text-white`).
// -------------------------------------------------------------------

import { useId } from "react";

export function Logo({ className }: { className?: string }) {
  // Unique per instance so multiple logos on one page don't share a mask id.
  const maskId = useId();
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-label="Operations Hub logo"
    >
      <defs>
        {/* White = keep, black = cut. Glyphs are cut from the cube faces. */}
        <mask id={maskId}>
          <rect x="0" y="0" width="64" height="64" fill="white" />

          {/* "O" on the left face — drawn in the left plane's slanted space */}
          <g transform="matrix(22 12 0 26 10 22)">
            <circle cx="0.5" cy="0.5" r="0.3" fill="black" />
            <circle cx="0.5" cy="0.5" r="0.155" fill="white" />
          </g>

          {/* "H" on the right face — two leg holes leave legs + a center dash.
              Holes stay within the [0,1] face so they don't nick the top face. */}
          <g transform="matrix(22 -12 0 26 32 34)">
            <rect x="0.28" y="0.04" width="0.44" height="0.36" fill="black" />
            <rect x="0.28" y="0.6" width="0.44" height="0.36" fill="black" />
          </g>
        </mask>
      </defs>

      <g mask={`url(#${maskId})`}>
        {/* Left face — darkest plane */}
        <path d="M10 22 L32 34 L32 60 L10 48 Z" fill="currentColor" opacity="0.5" />
        {/* Right face — mid plane */}
        <path d="M32 34 L54 22 L54 48 L32 60 Z" fill="currentColor" opacity="0.74" />
        {/* Top face — brightest plane (the lid) */}
        <path d="M10 22 L32 10 L54 22 L32 34 Z" fill="currentColor" opacity="1" />
      </g>
    </svg>
  );
}
