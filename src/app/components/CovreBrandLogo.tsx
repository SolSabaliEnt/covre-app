import { APP_NAME } from '../lib/brand';

/**
 * Official Covre marks — raster files in `/public/brand` only (no unofficial SVG).
 *
 * Light UI: `logo-mark-light.png`.
 * Dark horizontal: canonical source `logo-wordmark-horizontal-dark.png`; display uses
 * `logo-wordmark-horizontal-dark-cropped.png` for correct on-screen aspect ratio.
 */

const LIGHT_MARK = '/brand/logo-mark-light.png';

const DARK = {
  mark: '/brand/logo-mark-dark.png',
  horizontal: '/brand/logo-wordmark-horizontal-dark-cropped.png',
  stacked: '/brand/logo-wordmark-stacked-dark.png',
  stealth: '/brand/logo-wordmark-stealth-dark.png',
} as const;

export type CovreBrandLayout = keyof typeof DARK;

type CovreBrandLogoProps = {
  layout?: CovreBrandLayout;
  surface: 'light' | 'dark';
  /** Used for `<img width>` / max-width; omit for horizontal when sizing via `imgClassName`. */
  width?: number;
  className?: string;
  imgClassName?: string;
  alt?: string;
  /** When set, forces `layout="mark"` (worker welcome). */
  markSize?: number;
};

function normalizeLayout(
  layout: CovreBrandLayout | undefined,
  markSize: number | undefined,
  surface: 'light' | 'dark',
): CovreBrandLayout {
  const base = layout ?? 'horizontal';
  if (markSize != null) return 'mark';
  if (surface === 'light' && (base === 'stacked' || base === 'stealth')) return 'horizontal';
  return base;
}

function resolveSrc(surface: 'light' | 'dark', layout: CovreBrandLayout): string {
  if (surface === 'light') {
    return LIGHT_MARK;
  }
  return DARK[layout];
}

/** Caller is sizing horizontal logo with Tailwind w-* utilities — skip inline maxWidth. */
function imgClassNameSetsWidth(imgClassName: string): boolean {
  return /\bw-[\[\]0-9a-z./%vw,:-]+|\bw-(auto|full|min|max|fit)|\bmax-w-[\[\]0-9a-z.%:-]+/i.test(
    imgClassName,
  );
}

export function CovreBrandLogo({
  layout = 'horizontal',
  surface,
  width,
  className = '',
  imgClassName = '',
  alt = APP_NAME,
  markSize,
}: CovreBrandLogoProps) {
  const layoutResolved = normalizeLayout(layout, markSize, surface);
  const src = resolveSrc(surface, layoutResolved);

  const isHorizontal = layoutResolved === 'horizontal';
  const isLightMark = surface === 'light' && layoutResolved === 'mark';

  const resolvedWidth = isLightMark
    ? (markSize ?? width ?? 32)
    : isHorizontal
      ? undefined
      : width ?? 200;

  const horizontalMaxStyle =
    isHorizontal &&
    typeof width === 'number' &&
    !imgClassNameSetsWidth(imgClassName)
      ? { maxWidth: width }
      : undefined;

  return (
    <img
      src={src}
      alt={alt}
      width={resolvedWidth}
      style={horizontalMaxStyle}
      loading="lazy"
      decoding="async"
      className={`h-auto object-contain ${isHorizontal ? 'block max-w-none' : 'max-w-full'} ${className} ${imgClassName}`.trim()}
    />
  );
}
