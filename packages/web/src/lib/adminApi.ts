/**
 * Admin API Service
 *
 * Centralizes all admin-related API calls to the tRPC backend.
 * Each function handles authentication, error mapping, and response parsing.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Server uses superjson transformer — responses are
// { result: { data: { json: <actual>, meta: ... } } }.
// Inputs also need to be wrapped: { json: <input> }.
function unwrap<T>(json: unknown): T {
  const r = json as { result?: { data?: { json?: T } } };
  return r.result?.data?.json as T;
}

async function trpcQuery<T>(
  path: string,
  input?: Record<string, unknown>,
): Promise<T> {
  const qs = input
    ? `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
    : '';
  const res = await fetch(`/api/trpc/${path}${qs}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(`Request failed: ${path}`, res.status, text);
  }
  return unwrap<T>(await res.json());
}

export { trpcQuery };

async function trpcMutation<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`/api/trpc/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json: body }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(`Mutation failed: ${path}`, res.status, text);
  }
  return unwrap<T>(await res.json());
}

export { trpcMutation };

export class ApiError extends Error {
  status: number;
  body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export function getApiErrorMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;

  try {
    const parsed = JSON.parse(error.body) as {
      error?: {
        message?: string;
        data?: { code?: string };
      };
    };
    const code = parsed.error?.data?.code;
    const message = parsed.error?.message;

    if (code && message) return `${code}: ${message}`;
    if (message) return message;
    if (code) return code;
  } catch {
    // Fall back to HTTP status below.
  }

  return `HTTP ${error.status}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardData {
  totalMembers: number;
  confirmed: number;
  maybe: number;
  interested: number;
  waitlisted: number;
  cancelled: number;
  totalCollected: number;
  totalPayments: number;
  pendingApplications: number;
  duesProgress: {
    collected: number;
    expected: number;
    confirmedMembers: number;
    percent: number;
  };
  recentPayments: RecentPayment[];
  recentApplications: RecentApplication[];
  season: { id: string; name: string; year: number } | null;
}

export interface RecentPayment {
  id: string;
  paidAt: string;
  memberName: string;
  playaName?: string;
  amount: number;
  type: string;
  method: string;
}

export interface RecentApplication {
  id: string;
  name: string;
  email: string;
  playaName?: string;
  experience: string;
  status: string;
  createdAt: string;
}

export interface Application {
  id: string;
  name: string;
  email: string;
  phone: string;
  playaName?: string;
  referredBy?: string;
  experience: string;
  interests?: string;
  contribution?: string;
  dietaryRestrictions?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  housingPreference?: string;
  message?: string;
  status: string;
  reviewedBy?: string;
  reviewNotes?: string;
  createdAt: string;
  // Phase A additions
  seasonId?: string | null;
  source?: string;
  externalResponseId?: string | null;
  submittedAt?: string;
  sponsorMemberId?: string | null;
  isBurningManFirstTime?: boolean | null;
  isCampReturning?: boolean | null;
  hasTicket?: boolean | null;
  strikeCommitment?: boolean | null;
  motivationText?: string | null;
  groupMembersText?: string | null;
  householdId?: string | null;
  reviewedByMemberId?: string | null;
  reviewedAt?: string | null;
  preApprovedAt?: string | null;
  invitedAt?: string | null;
  acceptedAt?: string | null;
  duesPaidAt?: string | null;
  confirmedAt?: string | null;
  declinedAt?: string | null;
  withdrawnAt?: string | null;
  // Eager-loaded relations from `applications.list` / `getById`
  sponsorMember?: { id: string; name: string; email: string } | null;
  reviewedByMember?: { id: string; name: string } | null;
  household?: { id: string; name: string | null } | null;
  season?: { id: string; year: number; name: string } | null;
}

export interface ApplicationListResult {
  applications: Application[];
  total: number;
}

export interface ApplicationCounts {
  PENDING: number;
  REVIEWED: number;
  SUBMITTED: number;
  UNDER_REVIEW: number;
  PRE_APPROVED: number;
  APPROVED: number;
  INVITED: number;
  ACCEPTED: number;
  DUES_PAID: number;
  CONFIRMED: number;
  WAITLISTED: number;
  DECLINED: number;
  REJECTED: number;
  WITHDRAWN: number;
  total: number;
  capacity: {
    capacity: number | null;
    confirmedCount: number;
    remaining: number | null;
  } | null;
}

export type ApplicationStatus =
  | 'PENDING' | 'REVIEWED' | 'SUBMITTED' | 'UNDER_REVIEW' | 'PRE_APPROVED'
  | 'APPROVED' | 'INVITED' | 'ACCEPTED' | 'DUES_PAID' | 'CONFIRMED' | 'WAITLISTED'
  | 'DECLINED' | 'REJECTED' | 'WITHDRAWN';

export interface SeasonMember {
  id: string;
  status: string;
  memberId: string;
  housingType?: string;
  housingSize?: string;
  gridPower: string;
  buildCrew: boolean;
  strikeCrew: boolean;
  isCampVirgin: boolean;
  isBMVirgin: boolean;
  addedToWhatsApp: boolean;
  // Dues / activation (rich roster read populates these; legacy `list` omits them)
  duesStatus: string;
  duesNote?: string | null;
  duesUpdatedAt?: string | null;
  activatedAt?: string | null;
  phone?: string;
  // Most-recent payment first (roster read returns take:1); empty on legacy `list`.
  payments?: Array<{ type: string; amount: number; method: string; paidAt: string }>;
  member: {
    id: string;
    name: string;
    email: string;
    playaName?: string;
    phone?: string;
    role: string;
    hasAvatar?: boolean;
  };
}

export interface SeasonMemberListResult {
  seasonMembers: SeasonMember[];
  total: number;
}

export interface MemberData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  playaName?: string;
  gender?: string;
  role: string;
  isActive: boolean;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  dietaryRestrictions?: string;
  allergies?: string;
  notes?: string;
  seasonMembers?: Array<{
    id: string;
    status: string;
    housingType?: string;
    housingSize?: string;
    gridPower: string;
    arrivalDate?: string;
    departureDate?: string;
    buildCrew: boolean;
    strikeCrew: boolean;
    specialRequests?: string;
    season: {
      id: string;
      year: number;
      name: string;
      isActive: boolean;
      startDate?: string | null;
      endDate?: string | null;
      buildStartDate?: string | null;
      strikeEndDate?: string | null;
    };
    payments: PaymentData[];
  }>;
}

export interface PaymentData {
  id: string;
  type: string;
  amount: number;
  method: string;
  paidTo?: string | null;
  paidAt: string;
  notes?: string | null;
  recordedBy?: string | null;
  processor?: string | null; // set for Stripe/PayPal records — locked from editing
}

export interface InviteResult {
  member: { id: string; email: string; name: string };
  inviteToken: string;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function fetchDashboardData(seasonId?: string): Promise<DashboardData> {
  // Phase 1: Fetch dashboard core + applications in parallel
  const params: Record<string, unknown> = {};
  if (seasonId) params.seasonId = seasonId;

  const [dashboardRaw, applicationsRaw] = await Promise.all([
    trpcQuery<{
      season: { id: string; name: string; year: number } | null;
      totalActiveMembers: number;
      membersByStatus: Record<string, number>;
      housingBreakdown: Record<string, number>;
      financial: { totalCollected: number; totalPayments: number };
      recentPayments: RecentPayment[];
    }>('dashboard.getAdminDashboard', params),

    trpcQuery<{ applications: Application[]; total: number }>(
      'applications.list',
      { status: 'PENDING', limit: 5, offset: 0 },
    ).catch(() => ({ applications: [] as Application[], total: 0 })),
  ]);

  // Phase 2: Use resolved season ID for payment summary
  const resolvedSeasonId = seasonId || dashboardRaw.season?.id;
  let paymentSummaryRaw: {
    totalCollected: number;
    totalPayments: number;
    duesProgress: { collected: number; expected: number; confirmedMembers: number };
  } | null = null;

  if (resolvedSeasonId) {
    paymentSummaryRaw = await trpcQuery<typeof paymentSummaryRaw>(
      'payments.getSummary',
      { seasonId: resolvedSeasonId },
    ).catch(() => null);
  }

  const statusMap = dashboardRaw.membersByStatus || {};
  const financial = dashboardRaw.financial || { totalCollected: 0, totalPayments: 0 };

  // Calculate dues progress
  let duesProgress = { collected: 0, expected: 0, confirmedMembers: 0, percent: 0 };
  if (paymentSummaryRaw?.duesProgress) {
    const dp = paymentSummaryRaw.duesProgress;
    duesProgress = {
      collected: dp.collected,
      expected: dp.expected,
      confirmedMembers: dp.confirmedMembers,
      percent: dp.expected > 0 ? Math.round((dp.collected / dp.expected) * 100) : 0,
    };
  }

  return {
    totalMembers: dashboardRaw.totalActiveMembers || 0,
    confirmed: statusMap.CONFIRMED || 0,
    maybe: statusMap.MAYBE || 0,
    interested: statusMap.INTERESTED || 0,
    waitlisted: statusMap.WAITLISTED || 0,
    cancelled: statusMap.CANCELLED || 0,
    totalCollected: financial.totalCollected,
    totalPayments: financial.totalPayments,
    pendingApplications: applicationsRaw.total,
    duesProgress,
    recentPayments: dashboardRaw.recentPayments || [],
    recentApplications: applicationsRaw.applications.slice(0, 5),
    season: dashboardRaw.season
      ? { id: dashboardRaw.season.id, name: dashboardRaw.season.name, year: dashboardRaw.season.year }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export async function fetchApplications(params?: {
  status?: string;
  statuses?: ApplicationStatus[];
  seasonId?: string;
  search?: string;
  needsSponsorReview?: boolean;
  limit?: number;
  offset?: number;
}): Promise<ApplicationListResult> {
  const input: Record<string, unknown> = {};
  if (params?.status && params.status !== 'all') input.status = params.status;
  if (params?.statuses && params.statuses.length > 0) input.statuses = params.statuses;
  if (params?.seasonId) input.seasonId = params.seasonId;
  if (params?.search) input.search = params.search;
  if (params?.needsSponsorReview) input.needsSponsorReview = true;
  if (params?.limit) input.limit = params.limit;
  if (params?.offset) input.offset = params.offset;

  const result = await trpcQuery<{ applications: Application[]; total: number }>(
    'applications.list',
    input,
  );

  return {
    applications: result.applications || [],
    total: result.total || 0,
  };
}

export async function fetchApplicationCounts(seasonId?: string): Promise<ApplicationCounts> {
  return trpcQuery<ApplicationCounts>('applications.getCounts', seasonId ? { seasonId } : {});
}

/** Update an application's status. Sets the appropriate transition timestamp
 *  (preApprovedAt / invitedAt / acceptedAt / etc.) and fires the corresponding
 *  email where one is wired (invited → approved template; declined → denied). */
