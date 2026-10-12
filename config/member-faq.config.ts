import { campConfig } from './camp.config';

/**
 * Member FAQ shown at /members/faq.
 *
 * Kept in code (not the database) because it changes once or twice a season
 * and editing a file is no harder than editing an admin form. To update it,
 * edit the list below and ship a commit.
 *
 * The answers are a starting point written for a typical mid-sized theme camp.
 * Rewrite them to match how your camp actually runs: dues amounts, shift
 * counts, what the camp provides, and who to contact.
 *
 * `icon` is a key mapped to a lucide icon in the FAQ page (members/faq/page.tsx).
 * Available keys: heart, map-pin, zap, utensils, droplet, door-closed,
 * shower-head, tent, music, sparkles, truck, heart-pulse, badge-dollar-sign,
 * users, backpack, hammer, phone.
 */

export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqCategory {
  id: string;
  title: string;
  icon: string;
  items: FaqItem[];
}

const camp = campConfig.name;
const member = campConfig.memberNoun.singular;
const members = campConfig.memberNoun.plural;
const email = campConfig.email;

export const memberFaq: FaqCategory[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    icon: 'heart',
    items: [
      {
        q: `What is ${camp}?`,
        a: `${campConfig.description} We are a participant-run camp, not a plug-and-play or service camp: nobody is paid, and every ${member} helps build, run, and strike the camp. If something falls short, treat it as a chance to fix it for everyone.`,
      },
      {
        q: 'What do you expect from every member?',
        a: 'Live the 10 Principles, pay dues on time, work your shifts, show up for strike, and look after your campmates. Everything else is a bonus.',
      },
    ],
  },
  {
    id: 'dues',
    title: 'Dues & Money',
    icon: 'badge-dollar-sign',
    items: [
      {
        q: 'What do my dues cover?',
        a: 'Dues pay for the shared infrastructure that makes camp livable: shade structures, the kitchen and communal meals, water, grey-water hauling, shared power, transport and storage of camp gear, and placement costs. They do not cover your ticket, vehicle pass, travel, or personal gear.',
      },
      {
        q: 'When are dues due, and how do I pay?',
        a: 'Dues are due shortly after you are accepted. Your exact amount and the pay button live on the Payments page of your portal. If paying in one go is a hardship, reach out to the camp leads before the deadline and we will work something out.',
      },
      {
        q: 'Are there extra fees?',
        a: 'Some add-ons, such as power for an AC unit, an RV spot, or a reserved housing spot, may carry an extra fee. Any that apply to you show up next to your dues in the portal.',
      },
      {
        q: 'Can I get a refund if I cannot make it?',
        a: `Tell us as early as possible. Most of the money is spent well before the burn, so refunds depend on timing and on whether we can fill your spot. Email ${email} to start the conversation.`,
      },
    ],
  },
  {
    id: 'tickets',
    title: 'Tickets & Vehicle Passes',
    icon: 'sparkles',
    items: [
      {
        q: 'Does the camp get me a ticket?',
        a: 'Everyone is responsible for their own ticket and vehicle pass. Try the main sale and the official resale marketplace first. Never buy from strangers on social media.',
      },
      {
        q: 'What is a directed ticket (DGS)?',
        a: 'Placed camps receive a small allocation of directed group sale (DGS) tickets from the organizers. We give them first to people who are essential to building and running camp (build crew, leads, infrastructure owners). If you need one, say so on your application; there are never enough for everyone.',
      },
    ],
  },
  {
    id: 'arrival',
    title: 'Early Arrival & Placement',
    icon: 'map-pin',
    items: [
      {
        q: 'What is early arrival (WAP)?',
        a: 'Early arrival lets build crew enter the city before gates open so camp is ready when everyone else arrives. Early arrival passes (WAPs) are limited and tied to build commitments. If you are on the build crew, the leads will add you to the list and the pass arrives by email from the organizers.',
      },
      {
        q: 'What do I do when I arrive?',
        a: 'Check in with whoever is on greeter duty, find your housing spot on the camp map in the portal, and park where the map tells you. Please do not set up in a spot that is not assigned to you; the layout is planned down to the foot.',
      },
      {
        q: 'Where is camp?',
        a: 'Our placement address is posted in the members area once the organizers release it, usually a few weeks before the burn.',
      },
    ],
  },
  {
    id: 'shifts',
    title: 'Build, Shifts & Strike',
    icon: 'hammer',
    items: [
      {
        q: 'How many shifts do I need to work?',
        a: `Every ${member} signs up for at least two shifts during the week. Typical shifts: kitchen, cleanup, greeter, ice run, shower and grey-water duty, and MOOP sweeps. Sign up on the Shifts page of your portal.`,
      },
      {
        q: 'What happens during build?',
        a: 'Build crew arrive early and put up shade, the kitchen, power, and common spaces. Build days start early and wrap before the worst of the afternoon heat. If you can join build, say so on your application; it is the most valuable thing you can give the camp.',
      },
      {
        q: 'Is strike mandatory?',
        a: 'Yes. Strike is when we take everything down, pack it, and leave no trace. Every member is required to be present, so plan to leave the playa only after strike is finished, and book flights and rides accordingly.',
      },
    ],
  },
  {
    id: 'packing',
    title: 'What to Bring',
    icon: 'backpack',
    items: [
      {
        q: 'What does the camp provide?',
        a: 'Shade over common areas, a shared kitchen, communal meals on most days, shower water, shared power for lights and charging, and a place to hang out. Check the members area for the current season’s list.',
      },
      {
        q: 'What do I need to bring?',
        a: 'Your own shelter and bedding with shade over it; a bike with lights and a lock; a headlamp and body lights; dust mask and goggles; a reusable cup, plate, and utensils; sunscreen, a hat, and warm layers for cold nights; snacks and any food beyond communal meals; and personal medications.',
      },
      {
        q: 'How much water should I bring?',
        a: 'Plan for at least 1.5 gallons (about 6 liters) per person per day for drinking and personal use, even if the camp supplies some water. Running out is a real emergency in the desert.',
      },
    ],
  },
  {
    id: 'housing',
    title: 'Housing',
    icon: 'tent',
    items: [
      {
        q: 'Where will I sleep?',
        a: 'In your own tent, shelter, or RV, in the spot assigned to you on the camp map. Tell us your housing type and size in your portal so we can plan the layout.',
      },
      {
        q: 'Can I share a space?',
        a: 'Please do. Sharing shelters and RVs saves space on a tight plot. List who you are sharing with in your housing details.',
      },
      {
        q: 'Do I need a shade structure over my tent?',
        a: 'Yes, unless your shelter is built for full desert sun. A simple shade tarp or carport over your tent makes mornings bearable. Secure everything with long rebar or lag-bolt stakes; the wind is serious.',
      },
    ],
  },
  {
    id: 'power',
    title: 'Power',
    icon: 'zap',
    items: [
      {
        q: 'Will there be power?',
        a: 'Shared power runs the kitchen, common-area lighting, and charging stations. Power is limited, so bring your own battery bank for personal devices.',
      },
      {
        q: 'Can I plug in an AC unit or fridge?',
        a: 'Only if you register it in advance. High-draw devices are planned into the power budget and may carry an extra fee. Unregistered appliances may be unplugged.',
      },
    ],
  },
  {
    id: 'moop',
    title: 'MOOP & Leave No Trace',
    icon: 'sparkles',
    items: [
      {
        q: 'What is MOOP?',
        a: 'Matter Out Of Place: anything that did not originate on the playa, from bottle caps to feathers and sequins. Camps are inspected after the event, and our future placement depends on leaving the ground spotless.',
      },
      {
        q: 'How do I help?',
        a: 'Pack out everything you bring, skip glitter and feathers, put a carpet or tarp under your shelter, and pick up anything you see. We run MOOP sweeps daily and a full line sweep during strike.',
      },
      {
        q: 'What about trash and grey water?',
        a: 'Sort trash into the camp bins as labelled. Never dump grey water on the ground; use the camp grey-water setup or your RV tanks.',
      },
    ],
  },
  {
    id: 'safety',
    title: 'Health & Safety',
    icon: 'heart-pulse',
    items: [
      {
        q: 'I have allergies, a disability, or a medical need. What should I do?',
        a: 'Let the camp leads know before the burn. Bring enough medication for the whole week plus extra, and tell a campmate where it is.',
      },
      {
        q: 'Is there a first-aid kit?',
        a: 'Yes, in the common area. For anything serious, go to the nearest medical station or flag down a ranger.',
      },
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    icon: 'phone',
    items: [
      {
        q: 'How will I hear about updates?',
        a: `Announcements are posted in the members area and emailed to all ${members}. Keep your email address up to date in your profile.`,
      },
      {
        q: 'Who do I contact with questions?',
        a: `Email ${email} and a camp lead will get back to you.`,
      },
    ],
  },
];
