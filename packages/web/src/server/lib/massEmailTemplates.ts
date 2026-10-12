/**
 * Code-defined broadcast email templates. Plain data so it maps 1:1 to a future
 * `EmailTemplate` DB table + editor — the send path consumes already-rendered
 * subject/body and is indifferent to where the template came from.
 *
 * Bodies are plain text with {{merge}} fields (firstName, seasonName,
 * duesAmount). They are prefilled into the editable composer and wrapped in the
 * camp-branded HTML shell at send time. Bracketed [placeholders] are prompts for
 * the admin to fill in before sending.
 */
import { getCampConfig } from '@/lib/config';

const campConfig = getCampConfig();
const CAMP_NAME = campConfig.name;
const APP_URL = (process.env.APP_URL || campConfig.website).replace(/\/+$/, '');

export interface MassEmailTemplate {
  /** Stable id, e.g. 'dues_reminder'. */
  key: string;
  label: string;
  description?: string;
  subject: string;
  body: string;
  /** Merge fields the template uses, for the composer's "fields available" hint. */
  variables: string[];
}

export const MASS_EMAIL_TEMPLATES: MassEmailTemplate[] = [
  {
    key: 'dues_reminder',
    label: 'Dues Reminder',
    description: 'Nudge members to pay dues before the price goes up.',
    subject: 'Reminder: your ' + CAMP_NAME + ' dues',
    body: [
      'Hi {{firstName}},',
      '',
      'A quick reminder that your dues for {{seasonName}} are {{duesAmount}}. Dues may go up as the event gets closer, so paying early locks in the lowest rate.',
      '',
      'You can pay anytime from your member portal:',
      `${APP_URL}/portal/payments`,
      '',
      'A note on refunds: because we start making camp commitments and purchases well before the event, we can’t guarantee refunds for last-minute cancellations. Please make sure you’re committed before paying.',
      '',
      'Questions about your dues? Just reply to this email.',
      '',
      'See you in the dust,',
      'The ' + CAMP_NAME + ' Team',
    ].join('\n'),
    variables: ['firstName', 'seasonName', 'duesAmount'],
  },
  {
    key: 'build_strike_call',
    label: 'Build / Strike Call',
    description: 'Rally crew for a build or strike shift.',
    subject: CAMP_NAME + ' {{seasonName}}: crew call',
    body: [
      'Hi {{firstName}},',
      '',
      'We’re lining up crew for {{seasonName}} and would love your hands.',
      '',
      '[Add the dates, what to bring, and where to sign up here.]',
      '',
      'Reply if you can make it — every shift helps.',
      '',
      'The ' + CAMP_NAME + ' Team',
    ].join('\n'),
    variables: ['firstName', 'seasonName'],
  },
  {
    key: 'general_announcement',
    label: 'General Announcement',
    description: 'A blank, personalized announcement to a segment.',
    subject: 'A note from ' + CAMP_NAME,
    body: ['Hi {{firstName}},', '', '[Your message here.]', '', 'The ' + CAMP_NAME + ' Team'].join('\n'),
    variables: ['firstName'],
  },
];

export function getMassEmailTemplate(key: string): MassEmailTemplate | undefined {
  return MASS_EMAIL_TEMPLATES.find((t) => t.key === key);
}
