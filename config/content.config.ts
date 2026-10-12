import { ContentConfig } from './types';
import { campConfig } from './camp.config';

/**
 * Site copy.
 *
 * Every user-facing sentence on the public landing page, the /members login
 * page, the /apply form, the nav, and the footer lives here. Rewrite it in
 * your camp's voice. Values that are facts about the camp (name, email,
 * location) come from camp.config.ts so they only live in one place.
 *
 * Images point at files in packages/web/public/images. Replace those files
 * (same names) or change the paths here. Keep photos at or under ~2048px on
 * the long edge, as WebP or JPEG.
 *
 * Icon keys are lucide icon names registered in packages/web/src/lib/icons.ts.
 */

const camp = campConfig.name;
const members = campConfig.memberNoun.plural;

export const contentConfig: ContentConfig = {
  hero: {
    eyebrow: `A Burning Man theme camp · ${campConfig.location}`,
    title: camp,
    subtitle: campConfig.tagline,
    description:
      'A 24-hour coffee bar, a shaded lounge out of the afternoon sun, and a crew that builds it together every year.',
    image: {
      src: '/images/hero.webp',
      alt: `${camp} at golden hour on the playa`,
    },
    cta: {
      primary: { text: 'Apply to join', link: '/apply', icon: 'arrow-right' },
      secondary: { text: 'Member login', link: '/login' },
    },
  },

  home: {
    about: {
      eyebrow: 'What we do',
      title: 'Coffee, shade, and a place to land',
      description:
        'We gift what we would want to find at 3pm in a dust storm or 4am on the way home: something hot to drink, a seat in the shade, and people glad to see you.',
      cards: [
        {
          title: 'The coffee bar',
          description:
            'Pour-over and cold brew, day and night, staffed by campers in short shifts. Bring your own cup.',
          image: { src: '/images/camp-day.webp', alt: 'The coffee bar under shade during the day' },
          icon: 'coffee',
        },
        {
          title: 'The lounge',
          description:
            'Rugs, cushions, and shade cloth deep enough to nap under. Open to everyone walking by.',
          image: { src: '/images/lounge.webp', alt: 'Cushions and rugs in the shaded lounge' },
          icon: 'sun',
        },
        {
          title: 'The crew',
          description:
            'Every camper builds, runs, and strikes the camp. No service tiers, no spectators.',
          image: { src: '/images/build-crew.webp', alt: 'Campers raising a shade structure during build week' },
          icon: 'hammer',
        },
      ],
    },
    joining: {
      eyebrow: 'Joining',
      title: 'How joining works',
      description: `We keep the camp small enough that everyone knows each other. Here is how new ${members} come aboard.`,
      steps: [
        {
          title: 'Apply',
          description: 'Fill out the interest form. It takes about ten minutes.',
          icon: 'clipboard-list',
        },
        {
          title: 'Get approved',
          description: 'Camp leads review every form and email you with next steps.',
          icon: 'clipboard-check',
        },
        {
          title: 'Pay dues',
          description: 'Dues cover shade, kitchen, water, power, and transport. Pay from your portal.',
          icon: 'credit-card',
        },
        {
          title: 'Sign up for shifts',
          description: 'Pick your build, bar, and strike shifts in the portal. Then pack.',
          icon: 'calendar',
        },
      ],
    },
    closing: {
      title: 'Come build it with us',
      description:
        'Whether this is your first burn or your fifteenth, if you like making a place where people feel welcome, we would love to hear from you.',
      image: { src: '/images/camp-night.webp', alt: `${camp} lit up at night` },
      cta: {
        primary: { text: 'Apply to join', link: '/apply', icon: 'arrow-right' },
        secondary: { text: 'Member login', link: '/login' },
      },
    },
  },

  navigation: {
    lockupSubtitle: campConfig.foundingYear
      ? `Burning Man theme camp, est. ${campConfig.foundingYear}`
      : 'Burning Man theme camp',
    items: [
      { label: 'Home', href: '/' },
      { label: 'Apply', href: '/apply' },
      { label: 'Members', href: '/members' },
    ],
  },

  footer: {
    tagline: campConfig.tagline,
    sections: [
      {
        title: 'Camp',
        links: [
          { label: 'Home', href: '/' },
          { label: 'Apply to join', href: '/apply' },
        ],
      },
      {
        title: 'Members',
        links: [
          { label: 'Members area', href: '/members' },
          { label: 'Log in', href: '/login' },
        ],
      },
    ],
    nonprofitBlurb: 'A nonprofit organization run entirely by volunteers.',
  },

  members: {
    eyebrow: 'Members area',
    title: `For ${members}`,
    description: `Dues, shifts, housing, announcements, and everything else you need between now and strike. Sign in to get to your portal.`,
    highlights: [
      {
        title: 'Your portal',
        description: 'See your dues, pay online, and keep your profile and housing details current.',
        icon: 'users',
      },
      {
        title: 'Shifts',
        description: 'Sign up for build, camp, and strike shifts and see who you are working with.',
        icon: 'calendar',
      },
      {
        title: 'Announcements',
        description: 'Arrival info, placement, and last-minute changes from the camp leads.',
        icon: 'mail',
      },
      {
        title: 'FAQ & resources',
        description: 'What to bring, how early arrival works, power, MOOP, and who to ask.',
        icon: 'book-open',
      },
    ],
    loginSection: {
      title: 'Member login',
      subtitle: 'Already in camp? Sign in to reach your portal.',
      emailLabel: 'Email',
      passwordLabel: 'Password',
      submitButton: 'Sign in',
      notMemberText: 'Not a member yet?',
      applyLinkText: 'Apply to join',
    },
  },

  apply: {
    eyebrow: 'Join us',
    title: 'Interest form',
    intro: `${camp} is a volunteer-run theme camp. Every member plays an active role in building, running, and striking the camp. Tell us a bit about yourself.`,
    requirements: {
      title: 'What membership involves',
      items: [
        'Embody the 10 Principles of Burning Man.',
        'Work at least two camp shifts during the week.',
        'Be present for strike. It is mandatory.',
        'Pay camp dues within a week of being accepted.',
      ],
      note: `This is an interest form. Submitting it does not guarantee a spot; ${camp} is intentionally small. Approved applicants are contacted individually by email.`,
    },
    firstTimerYesLabel: 'Yes, first burn',
    contributionPrompt:
      'Tell us how you have contributed to camps or communities before, or how you would like to help this year. We especially value people who step in without being asked.',
    contributionPlaceholder:
      'Examples: build crew · bar shifts · kitchen · MOOP / Leave No Trace · power & lighting · workshops · owning a project end to end.',
    strikeNote: 'Plan to leave the playa only after strike is finished, usually the Sunday or Monday after the burn.',
    success: {
      title: 'Interest form received',
      message: `Thank you for your interest in ${camp}. We review every form and will get back to you as soon as we can. Whatever happens, come find us on the playa.`,
    },
  },
};
