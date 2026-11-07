/**
 * MediNexus Design Tokens
 * Centralized design system for the premium 3D redesign
 */

export const colors = {
  // Brand colors - Medical teal/cyan theme
  brand: {
    primary: '#19c5d1',
    primaryDark: '#149bb1',
    primaryLight: '#48e8f0',
    secondary: '#7561ee',
    secondaryDark: '#5c4ad6',
    secondaryLight: '#9b8cff',
    accent: '#37d3ae',
    accentDark: '#19b790',
    accentLight: '#6effd5',
  },

  // Semantic colors
  semantic: {
    success: '#16b88a',
    successLight: '#e6faf2',
    warning: '#e09a56',
    warningLight: '#fff4e6',
    error: '#ed5065',
    errorLight: '#fff0f1',
    info: '#19c5d1',
    infoLight: '#eafafa',
  },

  // Neutral colors
  neutral: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },

  // Dark theme overrides
  dark: {
    bg: '#0a1a2f',
    bgSecondary: '#112240',
    bgTeritary: '#1a2a4a',
    surface: '#112240',
    surfaceHover: '#1a2a4a',
    border: '#233554',
    text: '#e8f0fe',
    textSecondary: '#8892b0',
    textMuted: '#4d5b8e',
  },

  // Light theme
  light: {
    bg: '#f8fafc',
    bgSecondary: '#ffffff',
    bgTeritary: '#f1f5f9',
    surface: '#ffffff',
    surfaceHover: '#f1f5f9',
    border: '#e2e8f0',
    text: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
  },

  // Text colors (theme-agnostic base)
    text: {
      primary: '#0f172a',
      secondary: '#475569',
      muted: '#94a3b8',
      inverse: '#ffffff',
      inverseSecondary: '#e8f0fe',
    },

    // Glassmorphism
    glass: {
      light: 'rgba(255, 255, 255, 0.7)',
      dark: 'rgba(17, 34, 64, 0.7)',
      border: 'rgba(255, 255, 255, 0.1)',
      borderDark: 'rgba(255, 255, 255, 0.05)',
      shadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      shadowDark: '0 8px 32px rgba(0, 0, 0, 0.3)',
    },

  // Gradients
  gradients: {
    primary: 'linear-gradient(135deg, #19c5d1 0%, #7561ee 100%)',
    secondary: 'linear-gradient(135deg, #7561ee 0%, #37d3ae 100%)',
    hero: 'linear-gradient(145deg, #0a1a2f 0%, #1a2a4a 50%, #0f172a 100%)',
    heroLight: 'linear-gradient(145deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)',
    glass: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
    glassDark: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
    mesh: 'radial-gradient(ellipse at 50% 50%, rgba(25, 197, 209, 0.15) 0%, transparent 70%)',
    meshDark: 'radial-gradient(ellipse at 50% 50%, rgba(25, 197, 209, 0.1) 0%, transparent 70%)',
  },
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '64px',
  '4xl': '96px',
};

export const typography = {
  fontFamilies: {
    display: '"Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    body: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", "Fira Code", monospace',
  },
  fontSizes: {
    xs: '10px',
    sm: '12px',
    base: '14px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
    '4xl': '48px',
    '5xl': '64px',
    '6xl': '96px',
  },
  fontWeights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  lineHeights: {
    tight: 1.1,
    normal: 1.5,
    relaxed: 1.75,
  },
  letterSpacing: {
    tight: '-0.02em',
    normal: '0',
    wide: '0.02em',
    wider: '0.04em',
  },
};

export const borderRadius = {
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '20px',
  '2xl': '28px',
  full: '9999px',
};

export const shadows = {
  sm: '0 2px 8px rgba(0, 0, 0, 0.04)',
  md: '0 8px 24px rgba(0, 0, 0, 0.06)',
  lg: '0 16px 48px rgba(0, 0, 0, 0.08)',
  xl: '0 24px 64px rgba(0, 0, 0, 0.1)',
  '2xl': '0 32px 80px rgba(0, 0, 0, 0.12)',
  inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)',
  glow: '0 0 40px rgba(25, 197, 209, 0.3)',
  glowSecondary: '0 0 40px rgba(117, 97, 238, 0.3)',
  glowAccent: '0 0 40px rgba(55, 211, 174, 0.3)',
};

