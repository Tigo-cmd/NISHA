/**
 * NISHA App Theme - Tactical Cyberpunk Aesthetic
 * Dark base with mode-specific neon accents
 */

export const COLORS = {
  // Backgrounds
  bg: {
    default: '#0A0A0F',
    surface: '#12121A',
    elevated: '#1A1A24',
    overlay: 'rgba(10, 10, 15, 0.8)',
  },

  // Agent Mode - NISHA Green
  agent: {
    primary: '#39d353',
    glow: 'rgba(57, 211, 83, 0.5)',
    glowSoft: 'rgba(57, 211, 83, 0.15)',
    surfaceActive: 'rgba(57, 211, 83, 0.05)',
    border: 'rgba(57, 211, 83, 0.3)',
    borderStrong: 'rgba(57, 211, 83, 0.6)',
  },

  // Master Mode - Electric Purple
  master: {
    primary: '#B026FF',
    glow: 'rgba(176, 38, 255, 0.5)',
    glowSoft: 'rgba(176, 38, 255, 0.15)',
    surfaceActive: 'rgba(176, 38, 255, 0.05)',
    border: 'rgba(176, 38, 255, 0.3)',
    borderStrong: 'rgba(176, 38, 255, 0.6)',
  },

  // Neutral
  border: '#2A2A35',
  borderHover: '#3A3A4A',
  text: {
    primary: '#FFFFFF',
    secondary: '#A0A0B0',
    muted: '#606070',
    ghost: '#40404D',
  },

  // Status
  status: {
    danger: '#FF3B30',
    dangerGlow: 'rgba(255, 59, 48, 0.3)',
    success: '#34C759',
    successGlow: 'rgba(52, 199, 89, 0.3)',
    warning: '#FFCC00',
    warningGlow: 'rgba(255, 204, 0, 0.3)',
  },
};

export const FONTS = {
  heading: 'System',  // Space Grotesk fallback to System
  body: 'System',     // Inter fallback to System
  mono: 'Menlo',      // JetBrains Mono fallback to Menlo/Monaco
};

export const FONT_SIZES = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
  '5xl': 40,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
};

export const RADIUS = {
  none: 0,
  sm: 2,
  md: 4,
  lg: 6,
  xl: 8,
  full: 999,
};

export const MODE_COLORS = {
  AGENT: COLORS.agent,
  MASTER: COLORS.master,
};