export async function updateApplicationStatus(
  applicationId: string,
  status: ApplicationStatus,
  reviewNotes?: string,
): Promise<Application> {
  return trpcMutation<Application>('applications.updateStatus', {
    applicationId,
    status,
    reviewNotes: reviewNotes || undefined,
  });
}

/** Re-send the email for an application's current stage (no status change). */
export async function resendApplicationEmail(
  applicationId: string,
): Promise<{ success: boolean; email: string; kind: string }> {
  return trpcMutation<{ success: boolean; email: string; kind: string }>(
    'applications.resendStatusEmail',
    { applicationId },
  );
}

/** Sweep pre-approved applicants whose dues deadline has passed → WAITLISTED + email. */
export async function expireOverduePreApprovals(
  dryRun = false,
): Promise<{ found: number; expired: number; applicants: string[] }> {
  return trpcMutation<{ found: number; expired: number; applicants: string[] }>(
    'applications.expireOverduePreApprovals',
    { dryRun },
  );
}

export async function bulkUpdateApplicationStatus(
  applicationIds: string[],
  status: ApplicationStatus,
  options?: { reviewNotes?: string; sendEmails?: boolean },
): Promise<{ count: number }> {
  return trpcMutation<{ count: number }>('applications.bulkUpdateStatus', {
    applicationIds,
    status,
    reviewNotes: options?.reviewNotes || undefined,
    sendEmails: options?.sendEmails ?? true,
  });
}