export const transitions = {
  fast: '150ms ease',
  normal: '250ms ease',
  slow: '350ms ease',
  slower: '500ms ease',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
};

export const zIndex = {
  dropdown: 100,
  sticky: 200,
  modal: 300,
  popover: 400,
  tooltip: 500,
  toast: 600,
};

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

export const animation = {
  durations: {
    instant: '0ms',
    fast: '150ms',
    normal: '250ms',
    slow: '350ms',
    slower: '500ms',
    slowest: '700ms',
  },
  easings: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOutExpo: 'cubic-bezier(0.19, 1, 0.22, 1)',
      easeOutBack: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
};

export const threeD = {
  // 3D Scene defaults
  scene: {
    backgroundColor: 0x0a1a2f,
    backgroundColorLight: 0xf8fafc,
    fogColor: 0x0a1a2f,
    fogColorLight: 0xe2e8f0,
    fogNear: 10,
    fogFar: 50,
  },
  // Materials
  materials: {
    glass: {
      transmission: 0.9,
      opacity: 0.1,
      roughness: 0,
      metalness: 0,
      thickness: 0.5,
      ior: 1.5,
      envMapIntensity: 1,
      clearcoat: 1,
      clearcoatRoughness: 0,
    },
    glassDark: {
      transmission: 0.8,
      opacity: 0.15,
      roughness: 0,
      metalness: 0,
      thickness: 0.5,
      ior: 1.5,
      envMapIntensity: 1.5,
      clearcoat: 1,
      clearcoatRoughness: 0,
    },
    metal: {
      roughness: 0.2,
      metalness: 0.8,
      envMapIntensity: 1,
    },
    matte: {
      roughness: 0.8,
      metalness: 0,
      envMapIntensity: 0.5,
    },
    emissive: {
      emissiveIntensity: 0.5,
    },
  },
  // Lighting
  lighting: {
    ambientIntensity: 0.5,
    ambientColor: 0xffffff,
    directionalIntensity: 1,
    directionalColor: 0xffffff,
    pointIntensity: 50,
    pointColor: 0x19c5d1,
    spotIntensity: 100,
    spotColor: 0x7561ee,
  },
  // Camera
  camera: {
    fov: 50,
    near: 0.1,
    far: 100,
    position: [0, 0, 5],
  },
  // Interaction
  interaction: {
    enableDamping: true,
    dampingFactor: 0.05,
    rotateSpeed: 0.5,
    zoomSpeed: 1,
    panSpeed: 1,
  },
};

export const effects = {
  // Parallax
  parallax: {
    strength: 0.1,
    mobileStrength: 0.05,
  },
  // Magnetic
  magnetic: {
    strength: 0.3,
    radius: 100,
  },
  // Tilt
  tilt: {
    maxAngle: 15,
    perspective: 1000,
    scale: 1.02,
  },
  // Reveal
  reveal: {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px',
  },
  // Glassmorphism
  glass: {
    backgroundDark: 'rgba(10, 26, 47, 0.7)',
    backgroundLight: 'rgba(255, 255, 255, 0.6)',
    borderDark: 'rgba(255, 255, 255, 0.1)',
    borderLight: 'rgba(0, 0, 0, 0.08)',
    backdropFilter: 'blur(20px) saturate(180%)',
    webkitBackdropFilter: 'blur(20px) saturate(180%)',
    elevation: {
      1: { shadow: '0 4px 20px rgba(0, 0, 0, 0.1)' },
      2: { shadow: '0 8px 30px rgba(0, 0, 0, 0.12)' },
      3: { shadow: '0 12px 40px rgba(0, 0, 0, 0.15)' },
      4: { shadow: '0 16px 50px rgba(0, 0, 0, 0.18)' },
      5: { shadow: '0 20px 60px rgba(0, 0, 0, 0.2)' },
    },
  },
};

export const designTokens = {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  transitions,
  zIndex,
  breakpoints,
  animation,
  threeD,
  effects,
};

export type DesignTokens = typeof designTokens;