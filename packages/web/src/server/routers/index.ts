import { router } from '../trpc';
import { authRouter } from './auth';
import { membersRouter } from './members';
import { seasonsRouter } from './seasons';
import { seasonMembersRouter } from './seasonMembers';
import { paymentsRouter } from './payments';
import { chargesRouter } from './charges';
import { expensesRouter } from './expenses';
import { budgetsRouter } from './budgets';
import { dashboardRouter } from './dashboard';
import { applicationsRouter } from './applications';
import { announcementsRouter } from './announcements';
import { eventsRouter } from './events';
import { invitationsRouter } from './invitations';
import { communicationsRouter } from './communications';
import { importRouter } from './import';
import { exportRouter } from './export';
import { ticketsRouter } from './tickets';
import { buildRouter } from './build';
import { strikeRouter } from './strike';
import { shiftsRouter } from './shifts';
import { lodgingRouter } from './lodging';
import { emailLogRouter } from './emailLog';
import { inventoryRouter } from './inventory';

export const appRouter = router({
  auth: authRouter,
  members: membersRouter,
  seasons: seasonsRouter,
  seasonMembers: seasonMembersRouter,
  payments: paymentsRouter,
  charges: chargesRouter,
  expenses: expensesRouter,
  budgets: budgetsRouter,
  dashboard: dashboardRouter,
  applications: applicationsRouter,
  announcements: announcementsRouter,
  events: eventsRouter,
  invitations: invitationsRouter,
  communications: communicationsRouter,
  import: importRouter,
  export: exportRouter,
  tickets: ticketsRouter,
  build: buildRouter,
  strike: strikeRouter,
  shifts: shiftsRouter,
  lodging: lodgingRouter,
  emailLog: emailLogRouter,
  inventory: inventoryRouter,
});

export type AppRouter = typeof appRouter;