export async function setApplicationSponsor(
  applicationId: string,
  sponsorMemberId: string | null,
): Promise<Application> {
  return trpcMutation<Application>('applications.setSponsor', {
    applicationId,
    sponsorMemberId,
  });
}

/** @deprecated Use updateApplicationStatus directly. Retained for back-compat. */
export async function reviewApplication(
  applicationId: string,
  status: 'ACCEPTED' | 'REJECTED' | 'WAITLISTED',
  reviewNotes?: string,
): Promise<Application> {
  return trpcMutation<Application>('applications.review', {
    applicationId,
    status,
    reviewNotes: reviewNotes || undefined,
  });
}

// ---------------------------------------------------------------------------
// Members (Season Members)
// ---------------------------------------------------------------------------

export async function fetchSeasonMembers(params?: {
  seasonId?: string;
  search?: string;
  status?: string;
  buildCrew?: boolean;
  strikeCrew?: boolean;
  limit?: number;
  offset?: number;
}): Promise<SeasonMemberListResult> {
  const input: Record<string, unknown> = {};
  if (params?.seasonId) input.seasonId = params.seasonId;
  if (params?.search) input.search = params.search;
  if (params?.status && params.status !== 'all') input.status = params.status;
  if (params?.buildCrew !== undefined) input.buildCrew = params.buildCrew;
  if (params?.strikeCrew !== undefined) input.strikeCrew = params.strikeCrew;
  if (params?.limit) input.limit = params.limit;
  if (params?.offset !== undefined) input.offset = params.offset;

  const result = await trpcQuery<{ seasonMembers: SeasonMember[]; total: number }>(
    'seasonMembers.list',
    input,
  );

  return {
    seasonMembers: result.seasonMembers || [],
    total: result.total || 0,
  };
}

