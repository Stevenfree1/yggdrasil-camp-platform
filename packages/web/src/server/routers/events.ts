import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { router, publicProcedure, memberProcedure, managerProcedure, leadProcedure } from '../trpc';
import logger from '../lib/logger';

// --- Validation schemas ---

const createShiftInput = z.object({
  seasonId: z.string().uuid('Invalid season ID'),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional(),
  date: z.string().datetime({ message: 'Invalid date' }),
  startTime: z.string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must be in HH:MM format'),
  endTime: z.string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'End time must be in HH:MM format'),
  maxVolunteers: z.number().int().min(1).max(500).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
});

const updateShiftInput = z.object({
  id: z.string().uuid('Invalid event ID'),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  date: z.string().datetime().optional(),
  startTime: z.string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must be in HH:MM format')
    .optional(),
  endTime: z.string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'End time must be in HH:MM format')
    .optional(),
  maxVolunteers: z.number().int().min(1).max(500).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
});

const listEventsInput = z.object({
  seasonId: z.string().uuid().optional(),
  upcoming: z.boolean().optional().default(false),
  search: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
}).optional().default({});

// --- Router ---

export const eventsRouter = router({
  /** List events/shifts with optional filters (member+) */
  list: memberProcedure
    .input(listEventsInput)
    .query(async ({ ctx, input }) => {
      // Resolve seasonId: use provided or fall back to active season
      let seasonId = input.seasonId;
      if (!seasonId) {
        const activeSeason = await ctx.prisma.season.findFirst({
          where: { isActive: true },
          select: { id: true },
        });
        if (!activeSeason) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No active season found' });
        }
        seasonId = activeSeason.id;
      }

      const where: Prisma.ShiftWhereInput = { seasonId };

      if (input.upcoming) {
        where.date = { gte: new Date() };
      }

      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: 'insensitive' } },
          { description: { contains: input.search, mode: 'insensitive' } },
          { location: { contains: input.search, mode: 'insensitive' } },
        ];
      }

      const [events, total] = await Promise.all([
        ctx.prisma.shift.findMany({
          where,
          include: {
            assignments: {
              include: {
                seasonMember: {
                  include: {
                    member: { select: { id: true, name: true, playaName: true } },
                  },
                },
              },
            },
            _count: { select: { assignments: true } },
          },
          orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.shift.count({ where }),
      ]);

      // Transform for cleaner API response
      const items = events.map((event) => ({
        id: event.id,
        seasonId: event.seasonId,
        name: event.name,
        description: event.description,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        maxVolunteers: event.maxVolunteers,
        location: event.location,
        volunteerCount: event._count.assignments,
        isFull: event.maxVolunteers ? event._count.assignments >= event.maxVolunteers : false,
        volunteers: event.assignments.map((a) => ({
          assignmentId: a.id,
          memberId: a.seasonMember.member.id,
          memberName: a.seasonMember.member.name,
          playaName: a.seasonMember.member.playaName,
          status: a.status,
        })),
        createdAt: event.createdAt,
      }));

      return { events: items, total };
    }),

  /** Get a single event by ID with full volunteer list (member+) */
  getById: memberProcedure
    .input(z.object({ id: z.string().uuid('Invalid event ID') }))
    .query(async ({ ctx, input }) => {
      const event = await ctx.prisma.shift.findUnique({
        where: { id: input.id },
        include: {
          season: { select: { id: true, year: true, name: true } },
          assignments: {
            include: {
              seasonMember: {
                include: {
                  member: { select: { id: true, name: true, playaName: true, email: true } },
                },
              },
            },
          },
          _count: { select: { assignments: true } },
        },
      });

      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      return {
        id: event.id,
        seasonId: event.seasonId,
        season: event.season,
        name: event.name,
        description: event.description,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        maxVolunteers: event.maxVolunteers,
        location: event.location,
        volunteerCount: event._count.assignments,
        isFull: event.maxVolunteers ? event._count.assignments >= event.maxVolunteers : false,
        volunteers: event.assignments.map((a) => ({
          assignmentId: a.id,
          seasonMemberId: a.seasonMemberId,
          memberId: a.seasonMember.member.id,
          memberName: a.seasonMember.member.name,
          playaName: a.seasonMember.member.playaName,
          email: a.seasonMember.member.email,
          status: a.status,
        })),
        createdAt: event.createdAt,
      };
    }),

  /** List upcoming events for the active season (public, for website display) */
  listUpcoming: publicProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(20).optional().default(10),
    }).optional().default({}))
    .query(async ({ ctx, input }) => {
      const activeSeason = await ctx.prisma.season.findFirst({
        where: { isActive: true },
        select: { id: true, year: true, name: true },
      });

      if (!activeSeason) {
        return { events: [], seasonName: null };
      }

      const events = await ctx.prisma.shift.findMany({
        where: {
          seasonId: activeSeason.id,
          date: { gte: new Date() },
        },
        select: {
          id: true,
          name: true,
          description: true,
          date: true,
          startTime: true,
          endTime: true,
          location: true,
          maxVolunteers: true,
          _count: { select: { assignments: true } },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        take: input.limit,
      });

      return {
        events: events.map((e) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          date: e.date,
          startTime: e.startTime,
          endTime: e.endTime,
          location: e.location,
          spotsAvailable: e.maxVolunteers ? Math.max(0, e.maxVolunteers - e._count.assignments) : null,
        })),
        seasonName: activeSeason.name,
      };
    }),

  /** Create a new event/shift (admin only) */
  create: leadProcedure
    .input(createShiftInput)
    .mutation(async ({ ctx, input }) => {
      // Verify season exists
      const season = await ctx.prisma.season.findUnique({
        where: { id: input.seasonId },
        select: { id: true, name: true },
      });

      if (!season) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Season not found' });
      }

      const event = await ctx.prisma.shift.create({
        data: {
          seasonId: input.seasonId,
          name: input.name,
          description: input.description,
          date: new Date(input.date),
          startTime: input.startTime,
          endTime: input.endTime,
          maxVolunteers: input.maxVolunteers,
          location: input.location,
        },
      });

      logger.info(`Event created: "${input.name}" by ${ctx.user.email}`);

      return event;
    }),

  /** Update an existing event/shift (admin only) */
  update: leadProcedure
    .input(updateShiftInput)
    .mutation(async ({ ctx, input }) => {
      const { id, date, ...rest } = input;

      const existing = await ctx.prisma.shift.findUnique({ where: { id } });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      const data: Prisma.ShiftUpdateInput = { ...rest };
      if (date !== undefined) {
        data.date = new Date(date);
      }

      const updated = await ctx.prisma.shift.update({
        where: { id },
        data,
      });

      logger.info(`Event updated: "${updated.name}" by ${ctx.user.email}`);

      return updated;
    }),

  /** Delete an event/shift (admin only) */
  delete: leadProcedure
    .input(z.object({ id: z.string().uuid('Invalid event ID') }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.shift.findUnique({
        where: { id: input.id },
        select: { id: true, name: true, _count: { select: { assignments: true } } },
      });

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      if (existing._count.assignments > 0) {
        logger.warn(`Deleting event "${existing.name}" which has ${existing._count.assignments} volunteer(s) assigned`);
      }

      await ctx.prisma.shift.delete({ where: { id: input.id } });

      logger.info(`Event deleted: "${existing.name}" by ${ctx.user.email}`);

      return { success: true };
    }),

  /** RSVP / sign up for an event (member) */
  rsvp: memberProcedure
    .input(z.object({
      shiftId: z.string().uuid('Invalid event ID'),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Look up the event
      const event = await ctx.prisma.shift.findUnique({
        where: { id: input.shiftId },
        select: {
          id: true,
          name: true,
          seasonId: true,
          maxVolunteers: true,
          _count: { select: { assignments: true } },
        },
      });

      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      // Check capacity
      if (event.maxVolunteers && event._count.assignments >= event.maxVolunteers) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This event is full. No more volunteer spots available.' });
      }

      // Find the user's season member record for this season
      const seasonMember = await ctx.prisma.seasonMember.findUnique({
        where: {
          seasonId_memberId: {
            seasonId: event.seasonId,
            memberId: ctx.user.id,
          },
        },
      });

      if (!seasonMember) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You must be enrolled in this season to sign up for events',
        });
      }

      // Check for existing assignment
      const existing = await ctx.prisma.shiftAssignment.findUnique({
        where: {
          shiftId_seasonMemberId: {
            shiftId: input.shiftId,
            seasonMemberId: seasonMember.id,
          },
        },
      });

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'You are already signed up for this event' });
      }

      const assignment = await ctx.prisma.shiftAssignment.create({
        data: {
          shiftId: input.shiftId,
          seasonMemberId: seasonMember.id,
          status: 'CONFIRMED',
          notes: input.notes,
        },
      });

      logger.info(`RSVP: ${ctx.user.email} signed up for "${event.name}"`);

      return { assignment, eventName: event.name };
    }),

  /** Cancel RSVP for an event (member) */
  cancelRsvp: memberProcedure
    .input(z.object({
      shiftId: z.string().uuid('Invalid event ID'),
    }))
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.prisma.shift.findUnique({
        where: { id: input.shiftId },
        select: { id: true, name: true, seasonId: true },
      });

      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      // Find the user's season member record
      const seasonMember = await ctx.prisma.seasonMember.findUnique({
        where: {
          seasonId_memberId: {
            seasonId: event.seasonId,
            memberId: ctx.user.id,
          },
        },
      });

      if (!seasonMember) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You are not enrolled in this season' });
      }

      const assignment = await ctx.prisma.shiftAssignment.findUnique({
        where: {
          shiftId_seasonMemberId: {
            shiftId: input.shiftId,
            seasonMemberId: seasonMember.id,
          },
        },
      });

      if (!assignment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'You are not signed up for this event' });
      }

      await ctx.prisma.shiftAssignment.delete({
        where: { id: assignment.id },
      });

      logger.info(`RSVP cancelled: ${ctx.user.email} withdrew from "${event.name}"`);

      return { success: true, eventName: event.name };
    }),

  /** Admin: assign a member to an event (manager+) */
  assignVolunteer: managerProcedure
    .input(z.object({
      shiftId: z.string().uuid('Invalid event ID'),
      seasonMemberId: z.string().uuid('Invalid season member ID'),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.prisma.shift.findUnique({
        where: { id: input.shiftId },
        select: { id: true, name: true, maxVolunteers: true, _count: { select: { assignments: true } } },
      });

      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      const seasonMember = await ctx.prisma.seasonMember.findUnique({
        where: { id: input.seasonMemberId },
        include: { member: { select: { name: true, email: true } } },
      });

      if (!seasonMember) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Season member not found' });
      }

      // Check for existing assignment
      const existing = await ctx.prisma.shiftAssignment.findUnique({
        where: {
          shiftId_seasonMemberId: {
            shiftId: input.shiftId,
            seasonMemberId: input.seasonMemberId,
          },
        },
      });

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'This member is already assigned to this event' });
      }

      const assignment = await ctx.prisma.shiftAssignment.create({
        data: {
          shiftId: input.shiftId,
          seasonMemberId: input.seasonMemberId,
          status: 'ASSIGNED',
          notes: input.notes,
        },
      });

      logger.info(`Volunteer assigned: ${seasonMember.member.name} to "${event.name}" by ${ctx.user.email}`);

      return assignment;
    }),

  /** Admin: remove a member from an event (manager+) */
  removeVolunteer: managerProcedure
    .input(z.object({
      assignmentId: z.string().uuid('Invalid assignment ID'),
    }))
    .mutation(async ({ ctx, input }) => {
      const assignment = await ctx.prisma.shiftAssignment.findUnique({
        where: { id: input.assignmentId },
        include: {
          shift: { select: { name: true } },
          seasonMember: {
            include: { member: { select: { name: true } } },
          },
        },
      });

      if (!assignment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Assignment not found' });
      }

      await ctx.prisma.shiftAssignment.delete({
        where: { id: input.assignmentId },
      });

      logger.info(`Volunteer removed: ${assignment.seasonMember.member.name} from "${assignment.shift.name}" by ${ctx.user.email}`);

      return { success: true };
    }),

  /** Update a volunteer assignment status (manager+) */
  updateAssignmentStatus: managerProcedure
    .input(z.object({
      assignmentId: z.string().uuid('Invalid assignment ID'),
      status: z.enum(['ASSIGNED', 'CONFIRMED', 'COMPLETED', 'NO_SHOW']),
    }))
    .mutation(async ({ ctx, input }) => {
      const assignment = await ctx.prisma.shiftAssignment.findUnique({
        where: { id: input.assignmentId },
      });

      if (!assignment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Assignment not found' });
      }

      return ctx.prisma.shiftAssignment.update({
        where: { id: input.assignmentId },
        data: { status: input.status },
      });
    }),

  /** Get events the current user is signed up for (member) */
  getMyEvents: memberProcedure
    .query(async ({ ctx }) => {
      const activeSeason = await ctx.prisma.season.findFirst({
        where: { isActive: true },
        select: { id: true },
      });

      if (!activeSeason) {
        return [];
      }

      const seasonMember = await ctx.prisma.seasonMember.findUnique({
        where: {
          seasonId_memberId: {
            seasonId: activeSeason.id,
            memberId: ctx.user.id,
          },
        },
        select: { id: true },
      });

      if (!seasonMember) {
        return [];
      }

      const assignments = await ctx.prisma.shiftAssignment.findMany({
        where: { seasonMemberId: seasonMember.id },
        include: {
          shift: {
            select: {
              id: true,
              name: true,
              description: true,
              date: true,
              startTime: true,
              endTime: true,
              location: true,
            },
          },
        },
        orderBy: { shift: { date: 'asc' } },
      });

      return assignments.map((a) => ({
        assignmentId: a.id,
        status: a.status,
        notes: a.notes,
        event: a.shift,
      }));
    }),
});
