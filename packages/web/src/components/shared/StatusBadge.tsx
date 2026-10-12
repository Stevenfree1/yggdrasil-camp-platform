'use client';

interface StatusBadgeProps {
  status: string;
  variant?: 'season' | 'payment' | 'application';
}

const seasonColors: Record<string, { bg: string; text: string; dot: string }> = {
  CONFIRMED: { bg: 'bg-sage/10', text: 'text-sage', dot: 'bg-sage' },
  MAYBE: { bg: 'bg-gold/10', text: 'text-gold', dot: 'bg-gold' },
  INTERESTED: { bg: 'bg-sage/10', text: 'text-sage', dot: 'bg-sage/70' },
  WAITLISTED: { bg: 'bg-gold/10', text: 'text-gold', dot: 'bg-gold/70' },
  CANCELLED: { bg: 'bg-tan/30', text: 'text-ink-soft', dot: 'bg-ink-soft/50' },
};

const applicationColors: Record<string, { bg: string; text: string; dot: string }> = {
  // Legacy
  PENDING: { bg: 'bg-gold/10', text: 'text-gold', dot: 'bg-gold' },
  REVIEWED: { bg: 'bg-sage/10', text: 'text-sage', dot: 'bg-sage' },
  REJECTED: { bg: 'bg-error/10', text: 'text-error', dot: 'bg-error' },
  // Phase A pipeline
  SUBMITTED: { bg: 'bg-gold/10', text: 'text-gold', dot: 'bg-gold' },
  UNDER_REVIEW: { bg: 'bg-sage/15', text: 'text-sage', dot: 'bg-sage/70' },
  PRE_APPROVED: { bg: 'bg-sage/15', text: 'text-sage', dot: 'bg-sage' },
  APPROVED: { bg: 'bg-sage/15', text: 'text-sage', dot: 'bg-sage' },
  INVITED: { bg: 'bg-sage/20', text: 'text-sage', dot: 'bg-sage' },
  ACCEPTED: { bg: 'bg-sage/10', text: 'text-sage', dot: 'bg-sage' },
  DUES_PAID: { bg: 'bg-sage/20', text: 'text-sage', dot: 'bg-sage' },
  CONFIRMED: { bg: 'bg-sage/30', text: 'text-sage', dot: 'bg-sage' },
  WAITLISTED: { bg: 'bg-gold/10', text: 'text-gold', dot: 'bg-gold/70' },
  DECLINED: { bg: 'bg-error/10', text: 'text-error', dot: 'bg-error' },
  WITHDRAWN: { bg: 'bg-tan/30', text: 'text-ink-soft', dot: 'bg-ink-soft/50' },
};

// Hover hints — what each status actually means.
const seasonDescriptions: Record<string, string> = {
  INTERESTED: 'Has expressed interest in coming this season',
  MAYBE: 'Might come — not committed yet',
  CONFIRMED: 'Confirmed coming to the burn this season',
  WAITLISTED: 'On the waitlist for a camp spot',
  CANCELLED: 'Not coming this season',
};

const applicationDescriptions: Record<string, string> = {
  PENDING: 'Application received — waiting for review',
  REVIEWED: 'Application has been reviewed',
  REJECTED: 'Application rejected',
  SUBMITTED: 'Application received — waiting for review',
  UNDER_REVIEW: 'Being reviewed by camp leads',
  PRE_APPROVED: 'Pre-approved to join — needs to pay dues within the dues window',
  APPROVED: 'Application approved',
  INVITED: 'Invited to create their member account',
  ACCEPTED: 'Accepted their spot',
  DUES_PAID: 'Dues paid — awaiting final confirmation',
  CONFIRMED: 'Fully confirmed camp member for this season',
  WAITLISTED: 'On the waitlist — moves up when a spot opens',
  DECLINED: 'Application declined',
  WITHDRAWN: 'Applicant withdrew their application',
};

function formatStatusLabel(status: string): string {
  // "PRE_APPROVED" -> "Pre Approved"
  return status
    .toLowerCase()
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

export function StatusBadge({ status, variant = 'season' }: StatusBadgeProps) {
  if (variant === 'payment') {
    const isPaid = status === 'true' || status === 'Paid';
    return (
      <span
        className={`admin-status-badge inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold ${
          isPaid ? 'bg-sage/10 text-sage' : 'bg-error/10 text-error'
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${isPaid ? 'bg-sage' : 'bg-error'}`}
        />
        {isPaid ? 'Paid' : 'Unpaid'}
      </span>
    );
  }

  const colorMap = variant === 'application' ? applicationColors : seasonColors;
  const colors = colorMap[status] || { bg: 'bg-tan/30', text: 'text-ink-soft', dot: 'bg-ink-soft/50' };
  const descriptionMap = variant === 'application' ? applicationDescriptions : seasonDescriptions;

  return (
    <span
      title={descriptionMap[status]}
      className={`admin-status-badge inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold ${colors.bg} ${colors.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
      {formatStatusLabel(status)}
    </span>
  );
}