/**
 * Roster for the shift assign picker. Hits `shifts.assignableMembers`, which is
 * gated on the SHIFTS scope rather than the MANAGER role, so a shifts admin who
 * is not a manager can actually fill cells. Returns names only — no dues,
 * housing, travel or phone. `fetchSeasonMembers` stays as-is for the
 * manager-gated pages (/admin/build, /admin/strike) that read the full roster.
 */
export async function fetchAssignableMembers(params?: {
  seasonId?: string;
  search?: string;
  limit?: number;
}): Promise<SeasonMemberListResult> {
  const input: Record<string, unknown> = {};
  if (params?.seasonId) input.seasonId = params.seasonId;
  if (params?.search) input.search = params.search;
  if (params?.limit) input.limit = params.limit;

  const result = await trpcQuery<{ seasonMembers: SeasonMember[] }>(
    'shifts.assignableMembers',
    input,
  );

  return {
    seasonMembers: result.seasonMembers || [],
    total: (result.seasonMembers || []).length,
  };
}

// ---------------------------------------------------------------------------
// Member Detail
// ---------------------------------------------------------------------------

export async function fetchMemberById(id: string): Promise<MemberData> {
  return trpcQuery<MemberData>('members.getById', { id });
}

export async function updateMemberProfile(
  id: string,
  data: Partial<{
    name: string;
    email: string;
    phone: string | null;
    playaName: string | null;
    gender: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    dietaryRestrictions: string | null;
    allergies: string | null;
    notes: string | null;
  }>,
): Promise<MemberData> {
  return trpcMutation<MemberData>('members.adminUpdate', { id, ...data });
}

export async function updateMemberRole(
  memberId: string,
  role: 'LEAD' | 'MANAGER' | 'STAFF' | 'MEMBER',
): Promise<unknown> {
  return trpcMutation('members.updateRole', { memberId, role });
}

/** Grant or revoke per-area admin scopes. LEAD only, enforced server-side. */
export async function setMemberAdminScopes(
  memberId: string,
  adminScopes: ('INVENTORY' | 'SHIFTS')[],
): Promise<unknown> {
  return trpcMutation('members.setAdminScopes', { memberId, adminScopes });
}

export async function deactivateMember(memberId: string): Promise<unknown> {
  return trpcMutation('members.deactivate', { memberId });
}

export async function inviteMember(
  email: string,
  name: string,
  seasonId?: string,
): Promise<InviteResult> {
  return trpcMutation<InviteResult>('members.invite', {
    email,
    name,
    ...(seasonId ? { seasonId } : {}),
  });
}

// ---------------------------------------------------------------------------
// Season Members (update)
// ---------------------------------------------------------------------------

export async function updateSeasonMemberStatus(
  id: string,
  status: string,
): Promise<unknown> {
  return trpcMutation('seasonMembers.updateStatus', { id, status });
}

export async function updateSeasonMemberHousing(
  id: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  return trpcMutation('seasonMembers.updateHousing', { id, ...data });
}

// ---------------------------------------------------------------------------
// Roster (dues / activation / payments management grid)
// ---------------------------------------------------------------------------

/** Rich active-season roster read for the `/admin/roster` grid. */
export async function fetchRoster(params?: {
  seasonId?: string;
  search?: string;
  status?: string;
  housingType?: string;
  gridPower?: string;
  buildCrew?: boolean;
  strikeCrew?: boolean;
  duesStatus?: 'UNPAID' | 'PAID' | 'WAIVED';
  invitedNotActive?: boolean;
  limit?: number;
  offset?: number;
}): Promise<SeasonMemberListResult> {
  const input: Record<string, unknown> = {};
  if (params?.seasonId) input.seasonId = params.seasonId;
  if (params?.search) input.search = params.search;
  if (params?.status && params.status !== 'all') input.status = params.status;
  if (params?.housingType) input.housingType = params.housingType;
  if (params?.gridPower) input.gridPower = params.gridPower;
  if (params?.buildCrew !== undefined) input.buildCrew = params.buildCrew;
  if (params?.strikeCrew !== undefined) input.strikeCrew = params.strikeCrew;
  if (params?.duesStatus) input.duesStatus = params.duesStatus;
  if (params?.invitedNotActive) input.invitedNotActive = true;
  if (params?.limit) input.limit = params.limit;
  if (params?.offset !== undefined) input.offset = params.offset;

  const result = await trpcQuery<{ seasonMembers: SeasonMember[]; total: number }>(
    'seasonMembers.roster',
    input,
  );

  return {
    seasonMembers: result.seasonMembers || [],
    total: result.total || 0,
  };
}

