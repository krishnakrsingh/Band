/** Light-mode monochrome design tokens. No color hues, ever. */
export const colors = {
  bg: '#FFFFFF',
  surface: '#F5F5F7',
  surfaceRaised: '#FFFFFF',
  ink: '#000000',
  inkSecondary: '#6E6E73',
  inkTertiary: '#AEAEB2',
  hairline: '#E5E5EA',
  hairlineStrong: '#D1D1D6',
  fillSoft: '#F2F2F7',
} as const;

export const type = {
  display: { fontSize: 88, fontWeight: '200' as const, letterSpacing: -5 },
  hero: { fontSize: 72, fontWeight: '200' as const, letterSpacing: -4 },
  title: { fontSize: 34, fontWeight: '300' as const, letterSpacing: -1 },
  metric: { fontSize: 28, fontWeight: '300' as const, letterSpacing: -0.8 },
  body: { fontSize: 15, fontWeight: '400' as const, letterSpacing: 0 },
  caption: { fontSize: 11, fontWeight: '500' as const, letterSpacing: 1.4 },
  micro: { fontSize: 9, fontWeight: '600' as const, letterSpacing: 1.8 },
} as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 8, md: 16, lg: 28, pill: 999 } as const;
export const stroke = { hairline: 1, thin: 1.5, bold: 2.5 } as const;

/** Motion: calm, Apple-like. */
export const motion = {
  fast: 180,
  normal: 280,
  slow: 480,
  easing: (t: number) => 1 - Math.pow(1 - t, 3),
} as const;
