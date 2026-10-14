import { ContentConfig } from './types';
import { campConfig } from './camp.config';

/**
 * Site copy.
 *
 * Every user-facing sentence on the public landing page, the /members login
 * page, the /apply form, the nav, and the footer lives here. Values that are
 * facts about the camp (name, email, location) come from camp.config.ts so
 * they only live in one place.
 *
 * Images point at files in packages/web/public/images. Icon keys are lucide
 * icon names registered in packages/web/src/lib/icons.ts.
 */

const camp = campConfig.name;
const members = campConfig.memberNoun.plural;
const member = campConfig.memberNoun.singular;

export const contentConfig: ContentConfig = {
  hero: {
    eyebrow: `A Burning Man theme camp · ${campConfig.location}`,
    title: camp,
    titleLines: ['Camp', campConfig.shortName],
    subtitle: campConfig.tagline,
    description:
      'A hand-raised world-tree that casts real shade, a glade to gather in, and a circle that builds it together and strikes it together, leaving no trace.',
    image: {
      src: '/images/hero.jpg',
      alt: `The Yggdrasil world-tree`,
    },
    cta: {
      primary: { text: 'Apply to join', link: '/apply', icon: 'arrow-right' },
      secondary: { text: 'Member login', link: '/login' },
    },
  },

  home: {
    fieldNotes: ['Tree raised.', 'Shade up.', 'Everybody builds.'],
    about: {
      eyebrow: 'What we do',
      title: 'Shade, story, and a place to land',
      description:
        'We raise a world-tree in the open playa and gather a circle beneath it. We gift what we would want to find at 3pm in a dust storm or 4am on the way home: real shade, a quiet place to sit, and people glad to see you.',
      cards: [
        {
          title: 'The world-tree',
          description:
            'A hand-built tree of steel and canopy that throws real shade over the glade. Our landmark and our shelter, raised by the whole camp.',
          image: { src: '/images/camp-day.jpg', alt: 'The Yggdrasil world-tree' },
          icon: 'sun',
        },
        {
          title: 'The glade',
          description:
            'Rugs, low light, and shade deep enough to rest under. Runes to draw, intentions tied to the branches, open to everyone walking by.',
          image: { src: '/images/lounge.jpg', alt: 'The Nordic forest glade at The Borderland' },
          icon: 'book-open',
        },
        {
          title: 'The circle',
          description:
            'Every root builds, runs, and strikes the camp. No service tiers, no spectators. We take it down together and leave no trace.',
          image: { src: '/images/build-crew.webp', alt: 'The circle raising the world-tree during build week' },
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
          description: 'Camp leads read every form and email you with next steps.',
          icon: 'clipboard-check',
        },
        {
          title: 'Pay dues',
          description: 'Dues cover shade, kitchen, water, power, and transport. Pay from your portal.',
          icon: 'credit-card',
        },
        {
          title: 'Sign up for shifts',
          description: 'Pick your build, glade, and strike shifts in the portal. Then pack.',
          icon: 'calendar',
        },
      ],
    },
    closing: {
      title: 'Come build it with us',
      description:
        "Whether this is your first burn or your fifteenth, if you want to help raise a tree and hold a circle where people feel met, we would love to hear from you. And because nothing grows on the playa, our gift reaches past it: we plant trees around the world in the camp's name.",
      image: { src: '/images/camp-night.webp', alt: `${camp} lit up at night under the tree` },
      cta: {
        primary: { text: 'Apply to join', link: '/apply', icon: 'arrow-right' },
        secondary: { text: 'Member login', link: '/login' },
      },
    },
  },

  navigation: {
    lockupSubtitle: 'Sprung from the Nordic forest at The Borderland',
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
    nonprofitBlurb: 'Built and struck by its roots. We plant trees beyond the playa and try to leave the land better than we found it.',
  },

  members: {
    eyebrow: 'Members area',
    title: `For ${members}`,
    description: `Dues, shifts, housing, announcements, and everything else you need between now and strike. Sign in to reach your portal.`,
    highlights: [
      {
        title: 'Your portal',
        description: 'See your dues, pay online, and keep your profile and housing details current.',
        icon: 'users',
      },
      {
        title: 'Shifts',
        description: 'Sign up for build, glade, and strike shifts and see who you are working with.',
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
      subtitle: 'Already a root? Sign in to reach your portal.',
      emailLabel: 'Email',
      passwordLabel: 'Password',
      submitButton: 'Sign in',
      notMemberText: 'Not a root yet?',
      applyLinkText: 'Apply to join',
    },
  },

  apply: {
    eyebrow: 'Join us',
    title: 'Interest form',
    intro: `${camp} is a volunteer-run theme camp. Every ${member} builds, runs, and strikes the camp together. Tell us a bit about yourself, and feel into what you would want to bring to a circle under one tree.`,
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
      'We would rather not tell you what to bring. Feel into it: what would you want to give to a small circle under one tree in the desert? We especially value people who step in without being asked.',
    contributionPlaceholder:
      'Examples: build crew · tending the glade · kitchen · MOOP / Leave No Trace · power & lighting · ritual & story · owning a project end to end.',
    strikeNote: 'Plan to leave the playa only after strike is finished, usually the Sunday or Monday after the burn.',
    success: {
      title: 'Interest form received',
      message: `Thank you for your interest in ${camp}. We read every form, and we will check in with the Nordic gods to see if they are in favor, then get back to you. Whatever happens, come find us under the tree.`,
    },
  },
};
