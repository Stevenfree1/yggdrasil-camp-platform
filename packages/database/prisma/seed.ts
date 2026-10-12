/**
 * Demo seed: a small fictional camp (20 people, one season) so every screen
 * has something to show on first run. All names, emails, and numbers are made
 * up. Safe to re-run: it wipes the tables it fills first.
 *
 *   npm run db:seed            (from the repo root)
 *
 * Demo logins (password for all: campdemo123)
 *   admin@example.com    LEAD     full admin
 *   manager@example.com  MANAGER  admin, no destructive actions
 *   member@example.com   MEMBER   member portal only
 */
import { PrismaClient, type GridPower, type HousingType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'campdemo123';

/** Date-only values are stored at noon UTC so they render on the right day in every US timezone. */
function day(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function addDays(date: Date, n: number): Date {
  const out = new Date(date);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

/** Burning Man runs from the last Sunday of August through Labor Day (first Monday of September). */
function burnDates(year: number): { gatesOpen: Date; laborDay: Date } {
  const sep1 = day(year, 9, 1);
  const laborDay = addDays(sep1, (8 - sep1.getUTCDay()) % 7);
  return { gatesOpen: addDays(laborDay, -8), laborDay };
}

/** The next burn that hasn't ended yet. */
function upcomingYear(): number {
  const now = new Date();
  const y = now.getUTCFullYear();
  return now > burnDates(y).laborDay ? y + 1 : y;
}

type Person = {
  name: string;
  playaName?: string;
  email: string;
  role?: 'LEAD' | 'MANAGER' | 'STAFF' | 'MEMBER';
  housing: HousingType;
  grid: GridPower;
  status?: 'CONFIRMED' | 'INTERESTED' | 'WAITLISTED' | 'CANCELLED';
  paid?: boolean;
  build?: boolean;
  strike?: boolean;
  firstBurn?: boolean;
  firstYearWithCamp?: boolean;
};

const PEOPLE: Person[] = [
  { name: 'Jamie Rivera', playaName: 'Compass', email: 'admin@example.com', role: 'LEAD', housing: 'RV', grid: 'AMP_30', paid: true, build: true, strike: true },
  { name: 'Morgan Lee', playaName: 'Ratchet', email: 'manager@example.com', role: 'MANAGER', housing: 'SHIFTPOD', grid: 'AMP_15', paid: true, build: true, strike: true },
  { name: 'Casey Okafor', playaName: 'Espresso', email: 'member@example.com', housing: 'TENT', grid: 'NONE', paid: true, strike: true },
  { name: 'Riley Nakamura', playaName: 'Sparky', email: 'riley@example.com', role: 'STAFF', housing: 'SHIFTPOD', grid: 'AMP_15', paid: true, build: true },
  { name: 'Avery Thompson', playaName: 'Dusty', email: 'avery@example.com', housing: 'TENT', grid: 'NONE', paid: true, strike: true },
  { name: 'Jordan Patel', playaName: 'Moonbeam', email: 'jordan@example.com', housing: 'RV', grid: 'AMP_30', paid: true, build: true },
  { name: 'Taylor Brooks', email: 'taylor@example.com', housing: 'SHARED', grid: 'NONE', paid: true, firstBurn: true, firstYearWithCamp: true },
  { name: 'Quinn Alvarez', playaName: 'Rebar', email: 'quinn@example.com', housing: 'SHIFTPOD', grid: 'AMP_15', paid: true, build: true, strike: true },
  { name: 'Skyler Chen', playaName: 'Glitter', email: 'skyler@example.com', housing: 'TENT', grid: 'NONE', paid: true },
  { name: 'Drew Kowalski', playaName: 'Wrench', email: 'drew@example.com', housing: 'TRAILER', grid: 'AMP_30', paid: true, strike: true },
  { name: 'Parker Diaz', email: 'parker@example.com', housing: 'TENT', grid: 'NONE', paid: false, firstBurn: true, firstYearWithCamp: true },
  { name: 'Rowan Sullivan', playaName: 'Firefly', email: 'rowan@example.com', housing: 'SHIFTPOD', grid: 'AMP_15', paid: true },
  { name: 'Emerson Hayes', playaName: 'Cactus', email: 'emerson@example.com', housing: 'SHARED', grid: 'NONE', paid: true, firstYearWithCamp: true },
  { name: 'Sage Morales', playaName: 'Tumbleweed', email: 'sage@example.com', housing: 'TENT', grid: 'NONE', paid: false },
  { name: 'Finley Grant', email: 'finley@example.com', housing: 'SHIFTPOD', grid: 'AMP_15', paid: true, strike: true },
  { name: 'Harper Ward', playaName: 'Lantern', email: 'harper@example.com', housing: 'RV', grid: 'AMP_30', paid: true },
  { name: 'Reese Kim', email: 'reese@example.com', housing: 'TENT', grid: 'NONE', status: 'INTERESTED', paid: false, firstBurn: true, firstYearWithCamp: true },
  { name: 'Blake Foster', playaName: 'Gizmo', email: 'blake@example.com', housing: 'SHIFTPOD', grid: 'AMP_15', status: 'INTERESTED', paid: false },
  { name: 'Charlie Nguyen', email: 'charlie@example.com', housing: 'TENT', grid: 'NONE', status: 'WAITLISTED', paid: false, firstYearWithCamp: true },
  { name: 'Hayden Price', playaName: 'Mirage', email: 'hayden@example.com', housing: 'TENT', grid: 'NONE', status: 'CANCELLED', paid: false },
];

async function wipe() {
  // Children before parents.
  await prisma.$transaction([
    prisma.shiftInstance.deleteMany(),
    prisma.shiftSlot.deleteMany(),
    prisma.shiftBlock.deleteMany(),
    prisma.shiftAssignment.deleteMany(),
    prisma.shift.deleteMany(),
    prisma.lodgingAssignment.deleteMany(),
    prisma.lodgingUnit.deleteMany(),
    prisma.seasonMapConfig.deleteMany(),
    prisma.buildAssignment.deleteMany(),
    prisma.buildDay.deleteMany(),
    prisma.strikeAssignment.deleteMany(),
    prisma.earlyArrivalPass.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.expense.deleteMany(),
    prisma.budgetLine.deleteMany(),
    prisma.application.deleteMany(),
    prisma.announcement.deleteMany(),
    prisma.seasonMember.deleteMany(),
    prisma.inventoryItem.deleteMany(),
    prisma.season.deleteMany(),
    prisma.member.deleteMany(),
  ]);
}

async function main() {
  console.log('Seeding demo camp...');
  await wipe();

  const year = upcomingYear();
  const { gatesOpen, laborDay } = burnDates(year);
  const buildStart = addDays(gatesOpen, -4);
  const strikeEnd = addDays(laborDay, 2);

  const season = await prisma.season.create({
    data: {
      year,
      name: `${year}`,
      isActive: true,
      duesAmount: 45000, // cents
      gridFee30amp: 15000,
      gridFee50amp: 25000,
      startDate: gatesOpen,
      endDate: laborDay,
      buildStartDate: buildStart,
      strikeEndDate: strikeEnd,
      capacity: 25,
      minShiftsPerMember: 2,
      shiftSignupOpen: true,
    },
  });

  // ── Members + season roster ────────────────────────────────────────
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const seasonMembers: { id: string; person: Person; memberId: string }[] = [];

  for (const [i, p] of PEOPLE.entries()) {
    const member = await prisma.member.create({
      data: {
        name: p.name,
        playaName: p.playaName,
        email: p.email,
        passwordHash,
        role: p.role ?? 'MEMBER',
        adminScopes: p.role === 'STAFF' ? ['INVENTORY', 'SHIFTS'] : [],
        emailVerified: true,
        phone: `555-01${String(i).padStart(2, '0')}`,
        emergencyContactName: 'Demo Contact',
        emergencyContactPhone: '555-0199',
        dietaryRestrictions: i % 5 === 0 ? 'Vegetarian' : undefined,
      },
    });
    const status = p.status ?? 'CONFIRMED';
    const arrival = p.build ? buildStart : gatesOpen;
    const sm = await prisma.seasonMember.create({
      data: {
        seasonId: season.id,
        memberId: member.id,
        status,
        housingType: p.housing,
        housingSize: p.housing === 'SHIFTPOD' ? 'ShiftPod 3' : p.housing === 'RV' ? '28 ft' : undefined,
        gridPower: p.grid,
        arrivalDate: status === 'CONFIRMED' ? arrival : undefined,
        departureDate: status === 'CONFIRMED' ? (p.strike ? strikeEnd : laborDay) : undefined,
        travelMode: p.housing === 'RV' ? 'RV' : i % 3 === 0 ? 'CARPOOL' : 'CAR',
        rideStatus: i % 4 === 0 ? 'HAVE_ROOM' : 'SORTED',
        buildCrew: !!p.build,
        strikeCrew: !!p.strike,
        isBMVirgin: !!p.firstBurn,
        isCampVirgin: !!p.firstYearWithCamp,
        duesStatus: p.paid ? 'PAID' : 'UNPAID',
        activatedAt: status === 'CONFIRMED' ? new Date() : undefined,
      },
    });
    seasonMembers.push({ id: sm.id, person: p, memberId: member.id });

    if (p.paid) {
      await prisma.payment.create({
        data: {
          seasonMemberId: sm.id,
          type: 'DUES',
          amount: season.duesAmount,
          method: (['VENMO', 'ZELLE', 'CARD'] as const)[i % 3],
          paidAt: addDays(gatesOpen, -60 + i),
          notes: 'Demo payment',
        },
      });
      if (p.grid === 'AMP_30') {
        await prisma.payment.create({
          data: {
            seasonMemberId: sm.id,
            type: 'GRID',
            amount: season.gridFee30amp,
            method: 'VENMO',
            paidAt: addDays(gatesOpen, -50 + i),
          },
        });
      }
    }
  }

  const confirmed = seasonMembers.filter((s) => (s.person.status ?? 'CONFIRMED') === 'CONFIRMED');
  const lead = seasonMembers[0];

  // ── Build week, early arrival, strike ──────────────────────────────
  const buildNames = ['Containers open, shade frame up', 'Shade cloth and kitchen', 'Coffee bar and lounge', 'Power, lights, finishing'];
  const buildCrew = confirmed.filter((s) => s.person.build);
  for (const [i, name] of buildNames.entries()) {
    const bd = await prisma.buildDay.create({
      data: { seasonId: season.id, date: addDays(buildStart, i), name: `Day ${i + 1}: ${name}` },
    });
    for (const s of buildCrew) {
      await prisma.buildAssignment.create({
        data: { buildDayId: bd.id, seasonMemberId: s.id, team: i < 2 ? 'shade' : 'interior' },
      });
    }
  }
  for (const s of buildCrew) {
    await prisma.earlyArrivalPass.create({
      data: { seasonId: season.id, seasonMemberId: s.id, arrivalDate: buildStart },
    });
  }
  for (const s of confirmed.filter((c) => c.person.strike)) {
    await prisma.strikeAssignment.create({
      data: { seasonId: season.id, seasonMemberId: s.id, departureDate: strikeEnd, team: 'shade' },
    });
  }

  // ── Shifts: coffee bar blocks, one slot each, every burn day ───────
  const blocks = [
    { name: 'Morning coffee', startTime: '07:00', endTime: '10:00', label: 'Barista' },
    { name: 'Afternoon lounge', startTime: '14:00', endTime: '17:00', label: 'Host' },
    { name: 'Late-night coffee', startTime: '22:00', endTime: '01:00', label: 'Barista' },
  ];
  let claimIdx = 0;
  for (const [i, b] of blocks.entries()) {
    const block = await prisma.shiftBlock.create({
      data: { seasonId: season.id, name: b.name, startTime: b.startTime, endTime: b.endTime, sortOrder: i },
    });
    const slot = await prisma.shiftSlot.create({ data: { blockId: block.id, label: b.label, sortOrder: 0 } });
    for (let d = 1; d <= 7; d++) {
      // Roughly half the slots are already claimed.
      const claimer = (d + i) % 2 === 0 ? confirmed[claimIdx++ % confirmed.length] : undefined;
      await prisma.shiftInstance.create({
        data: {
          slotId: slot.id,
          date: addDays(gatesOpen, d),
          seasonMemberId: claimer?.id,
          claimedAt: claimer ? new Date() : undefined,
        },
      });
    }
  }

  // ── Applications for next year's intake ────────────────────────────
  const apps = [
    { name: 'Robin Castillo', email: 'robin.app@example.com', experience: 'FIRST_TIMER', status: 'SUBMITTED', first: true },
    { name: 'Alex Mercer', email: 'alex.app@example.com', experience: 'BEEN_BEFORE', status: 'UNDER_REVIEW', first: false },
    { name: 'Devon Shaw', email: 'devon.app@example.com', experience: 'VETERAN', status: 'PRE_APPROVED', first: false },
    { name: 'Kai Lindqvist', email: 'kai.app@example.com', experience: 'FIRST_TIMER', status: 'WAITLISTED', first: true },
  ] as const;
  for (const [i, a] of apps.entries()) {
    await prisma.application.create({
      data: {
        seasonId: season.id,
        name: a.name,
        email: a.email,
        phone: `555-02${i}0`,
        experience: a.experience,
        isBurningManFirstTime: a.first,
        isCampReturning: false,
        hasTicket: !a.first,
        strikeCommitment: true,
        referredBy: i % 2 === 0 ? 'Jamie Rivera' : undefined,
        motivationText: 'I love early mornings and want to help run the coffee bar.',
        contribution: i % 2 === 0 ? 'Carpentry, can drive a box truck' : 'Kitchen experience',
        status: a.status,
        submittedAt: addDays(new Date(), -10 + i * 2),
      },
    });
  }

  // ── Announcements ──────────────────────────────────────────────────
  const announcements = [
    { title: 'Dues are open', priority: 'HIGH', content: 'Season dues are open in the portal. Pay by the end of June to lock in your spot.' },
    { title: 'Shift signups are live', priority: 'NORMAL', content: 'Everyone signs up for at least two coffee or lounge shifts. Grab your slots in the portal under Shifts.' },
    { title: 'Build crew: early arrival passes', priority: 'NORMAL', content: 'Build crew, check that your arrival date is right in your profile so we can request early arrival passes.' },
  ] as const;
  for (const [i, a] of announcements.entries()) {
    await prisma.announcement.create({
      data: { ...a, authorId: lead.memberId, publishedAt: addDays(new Date(), -i * 7) },
    });
  }

  // ── Tickets (Directed Group Sale) ──────────────────────────────────
  for (const [i, s] of confirmed.slice(0, 6).entries()) {
    await prisma.ticket.create({
      data: {
        seasonId: season.id,
        memberId: s.memberId,
        type: 'DGS',
        vehiclePass: i % 2 === 0,
        status: i < 4 ? 'PURCHASED_CONFIRMED' : 'CONTACTED',
        purchaseConfirmed: i < 4,
      },
    });
  }

  // ── Inventory ──────────────────────────────────────────────────────
  const inventory = [
    { category: 'SHADE', name: 'Shade structure frame (40x60)', quantity: 1, storageLocation: 'Container A' },
    { category: 'SHADE', name: 'Aluminet shade cloth 20x40', quantity: 3, storageLocation: 'Container A' },
    { category: 'CONTAINER', name: '20 ft shipping container', quantity: 2, storageLocation: 'Storage yard' },
    { category: 'GENERATOR', name: '7.5 kW inverter generator', quantity: 1, storageLocation: 'Container B' },
    { category: 'ELECTRICAL', name: '30A distribution box', quantity: 3, storageLocation: 'Container B' },
    { category: 'KITCHEN', name: 'Commercial espresso machine', quantity: 1, storageLocation: 'Container B' },
    { category: 'KITCHEN', name: 'Propane camp stove', quantity: 2, storageLocation: 'Container B' },
    { category: 'FURNITURE', name: 'Lounge floor cushions', quantity: 16, storageLocation: 'Container A' },
    { category: 'BIKE', name: 'Camp loaner bikes', quantity: 4, storageLocation: 'Container A', condition: 'Two need new tubes' },
    { category: 'TOOLS', name: 'Impact driver kit', quantity: 2, storageLocation: 'Container B' },
    { category: 'DECOR', name: 'Warm-white string lights (100 ft)', quantity: 6, storageLocation: 'Container A' },
    { category: 'CONSUMABLES', name: 'Rebar stakes with caps', quantity: 120, storageLocation: 'Container B' },
  ] as const;
  await prisma.inventoryItem.createMany({ data: inventory.map((it) => ({ ...it })) });

  // ── Budget + expenses ──────────────────────────────────────────────
  const budget = [
    ['GENERATOR', 'Generator rental + service', 180000, 175000],
    ['FUEL', 'Diesel and propane', 120000, null],
    ['WATER', 'Potable water delivery', 60000, 60000],
    ['FOOD', 'Coffee beans, milk, shared meals', 250000, 98000],
    ['STORAGE', 'Container storage (annual)', 210000, 210000],
    ['TRUCKS', 'Box truck rental', 150000, null],
    ['SUPPLIES', 'Hardware, straps, zip ties', 50000, 31250],
  ] as const;
  for (const [category, description, est, actual] of budget) {
    await prisma.budgetLine.create({
      data: { seasonId: season.id, category, description, estimatedAmount: est, actualAmount: actual ?? undefined },
    });
  }
  const expenses = [
    { description: 'Coffee beans (bulk order)', amount: 64000, paidBy: 'Jamie Rivera', category: 'FOOD', needsReimbursement: true, reimbursed: true },
    { description: 'Ratchet straps and zip ties', amount: 31250, paidBy: 'Morgan Lee', category: 'SUPPLIES', needsReimbursement: true, reimbursed: false },
    { description: 'Container storage invoice', amount: 210000, paidBy: 'Camp account', category: 'STORAGE', needsReimbursement: false, reimbursed: false },
  ];
  for (const [i, e] of expenses.entries()) {
    await prisma.expense.create({ data: { ...e, seasonId: season.id, date: addDays(gatesOpen, -90 + i * 20) } });
  }

  // ── Lodging map: a 150x140 ft plot with a few structures ───────────
  await prisma.seasonMapConfig.create({
    data: { seasonId: season.id, siteWidthFt: 150, siteDepthFt: 140, gridSizeFt: 5, frontageBearing: 180, notes: 'Demo plot' },
  });
  const fixed = [
    { kind: 'SHADE_CLOTH', label: 'Main shade', x: 45, y: 10, w: 60, h: 40 },
    { kind: 'CONTAINER', label: 'Container A', x: 5, y: 125, w: 20, h: 8 },
    { kind: 'CONTAINER', label: 'Container B', x: 30, y: 125, w: 20, h: 8 },
    { kind: 'BIKE_PARKING', label: 'Bikes', x: 110, y: 5, w: 30, h: 8 },
    { kind: 'WATER_TANK', label: 'Water', x: 60, y: 126, w: 7, h: 7 },
  ] as const;
  for (const [i, u] of fixed.entries()) {
    await prisma.lodgingUnit.create({ data: { ...u, seasonId: season.id, sortOrder: i } });
  }
  // One sleeping unit per confirmed camper, in rows behind the shade.
  const kindFor = (h: HousingType) =>
    h === 'RV' ? { kind: 'RV' as const, w: 10, h: 30 } : h === 'TRAILER' ? { kind: 'TRAILER' as const, w: 8, h: 20 } : h === 'SHIFTPOD' ? { kind: 'SHIFTPOD' as const, w: 12, h: 12 } : { kind: 'TENT' as const, w: 10, h: 10 };
  let cx = 5;
  let cy = 55;
  for (const s of confirmed) {
    const k = kindFor(s.person.housing);
    if (cx + k.w > 145) {
      cx = 5;
      cy += 32;
    }
    const unit = await prisma.lodgingUnit.create({
      data: { seasonId: season.id, kind: k.kind, label: s.person.playaName ?? s.person.name.split(' ')[0], x: cx, y: cy, w: k.w, h: k.h },
    });
    await prisma.lodgingAssignment.create({ data: { lodgingUnitId: unit.id, seasonMemberId: s.id } });
    cx += k.w + 3;
  }

  console.log(`Done: ${PEOPLE.length} people in the ${year} season.`);
  console.log(`Log in at /login as admin@example.com / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