/** Set a season member's dues flag (UNPAID/PAID/WAIVED). WAIVED encourages a note. */
export async function setDuesStatus(params: {
  id: string;
  duesStatus: 'UNPAID' | 'PAID' | 'WAIVED';
  note?: string;
}): Promise<unknown> {
  return trpcMutation('seasonMembers.setDuesStatus', {
    id: params.id,
    duesStatus: params.duesStatus,
    note: params.note || undefined,
  });
}

/** Toggle a season member's Invited↔Active state (sets/clears activatedAt). */
export async function setActivation(params: {
  id: string;
  activated: boolean;
}): Promise<unknown> {
  return trpcMutation('seasonMembers.setActivation', {
    id: params.id,
    activated: params.activated,
  });
}

export interface RosterImportChange {
  memberId: string;
  name: string;
  field: string;
  from: string | null;
  to: string | null;
}

export interface RosterImportResult {
  dryRun: boolean;
  season: { id: string; year: number; name: string };
  matched: number;
  unmatched: number;
  errors: string[];
  changeCount: number;
  // Present on dry-run only:
  rowsWithChanges?: number;
  changes?: RosterImportChange[];
  // Present on apply only:
  updated?: number;
  failed?: number;
}

/**
 * SAFE roster CSV import. dryRun=true returns a preview diff with no writes;
 * dryRun=false applies dues/activation/housing changes to matched rows only.
 * Never creates/deletes members and never writes payments.
 */
