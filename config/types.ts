/**
 * Type definitions for camp configuration system
 */

export interface CampConfig {
  // Basic Info
  name: string;
  /** Short form used in tight UI spots and email subjects, e.g. "Dust Devil" */
  shortName: string;
  /** What the camp calls its members, e.g. { singular: 'camper', plural: 'campers' } */
  memberNoun: { singular: string; plural: string };
  tagline: string;
  description: string;
  foundingYear?: number;

  // Organization
  legalName: string;
  /** e.g. '501(c)(3)'. Undefined means not a registered nonprofit. */
  taxStatus?: string;
  ein?: string;

  // Contact
  email: string;
  phone?: string;
  location: string;

  // URLs
  website: string;
  domain: string;

  // Social Media
  social: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    youtube?: string;
    soundcloud?: string;
  };

  /**
   * Your Black Rock City address, used by the lodging-map compass. Update it
   * each year once placement comes out. The camp is drawn between `street`
   * and the next ring out, e.g. { clock: '7:30', street: 'D' }.
   */
  brcPlacement?: { clock: string; street: string };

  // Features
  features: {
    events: boolean;
    donations: boolean;
    membership: boolean;
    forum: boolean;
    gallery: boolean;
    newsletter: boolean;
  };
}

export interface BrandConfig {
  // Colors (Legacy - for backward compatibility)
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: {
      primary: string;
      secondary: string;
    };
  };

  // Typography
  fonts: {
    display: string;
    accent?: string;
    body: string;
    ui: string;
  };

  // Theme (Legacy - for backward compatibility)
  theme: {
    style: string;
    patterns: string[];
    colors?: ThemeColors; // Extended theme colors
    gradients?: GradientPresets;
    shadows?: ShadowPresets;
    radius?: RadiusPresets;
    spacing?: SpacingPresets;
  };

  // Assets
  assets: {
    logo: string;
    logoLight: string;
    logoDark: string;
    favicon: string;
    ogImage: string;
    heroBackground?: string;
  };
}

export interface ContentConfig {
  /** Landing page hero */
  hero: {
    /** Small caps line above the title */
    eyebrow: string;
    /** Big title. Usually the camp name. */
    title: string;
    /** Optional smaller first line above the display name. */
    titleLines?: [string, string];
    subtitle: string;
    description: string;
    image: ImageRef;
    cta: {
      primary: CtaLink;
      secondary: CtaLink;
    };
  };

  /** Landing page sections below the hero */
  home: {
    /** Short camp mottos displayed on the landing-page strip. */
    fieldNotes: string[];
    about: {
      eyebrow: string;
      title: string;
      description: string;
      cards: HomeCard[];
    };
    joining: {
      eyebrow: string;
      title: string;
      description: string;
      steps: JoinStep[];
    };
    closing: {
      title: string;
      description: string;
      image: ImageRef;
      cta: {
        primary: CtaLink;
        secondary?: CtaLink;
      };
    };
  };

  /** Public top navigation (landing + apply pages) */
  navigation: {
    /** Small line under the camp name in the nav lockup */
    lockupSubtitle: string;
    items: NavigationItem[];
  };

  /** Public footer */
  footer: {
    tagline: string;
    sections: FooterSection[];
    /** Shown in the footer only when campConfig.taxStatus is set */
    nonprofitBlurb?: string;
  };

  /** /members landing (login + short intro for signed-out visitors) */
  members: {
    eyebrow: string;
    title: string;
    description: string;
    highlights: MemberHighlight[];
    loginSection: {
      title: string;
      subtitle: string;
      emailLabel: string;
      passwordLabel: string;
      submitButton: string;
      notMemberText: string;
      applyLinkText: string;
    };
  };

  /** /apply interest form copy */
  apply: {
    eyebrow: string;
    title: string;
    intro: string;
    requirements: {
      title: string;
      items: string[];
      note: string;
    };
    /** Label for the "first time at Burning Man?" yes answer */
    firstTimerYesLabel: string;
    contributionPrompt: string;
    contributionPlaceholder: string;
    /** Shown under the strike question, e.g. when people may leave */
    strikeNote: string;
    success: {
      title: string;
      message: string;
    };
  };
}

export interface ImageRef {
  src: string;
  alt: string;
}

export interface CtaLink {
  text: string;
  link: string;
  /** Lucide icon key (see src/lib/icons.ts) */
  icon?: string;
}

export interface NavigationItem {
  label: string;
  href: string;
}

export interface FooterSection {
  title: string;
  links: NavigationItem[];
}

export interface HomeCard {
  title: string;
  description: string;
  image: ImageRef;
  /** Lucide icon key (see src/lib/icons.ts) */
  icon: string;
}

export interface JoinStep {
  title: string;
  description: string;
  /** Lucide icon key (see src/lib/icons.ts) */
  icon: string;
}

export interface MemberHighlight {
  title: string;
  description: string;
  /** Lucide icon key (see src/lib/icons.ts) */
  icon: string;
}

// ========================================
// Theme System Types
// ========================================

export interface ColorVariants {
  DEFAULT: string;
  light: string;
  dark: string;
  50?: string;
  100?: string;
  200?: string;
  300?: string;
  400?: string;
  500?: string;
  600?: string;
  700?: string;
  800?: string;
  900?: string;
}

export interface ThemeColors {
  primary: ColorVariants;
  secondary: ColorVariants;
  accent: ColorVariants;
  neutral: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
  semantic: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverse: string;
  };
  border: {
    light: string;
    DEFAULT: string;
    dark: string;
  };
}

export interface GradientPresets {
  hero: string;
  card: string;
  button: string;
  decorative: string;
  primary: string;
  secondary: string;
  accent: string;
}

export interface ShadowPresets {
  sm: string;
  DEFAULT: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  inner: string;
  none: string;
}

export interface RadiusPresets {
  none: string;
  sm: string;
  DEFAULT: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  full: string;
}

export interface SpacingPresets {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  '4xl': string;
}