export async function importRoster(params: {
  fileBase64: string;
  dryRun: boolean;
}): Promise<RosterImportResult> {
  return trpcMutation<RosterImportResult>('seasonMembers.importRoster', {
    fileBase64: params.fileBase64,
    dryRun: params.dryRun,
  });
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Communications
// ---------------------------------------------------------------------------

export interface ActionItemMember {
  id: string;
  name: string;
  email: string;
  playaName?: string;
}

export interface ActionItems {
  unpaidDues: { count: number; members: ActionItemMember[] };
  noTicket: { count: number; members: ActionItemMember[] };
  notOnWhatsApp: { count: number; members: ActionItemMember[] };
  noPreApproval: { count: number; members: ActionItemMember[] };
  pendingApplications: { count: number };
}

export async function fetchActionItems(seasonId?: string): Promise<ActionItems> {
  const input: Record<string, unknown> = {};
  if (seasonId) input.seasonId = seasonId;
  return trpcQuery<ActionItems>('communications.getActionItems', input);
}

export interface SendMassEmailResult {
  sent: number;
  failed: number;
  errors?: string[];
}

export async function sendMassEmail(data: {
  seasonId?: string;
  recipientFilter: string;
  customEmails?: string[];
  subject: string;
  body: string;
  /** Optional source template key — recorded in the audit log. */
  templateKey?: string;
}): Promise<SendMassEmailResult> {
  return trpcMutation<SendMassEmailResult>('communications.sendMassEmail', data);
}

/** A code-defined broadcast template (subject/body may contain {{merge}} fields). */
export interface MassEmailTemplate {
  key: string;
  label: string;
  description?: string;
  subject: string;
  body: string;
  variables: string[];
}

export async function fetchMassEmailTemplates(): Promise<MassEmailTemplate[]> {
  return trpcQuery<MassEmailTemplate[]>('communications.listTemplates');
}

export interface EmailListResult {
  emails: Array<{ name: string; email: string }>;
  count: number;
}

export async function generateEmailList(data: {
  seasonId?: string;
  filter: string;
  customEmails?: string[];
}): Promise<EmailListResult> {
  return trpcMutation<EmailListResult>('export.emailList', data);
}

// ---------------------------------------------------------------------------
// Email Log
// ---------------------------------------------------------------------------

export type EmailLogType =
  | 'WELCOME'
  | 'WELCOME_BACK'
  | 'PROFILE_SETUP'
  | 'APPLICATION_CONFIRMATION'
  | 'APPLICATION_APPROVED'
  | 'APPLICATION_DENIED'
  | 'PRE_APPROVAL_DUES'
  | 'PRE_APPROVAL_EXPIRED'
  | 'PASSWORD_RESET'
  | 'INVITE'
  | 'MEMBERSHIP_REMINDER'
  | 'DUES_INCREASE_REMINDER'
  | 'DONATION_RECEIPT'
  | 'MASS_EMAIL'
  | 'OTHER';

export type EmailLogStatus = 'SENT' | 'FAILED' | 'LOGGED_ONLY';

export interface EmailLogRow {
  id: string;
  to: string;
  memberId: string | null;
  type: EmailLogType;
  subject: string;
  status: EmailLogStatus;
  error: string | null;
  transport: string;
  triggeredByMemberId: string | null;
  openedAt: string | null;
  openCount: number;
  createdAt: string;
  member: { id: string; name: string; email: string } | null;
  triggeredBy: { id: string; name: string } | null;
}

export interface EmailLogResult {
  rows: EmailLogRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface EmailLogStats {
  total: number;
  sent: number;
  failed: number;
  opened: number;
}

export async function fetchEmailLog(params?: {
  search?: string;
  type?: EmailLogType;
  status?: EmailLogStatus;
  openedOnly?: boolean;
  memberId?: string;
  page?: number;
  limit?: number;
}): Promise<EmailLogResult> {
  const input: Record<string, unknown> = {};
  if (params?.search) input.search = params.search;
  if (params?.type) input.type = params.type;
  if (params?.status) input.status = params.status;
  if (params?.openedOnly) input.openedOnly = true;
  if (params?.memberId) input.memberId = params.memberId;
  if (params?.page) input.page = params.page;
  if (params?.limit) input.limit = params.limit;
  return trpcQuery<EmailLogResult>('emailLog.list', input);
}

export async function fetchEmailLogStats(): Promise<EmailLogStats> {
  return trpcQuery<EmailLogStats>('emailLog.stats');
}

export interface EmailPreview {
  type: EmailLogType;
  subject: string;
  html: string;
}

/** Every transactional email template rendered with sample data (read-only). */
export async function fetchEmailPreviews(): Promise<EmailPreview[]> {
  return trpcQuery<EmailPreview[]>('emailLog.previews');
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function recordPayment(data: {
  seasonMemberId: string;
  type: string;
  amount: number;
  method: string;
  paidAt: string;
  notes?: string;
}): Promise<unknown> {
  return trpcMutation('payments.create', data);
}

/** Edit a manually entered payment. Processor-recorded payments are rejected server-side. */
export async function updatePayment(data: {
  id: string;
  type?: string;
  amount?: number;
  method?: string;
  paidTo?: string | null;
  paidAt?: string;
  notes?: string | null;
}): Promise<unknown> {
  return trpcMutation('payments.update', data);
}

/** Delete a manually entered payment. Processor-recorded payments are rejected server-side. */
export async function deletePayment(id: string): Promise<unknown> {
  return trpcMutation('payments.delete', { id });
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export interface Expense {
  id: string;
  seasonId: string;
  description: string;
  amount: number; // cents
  paidBy: string;
  date: string;
  category: string | null;
  receiptUrl: string | null;
  needsReimbursement: boolean;
  reimbursed: boolean;
  reimbursedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  season?: { id: string; year: number; name: string };
}

export interface ExpenseListResult {
  expenses: Expense[];
  total: number;
  totalAmount: number; // cents
}

export interface ExpenseSummary {
  total: { amount: number; count: number };
  byPaidBy: Array<{ paidBy: string; amount: number; count: number }>;
  byCategory: Array<{ category: string | null; amount: number; count: number }>;
  reimbursementStatus: Array<{
    needsReimbursement: boolean;
    reimbursed: boolean;
    _count: number;
    _sum: { amount: number | null };
  }>;
}

export async function fetchExpenses(params?: {
  seasonId?: string;
  paidBy?: string;
  category?: string;
  needsReimbursement?: boolean;
  reimbursed?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<ExpenseListResult> {
  return trpcQuery<ExpenseListResult>('expenses.list', params as Record<string, unknown> | undefined);
}

export async function fetchExpenseSummary(seasonId: string): Promise<ExpenseSummary> {
  return trpcQuery<ExpenseSummary>('expenses.getSummary', { seasonId });
}

export async function createExpense(data: {
  seasonId: string;
  description: string;
  amount: number;
  paidBy: string;
  date: string;
  category?: string;
  receiptUrl?: string;
  needsReimbursement?: boolean;
  notes?: string;
}): Promise<Expense> {
  return trpcMutation<Expense>('expenses.create', data);
}

export async function markExpenseReimbursed(id: string, reimbursed: boolean): Promise<Expense> {
  return trpcMutation<Expense>('expenses.markReimbursed', { id, reimbursed });
}

// ---------------------------------------------------------------------------
// Build week
// ---------------------------------------------------------------------------

export interface BuildAssignmentDTO {
  id: string;
  seasonMemberId: string;
  memberId: string;
  name: string;
  email: string;
  playaName: string | null;
  wapTicketId: string | null;
  team: string | null;
  notes: string | null;
}

export interface BuildDayDTO {
  id: string;
  date: string;
  name: string;
  notes: string | null;
  assignmentCount: number;
  assignments: BuildAssignmentDTO[];
}

export interface BuildListResult {
  seasonId: string;
  buildDays: BuildDayDTO[];
}

export interface BuildSummary {
  seasonId: string;
  totalAssignments: number;
  dayCount: number;
  underfilledCount: number;
  days: Array<{
    id: string;
    name: string;
    date: string;
    headcount: number;
    isUnderfilled: boolean;
    teamCounts: Record<string, number>;
  }>;
  teamTotals: Record<string, number>;
}

export async function fetchBuild(seasonId?: string): Promise<BuildListResult> {
  return trpcQuery<BuildListResult>('build.list', seasonId ? { seasonId } : {});
}

export async function fetchBuildSummary(seasonId?: string): Promise<BuildSummary> {
  return trpcQuery<BuildSummary>('build.summary', seasonId ? { seasonId } : {});
}

export async function upsertBuildDay(data: {
  id?: string;
  seasonId?: string;
  date: string;
  name: string;
  notes?: string | null;
}): Promise<unknown> {
  return trpcMutation('build.upsertDay', data);
}

export async function deleteBuildDay(id: string): Promise<unknown> {
  return trpcMutation('build.deleteDay', { id });
}

export async function assignBuildMember(data: {
  buildDayId: string;
  seasonMemberId: string;
  wapTicketId?: string | null;
  team?: string | null;
  notes?: string | null;
}): Promise<unknown> {
  return trpcMutation('build.assignMember', data);
}

export async function updateBuildAssignment(data: {
  id: string;
  wapTicketId?: string | null;
  team?: string | null;
  notes?: string | null;
}): Promise<unknown> {
  return trpcMutation('build.updateAssignment', data);
}

export async function unassignBuildMember(assignmentId: string): Promise<unknown> {
  return trpcMutation('build.unassign', { assignmentId });
}

// ---------------------------------------------------------------------------
// Strike
// ---------------------------------------------------------------------------

export interface StrikeAssignmentDTO {
  id: string;
  seasonMemberId: string;
  memberId: string;
  name: string;
  email: string;
  playaName: string | null;
  team: string | null;
  notes: string | null;
}

export interface StrikeDayDTO {
  key: string;
  date: string | null;
  label: string;
  assignmentCount: number;
  assignments: StrikeAssignmentDTO[];
}

export interface StrikeListResult {
  seasonId: string;
  strikeDays: StrikeDayDTO[];
}

export interface StrikeSummary {
  seasonId: string;
  totalAssignments: number;
  dayCount: number;
  underfilledCount: number;
  days: Array<{
    key: string;
    date: string | null;
    headcount: number;
    isUnderfilled: boolean;
    teamCounts: Record<string, number>;
  }>;
  teamTotals: Record<string, number>;
}

export async function fetchStrike(seasonId?: string): Promise<StrikeListResult> {
  return trpcQuery<StrikeListResult>('strike.list', seasonId ? { seasonId } : {});
}

export async function fetchStrikeSummary(seasonId?: string): Promise<StrikeSummary> {
  return trpcQuery<StrikeSummary>('strike.summary', seasonId ? { seasonId } : {});
}

export async function assignStrikeMember(data: {
  seasonId?: string;
  seasonMemberId: string;
  departureDate?: string | null;
  team?: string | null;
  notes?: string | null;
}): Promise<unknown> {
  return trpcMutation('strike.assignMember', data);
}

export async function updateStrikeAssignment(data: {
  id: string;
  departureDate?: string | null;
  team?: string | null;
  notes?: string | null;
}): Promise<unknown> {
  return trpcMutation('strike.updateAssignment', data);
}

export async function unassignStrikeMember(assignmentId: string): Promise<unknown> {
  return trpcMutation('strike.unassign', { assignmentId });
}

// ---------------------------------------------------------------------------
// Shifts (during burn)
// ---------------------------------------------------------------------------

export interface ShiftAssignmentDTO {
  id: string;
  seasonMemberId: string;
  memberId: string;
  name: string;
  email: string;
  playaName: string | null;
  status: 'ASSIGNED' | 'CONFIRMED' | 'COMPLETED' | 'NO_SHOW';
  notes: string | null;
}

/** One cell of the shift grid: a named slot on a date, holding at most one person. */
export interface ShiftInstanceDTO {
  id: string;
  date: string;
  seasonMemberId: string | null;
  claimedAt: string | null;
  assignedById: string | null;
  seasonMember: {
    id: string;
    member: { id: string; name: string; playaName: string | null };
  } | null;
}

export interface ShiftSlotDTO {
  id: string;
  label: string;
  requirement: string | null;
  sortOrder: number;
  instances: ShiftInstanceDTO[];
}

export interface ShiftBlockDTO {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  sortOrder: number;
  slots: ShiftSlotDTO[];
}

export interface ShiftGridResult {
  season: {
    id: string;
    year: number;
    shiftSignupOpen: boolean;
    minShiftsPerMember: number;
  };
  dates: string[];
  blocks: ShiftBlockDTO[];
}

export interface ShiftUnderstaffed {
  min: number;
  members: Array<{
    seasonMemberId: string;
    memberId: string;
    name: string;
    playaName: string | null;
    email: string;
    count: number;
  }>;
}

export async function fetchShiftGrid(seasonId?: string): Promise<ShiftGridResult> {
  return trpcQuery<ShiftGridResult>('shifts.grid', seasonId ? { seasonId } : {});
}

export async function fetchShiftUnderstaffed(seasonId?: string): Promise<ShiftUnderstaffed> {
  return trpcQuery<ShiftUnderstaffed>('shifts.understaffed', seasonId ? { seasonId } : {});
}

export async function setShiftSignupOpen(open: boolean, seasonId?: string): Promise<unknown> {
  return trpcMutation('shifts.setSignupOpen', seasonId ? { open, seasonId } : { open });
}

export async function upsertShiftBlock(data: {
  id?: string;
  seasonId?: string;
  name: string;
  startTime: string;
  endTime: string;
  notes?: string | null;
  sortOrder?: number;
}): Promise<unknown> {
  return trpcMutation('shifts.upsertBlock', data);
}

export async function deleteShiftBlock(
  id: string,
  confirmDropOccupants = false,
): Promise<unknown> {
  return trpcMutation('shifts.deleteBlock', { id, confirmDropOccupants });
}

export async function upsertShiftSlot(data: {
  id?: string;
  blockId: string;
  label: string;
  requirement?: string | null;
  sortOrder?: number;
}): Promise<unknown> {
  return trpcMutation('shifts.upsertSlot', data);
}

export async function deleteShiftSlot(id: string, confirmDropOccupants = false): Promise<unknown> {
  return trpcMutation('shifts.deleteSlot', { id, confirmDropOccupants });
}

export async function generateShiftInstances(blockId: string, dates: string[]): Promise<unknown> {
  return trpcMutation('shifts.generateInstances', { blockId, dates });
}

export async function removeShiftInstances(
  blockId: string,
  dates: string[],
  confirmDropOccupants = false,
): Promise<unknown> {
  return trpcMutation('shifts.removeInstances', { blockId, dates, confirmDropOccupants });
}

export async function assignShiftInstance(
  instanceId: string,
  seasonMemberId: string,
): Promise<unknown> {
  return trpcMutation('shifts.assign', { instanceId, seasonMemberId });
}

export async function clearShiftInstance(instanceId: string): Promise<unknown> {
  return trpcMutation('shifts.clear', { instanceId });
}

// ---------------------------------------------------------------------------
// Announcements (lead-only writes; admin list includes unpublished/expired)
// ---------------------------------------------------------------------------

export type AnnouncementPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  isPublished: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  author: { id: string; name: string; playaName: string | null } | null;
}

export async function fetchAnnouncementsAdmin(): Promise<{
  announcements: Announcement[];
  total: number;
}> {
  return trpcQuery('announcements.list', {
    includeUnpublished: true,
    includeExpired: true,
    limit: 100,
  });
}

export async function createAnnouncement(data: {
  title: string;
  content: string;
  priority: AnnouncementPriority;
  isPublished: boolean;
  expiresAt?: string;
}): Promise<Announcement> {
  return trpcMutation('announcements.create', data);
}

export async function updateAnnouncement(data: {
  id: string;
  title?: string;
  content?: string;
  priority?: AnnouncementPriority;
  isPublished?: boolean;
  expiresAt?: string | null;
}): Promise<Announcement> {
  return trpcMutation('announcements.update', data);
}

export async function deleteAnnouncement(id: string): Promise<unknown> {
  return trpcMutation('announcements.delete', { id });
}
