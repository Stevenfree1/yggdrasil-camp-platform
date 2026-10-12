-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('LEAD', 'MANAGER', 'STAFF', 'MEMBER');

-- CreateEnum
CREATE TYPE "AdminScope" AS ENUM ('INVENTORY', 'SHIFTS');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "SeasonMemberStatus" AS ENUM ('INTERESTED', 'MAYBE', 'CONFIRMED', 'WAITLISTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HousingType" AS ENUM ('TENT', 'SHIFTPOD', 'RV', 'TRAILER', 'DORM', 'SHARED', 'HEXAYURT', 'OTHER');

-- CreateEnum
CREATE TYPE "GridPower" AS ENUM ('NONE', 'AMP_15', 'AMP_30', 'AMP_50');

-- CreateEnum
CREATE TYPE "TravelMode" AS ENUM ('CAR', 'RV', 'CARPOOL', 'FLYING', 'BURNER_EXPRESS', 'OTHER');

-- CreateEnum
CREATE TYPE "RideStatus" AS ENUM ('HAVE_ROOM', 'NEED_RIDE', 'SORTED');

-- CreateEnum
CREATE TYPE "TravelWindow" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'NIGHT');

-- CreateEnum
CREATE TYPE "PreApprovalForm" AS ENUM ('YES', 'MAYBE', 'NO');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('DUES', 'GRID', 'FOOD', 'DONATION', 'RV_VOUCHER', 'BEER_FUND', 'TENT', 'TICKET', 'STRIKE_DONATION', 'FUNDRAISING', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('VENMO', 'ZELLE', 'CASH', 'ACH', 'CARD', 'PAYPAL', 'OTHER');

-- CreateEnum
CREATE TYPE "DuesStatus" AS ENUM ('UNPAID', 'PAID', 'WAIVED');

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('OPEN', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "ChargeSource" AS ENUM ('SELF', 'ADMIN');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('DGS', 'ART_CAR', 'BOOFER', 'STEWARD', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('INVITED', 'CONTACTED', 'PURCHASED_CONFIRMED', 'VEHICLE_PASS_CONFIRMED', 'REMOVED', 'GOT_OUTSIDE');

-- CreateEnum
CREATE TYPE "TicketSource" AS ENUM ('DGS_DIRECT', 'WAITLIST_FULFILLED', 'OUTSIDE_SALE');

-- CreateEnum
CREATE TYPE "InventoryCategory" AS ENUM ('SHADE', 'TENT', 'AC_UNIT', 'MATTRESS', 'COT', 'KITCHEN', 'BIKE', 'RUG', 'CONTAINER', 'GENERATOR', 'TOOLS', 'ELECTRICAL', 'SOUND', 'DECOR', 'FURNITURE', 'CONSUMABLES', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryRequestCategory" AS ENUM ('AC', 'MATTRESS', 'COT', 'TENT', 'BIKE', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'FULFILLED', 'DENIED');

-- CreateEnum
CREATE TYPE "BudgetCategory" AS ENUM ('GENERATOR', 'FUEL', 'STORAGE', 'TRUCKS', 'SOUND', 'FOOD', 'CONTAINERS', 'BATHROOMS', 'WATER', 'GREY_WATER', 'SHOWERS', 'DECORATION', 'TRASH', 'SUPPLIES', 'ART', 'INFRASTRUCTURE', 'MISC');

-- CreateEnum
CREATE TYPE "ShiftAssignmentStatus" AS ENUM ('ASSIGNED', 'CONFIRMED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ApplicationExperience" AS ENUM ('FIRST_TIMER', 'BEEN_BEFORE', 'VETERAN');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'REVIEWED', 'SUBMITTED', 'UNDER_REVIEW', 'PRE_APPROVED', 'APPROVED', 'INVITED', 'ACCEPTED', 'DUES_PAID', 'CONFIRMED', 'WAITLISTED', 'DECLINED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ApplicationSource" AS ENUM ('NATIVE_FORM', 'GOOGLE_FORM_IMPORT', 'ADMIN_ENTRY', 'HISTORICAL_IMPORT');

-- CreateEnum
CREATE TYPE "AnnouncementPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "LodgingUnitKind" AS ENUM ('TENT', 'RV', 'SHIFTPOD', 'TRAILER', 'DORM', 'STRUCTURE', 'BOUNDARY', 'STREET_LABEL', 'POWER_BOX', 'SHADE_SAIL', 'TEXT_LABEL', 'CONTAINER', 'DINING_TENT', 'BOX_TRUCK', 'MAHAL_TENT', 'CANOPY', 'SHADE_CLOTH', 'BIKE_PARKING', 'WATER_TANK', 'POD', 'HITCH', 'PLUG_15A', 'PLUG_30A', 'PLUG_50A', 'PLUG_L21_30');

-- CreateEnum
CREATE TYPE "MapColorMode" AS ENUM ('HOUSEHOLD', 'GRID_POWER');

-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('WELCOME', 'WELCOME_BACK', 'PROFILE_SETUP', 'APPLICATION_CONFIRMATION', 'APPLICATION_APPROVED', 'APPLICATION_DENIED', 'PRE_APPROVAL_DUES', 'PRE_APPROVAL_EXPIRED', 'PASSWORD_RESET', 'INVITE', 'MEMBERSHIP_REMINDER', 'DUES_INCREASE_REMINDER', 'DONATION_RECEIPT', 'MASS_EMAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'FAILED', 'LOGGED_ONLY');

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "previousEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "playaName" TEXT,
    "phone" TEXT,
    "gender" "Gender",
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "adminScopes" "AdminScope"[] DEFAULT ARRAY[]::"AdminScope"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "hasAvatar" BOOLEAN NOT NULL DEFAULT false,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "dietaryRestrictions" TEXT,
    "allergies" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_avatars" (
    "memberId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_avatars_pkey" PRIMARY KEY ("memberId")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "duesAmount" INTEGER NOT NULL,
    "gridFee30amp" INTEGER NOT NULL,
    "gridFee50amp" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "buildStartDate" TIMESTAMP(3),
    "strikeEndDate" TIMESTAMP(3),
    "capacity" INTEGER,
    "minShiftsPerMember" INTEGER NOT NULL DEFAULT 2,
    "shiftSignupOpen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_members" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "SeasonMemberStatus" NOT NULL DEFAULT 'INTERESTED',
    "housingType" "HousingType",
    "housingSize" TEXT,
    "sharedWithId" TEXT,
    "gridPower" "GridPower" NOT NULL DEFAULT 'NONE',
    "arrivalDate" TIMESTAMP(3),
    "departureDate" TIMESTAMP(3),
    "rideDetails" TEXT,
    "travelMode" "TravelMode",
    "rideStatus" "RideStatus",
    "arrivalWindow" "TravelWindow",
    "departureWindow" "TravelWindow",
    "travelUpdatedAt" TIMESTAMP(3),
    "preApprovalForm" "PreApprovalForm",
    "mapObject" TEXT,
    "specialRequests" TEXT,
    "buildCrew" BOOLEAN NOT NULL DEFAULT false,
    "strikeCrew" BOOLEAN NOT NULL DEFAULT false,
    "isCampVirgin" BOOLEAN NOT NULL DEFAULT false,
    "isBMVirgin" BOOLEAN NOT NULL DEFAULT false,
    "addedToWhatsApp" BOOLEAN NOT NULL DEFAULT false,
    "duesStatus" "DuesStatus" NOT NULL DEFAULT 'UNPAID',
    "duesNote" TEXT,
    "duesUpdatedById" TEXT,
    "duesUpdatedAt" TIMESTAMP(3),
    "duesOverrideCents" INTEGER,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "season_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "seasonMemberId" TEXT NOT NULL,
    "type" "PaymentType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paidTo" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "recordedBy" TEXT,
    "processor" TEXT,
    "processorCheckoutSessionId" TEXT,
    "processorPaymentIntentId" TEXT,
    "processorPaymentMethodType" TEXT,
    "processorCustomerId" TEXT,
    "chargeId" TEXT,
    "feeAmount" INTEGER,
    "netAmount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_items" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amountCents" INTEGER NOT NULL,
    "selfServe" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charge_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charges" (
    "id" TEXT NOT NULL,
    "seasonMemberId" TEXT NOT NULL,
    "itemId" TEXT,
    "label" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "ChargeStatus" NOT NULL DEFAULT 'OPEN',
    "source" "ChargeSource" NOT NULL DEFAULT 'ADMIN',
    "note" TEXT,
    "createdBy" TEXT,
    "voidedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidBy" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" TEXT,
    "receiptUrl" TEXT,
    "needsReimbursement" BOOLEAN NOT NULL DEFAULT false,
    "reimbursed" BOOLEAN NOT NULL DEFAULT false,
    "reimbursedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_lines" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "category" "BudgetCategory" NOT NULL,
    "description" TEXT,
    "estimatedAmount" INTEGER NOT NULL,
    "actualAmount" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "memberId" TEXT,
    "type" "TicketType" NOT NULL DEFAULT 'DGS',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "vehiclePass" BOOLEAN NOT NULL DEFAULT false,
    "purchaseConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'INVITED',
    "source" "TicketSource" NOT NULL DEFAULT 'DGS_DIRECT',
    "contactedAt" TIMESTAMP(3),
    "purchasedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "placeholderName" TEXT,
    "placeholderEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "memberId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "quantityRequested" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    "fulfilledTicketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "early_arrival_passes" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "seasonMemberId" TEXT NOT NULL,
    "arrivalDate" TIMESTAMP(3) NOT NULL,
    "passId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "early_arrival_passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "build_days" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "build_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "build_assignments" (
    "id" TEXT NOT NULL,
    "buildDayId" TEXT NOT NULL,
    "seasonMemberId" TEXT NOT NULL,
    "wapTicketId" TEXT,
    "team" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "build_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strike_assignments" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "seasonMemberId" TEXT NOT NULL,
    "departureDate" TIMESTAMP(3),
    "team" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strike_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "category" "InventoryCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "dimensions" TEXT,
    "condition" TEXT,
    "storageLocation" TEXT,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_requests" (
    "id" TEXT NOT NULL,
    "seasonMemberId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "category" "InventoryRequestCategory" NOT NULL,
    "status" "InventoryRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "maxVolunteers" INTEGER,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_blocks" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_slots" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "requirement" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "shift_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_instances" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "seasonMemberId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "seasonMemberId" TEXT NOT NULL,
    "status" "ShiftAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT,
    "source" "ApplicationSource" NOT NULL DEFAULT 'NATIVE_FORM',
    "externalResponseId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "playaName" TEXT,
    "referredBy" TEXT,
    "sponsorMemberId" TEXT,
    "isBurningManFirstTime" BOOLEAN,
    "isCampReturning" BOOLEAN,
    "hasTicket" BOOLEAN,
    "strikeCommitment" BOOLEAN,
    "experience" "ApplicationExperience" NOT NULL,
    "motivationText" TEXT,
    "groupMembersText" TEXT,
    "interests" TEXT,
    "contribution" TEXT,
    "dietaryRestrictions" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "housingPreference" TEXT,
    "message" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "householdId" TEXT,
    "reviewedBy" TEXT,
    "reviewedByMemberId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "preApprovedAt" TIMESTAMP(3),
    "preApprovalExpiresAt" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "duesPaidAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "households" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "memberId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "memberId" TEXT,
    "type" "EmailType" NOT NULL DEFAULT 'OTHER',
    "subject" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "error" TEXT,
    "transport" TEXT NOT NULL,
    "triggeredByMemberId" TEXT,
    "openedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lodging_units" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "kind" "LodgingUnitKind" NOT NULL,
    "label" TEXT,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "w" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "h" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "color" TEXT,
    "partnerCamp" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "opacity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lodging_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lodging_assignments" (
    "id" TEXT NOT NULL,
    "lodgingUnitId" TEXT NOT NULL,
    "seasonMemberId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lodging_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_map_configs" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "viewportX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "viewportY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "viewportScale" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "gridSizeFt" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "colorMode" "MapColorMode" NOT NULL DEFAULT 'HOUSEHOLD',
    "backgroundUrl" TEXT,
    "backgroundOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.45,
    "backgroundScale" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "backgroundX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "backgroundY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "backgroundRotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "siteWidthFt" DOUBLE PRECISION,
    "siteDepthFt" DOUBLE PRECISION,
    "streetTop" TEXT,
    "streetBottom" TEXT,
    "frontageBearing" DOUBLE PRECISION,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "season_map_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lodging_map_versions" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitCount" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lodging_map_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "members_email_key" ON "members"("email");

-- CreateIndex
CREATE INDEX "members_role_idx" ON "members"("role");

-- CreateIndex
CREATE INDEX "members_isActive_idx" ON "members"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_year_key" ON "seasons"("year");

-- CreateIndex
CREATE INDEX "seasons_isActive_idx" ON "seasons"("isActive");

-- CreateIndex
CREATE INDEX "season_members_seasonId_idx" ON "season_members"("seasonId");

-- CreateIndex
CREATE INDEX "season_members_memberId_idx" ON "season_members"("memberId");

-- CreateIndex
CREATE INDEX "season_members_status_idx" ON "season_members"("status");

-- CreateIndex
CREATE INDEX "season_members_sharedWithId_idx" ON "season_members"("sharedWithId");

-- CreateIndex
CREATE UNIQUE INDEX "season_members_seasonId_memberId_key" ON "season_members"("seasonId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_processorCheckoutSessionId_key" ON "payments"("processorCheckoutSessionId");

-- CreateIndex
CREATE INDEX "payments_seasonMemberId_idx" ON "payments"("seasonMemberId");

-- CreateIndex
CREATE INDEX "payments_type_idx" ON "payments"("type");

-- CreateIndex
CREATE INDEX "payments_processor_idx" ON "payments"("processor");

-- CreateIndex
CREATE INDEX "payments_processorPaymentIntentId_idx" ON "payments"("processorPaymentIntentId");

-- CreateIndex
CREATE INDEX "payments_paidAt_idx" ON "payments"("paidAt");

-- CreateIndex
CREATE INDEX "payments_method_idx" ON "payments"("method");

-- CreateIndex
CREATE INDEX "payments_chargeId_idx" ON "payments"("chargeId");

-- CreateIndex
CREATE INDEX "payments_seasonMemberId_paidAt_idx" ON "payments"("seasonMemberId", "paidAt");

-- CreateIndex
CREATE INDEX "payments_seasonMemberId_type_idx" ON "payments"("seasonMemberId", "type");

-- CreateIndex
CREATE INDEX "charge_items_seasonId_idx" ON "charge_items"("seasonId");

-- CreateIndex
CREATE INDEX "charge_items_seasonId_active_idx" ON "charge_items"("seasonId", "active");

-- CreateIndex
CREATE INDEX "charges_seasonMemberId_idx" ON "charges"("seasonMemberId");

-- CreateIndex
CREATE INDEX "charges_seasonMemberId_status_idx" ON "charges"("seasonMemberId", "status");

-- CreateIndex
CREATE INDEX "charges_itemId_idx" ON "charges"("itemId");

-- CreateIndex
CREATE INDEX "expenses_seasonId_idx" ON "expenses"("seasonId");

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "expenses_paidBy_idx" ON "expenses"("paidBy");

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- CreateIndex
CREATE INDEX "expenses_needsReimbursement_reimbursed_idx" ON "expenses"("needsReimbursement", "reimbursed");

-- CreateIndex
CREATE INDEX "expenses_seasonId_date_idx" ON "expenses"("seasonId", "date");

-- CreateIndex
CREATE INDEX "expenses_seasonId_category_idx" ON "expenses"("seasonId", "category");

-- CreateIndex
CREATE INDEX "budget_lines_seasonId_idx" ON "budget_lines"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "budget_lines_seasonId_category_key" ON "budget_lines"("seasonId", "category");

-- CreateIndex
CREATE INDEX "tickets_seasonId_idx" ON "tickets"("seasonId");

-- CreateIndex
CREATE INDEX "tickets_memberId_idx" ON "tickets"("memberId");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "tickets_seasonId_status_idx" ON "tickets"("seasonId", "status");

-- CreateIndex
CREATE INDEX "tickets_placeholderEmail_idx" ON "tickets"("placeholderEmail");

-- CreateIndex
CREATE INDEX "waitlist_entries_seasonId_idx" ON "waitlist_entries"("seasonId");

-- CreateIndex
CREATE INDEX "waitlist_entries_memberId_idx" ON "waitlist_entries"("memberId");

-- CreateIndex
CREATE INDEX "waitlist_entries_email_idx" ON "waitlist_entries"("email");

-- CreateIndex
CREATE INDEX "waitlist_entries_seasonId_position_idx" ON "waitlist_entries"("seasonId", "position");

-- CreateIndex
CREATE INDEX "waitlist_entries_seasonId_email_idx" ON "waitlist_entries"("seasonId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "early_arrival_passes_seasonMemberId_key" ON "early_arrival_passes"("seasonMemberId");

-- CreateIndex
CREATE INDEX "early_arrival_passes_seasonId_idx" ON "early_arrival_passes"("seasonId");

-- CreateIndex
CREATE INDEX "build_days_seasonId_idx" ON "build_days"("seasonId");

-- CreateIndex
CREATE INDEX "build_days_date_idx" ON "build_days"("date");

-- CreateIndex
CREATE UNIQUE INDEX "build_assignments_buildDayId_seasonMemberId_key" ON "build_assignments"("buildDayId", "seasonMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "strike_assignments_seasonMemberId_key" ON "strike_assignments"("seasonMemberId");

-- CreateIndex
CREATE INDEX "strike_assignments_seasonId_idx" ON "strike_assignments"("seasonId");

-- CreateIndex
CREATE INDEX "inventory_items_category_idx" ON "inventory_items"("category");

-- CreateIndex
CREATE INDEX "inventory_requests_seasonMemberId_idx" ON "inventory_requests"("seasonMemberId");

-- CreateIndex
CREATE INDEX "inventory_requests_status_idx" ON "inventory_requests"("status");

-- CreateIndex
CREATE INDEX "inventory_requests_inventoryItemId_idx" ON "inventory_requests"("inventoryItemId");

-- CreateIndex
CREATE INDEX "shifts_seasonId_idx" ON "shifts"("seasonId");

-- CreateIndex
CREATE INDEX "shifts_date_idx" ON "shifts"("date");

-- CreateIndex
CREATE INDEX "shifts_seasonId_date_idx" ON "shifts"("seasonId", "date");

-- CreateIndex
CREATE INDEX "shift_blocks_seasonId_idx" ON "shift_blocks"("seasonId");

-- CreateIndex
CREATE INDEX "shift_slots_blockId_idx" ON "shift_slots"("blockId");

-- CreateIndex
CREATE INDEX "shift_instances_seasonMemberId_idx" ON "shift_instances"("seasonMemberId");

-- CreateIndex
CREATE INDEX "shift_instances_date_idx" ON "shift_instances"("date");

-- CreateIndex
CREATE UNIQUE INDEX "shift_instances_slotId_date_key" ON "shift_instances"("slotId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "shift_assignments_shiftId_seasonMemberId_key" ON "shift_assignments"("shiftId", "seasonMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "applications_externalResponseId_key" ON "applications"("externalResponseId");

-- CreateIndex
CREATE INDEX "applications_status_idx" ON "applications"("status");

-- CreateIndex
CREATE INDEX "applications_email_idx" ON "applications"("email");

-- CreateIndex
CREATE INDEX "applications_seasonId_status_idx" ON "applications"("seasonId", "status");

-- CreateIndex
CREATE INDEX "applications_sponsorMemberId_idx" ON "applications"("sponsorMemberId");

-- CreateIndex
CREATE INDEX "applications_householdId_idx" ON "applications"("householdId");

-- CreateIndex
CREATE INDEX "applications_reviewedByMemberId_idx" ON "applications"("reviewedByMemberId");

-- CreateIndex
CREATE INDEX "applications_preApprovalExpiresAt_idx" ON "applications"("preApprovalExpiresAt");

-- CreateIndex
CREATE INDEX "households_seasonId_idx" ON "households"("seasonId");

-- CreateIndex
CREATE INDEX "announcements_authorId_idx" ON "announcements"("authorId");

-- CreateIndex
CREATE INDEX "announcements_isPublished_expiresAt_idx" ON "announcements"("isPublished", "expiresAt");

-- CreateIndex
CREATE INDEX "announcements_publishedAt_idx" ON "announcements"("publishedAt");

-- CreateIndex
CREATE INDEX "audit_logs_memberId_idx" ON "audit_logs"("memberId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "email_logs_memberId_idx" ON "email_logs"("memberId");

-- CreateIndex
CREATE INDEX "email_logs_type_idx" ON "email_logs"("type");

-- CreateIndex
CREATE INDEX "email_logs_status_idx" ON "email_logs"("status");

-- CreateIndex
CREATE INDEX "email_logs_createdAt_idx" ON "email_logs"("createdAt");

-- CreateIndex
CREATE INDEX "email_logs_to_idx" ON "email_logs"("to");

-- CreateIndex
CREATE INDEX "lodging_units_seasonId_idx" ON "lodging_units"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "lodging_assignments_seasonMemberId_key" ON "lodging_assignments"("seasonMemberId");

-- CreateIndex
CREATE INDEX "lodging_assignments_lodgingUnitId_idx" ON "lodging_assignments"("lodgingUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "season_map_configs_seasonId_key" ON "season_map_configs"("seasonId");

-- CreateIndex
CREATE INDEX "lodging_map_versions_seasonId_idx" ON "lodging_map_versions"("seasonId");

-- AddForeignKey
ALTER TABLE "member_avatars" ADD CONSTRAINT "member_avatars_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_members" ADD CONSTRAINT "season_members_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_members" ADD CONSTRAINT "season_members_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_members" ADD CONSTRAINT "season_members_sharedWithId_fkey" FOREIGN KEY ("sharedWithId") REFERENCES "season_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_seasonMemberId_fkey" FOREIGN KEY ("seasonMemberId") REFERENCES "season_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "charges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_items" ADD CONSTRAINT "charge_items_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_seasonMemberId_fkey" FOREIGN KEY ("seasonMemberId") REFERENCES "season_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "charge_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_fulfilledTicketId_fkey" FOREIGN KEY ("fulfilledTicketId") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "early_arrival_passes" ADD CONSTRAINT "early_arrival_passes_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "early_arrival_passes" ADD CONSTRAINT "early_arrival_passes_seasonMemberId_fkey" FOREIGN KEY ("seasonMemberId") REFERENCES "season_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_days" ADD CONSTRAINT "build_days_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_assignments" ADD CONSTRAINT "build_assignments_buildDayId_fkey" FOREIGN KEY ("buildDayId") REFERENCES "build_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_assignments" ADD CONSTRAINT "build_assignments_seasonMemberId_fkey" FOREIGN KEY ("seasonMemberId") REFERENCES "season_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strike_assignments" ADD CONSTRAINT "strike_assignments_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strike_assignments" ADD CONSTRAINT "strike_assignments_seasonMemberId_fkey" FOREIGN KEY ("seasonMemberId") REFERENCES "season_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_requests" ADD CONSTRAINT "inventory_requests_seasonMemberId_fkey" FOREIGN KEY ("seasonMemberId") REFERENCES "season_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_requests" ADD CONSTRAINT "inventory_requests_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_blocks" ADD CONSTRAINT "shift_blocks_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_slots" ADD CONSTRAINT "shift_slots_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "shift_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_instances" ADD CONSTRAINT "shift_instances_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "shift_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_instances" ADD CONSTRAINT "shift_instances_seasonMemberId_fkey" FOREIGN KEY ("seasonMemberId") REFERENCES "season_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_seasonMemberId_fkey" FOREIGN KEY ("seasonMemberId") REFERENCES "season_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_sponsorMemberId_fkey" FOREIGN KEY ("sponsorMemberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_reviewedByMemberId_fkey" FOREIGN KEY ("reviewedByMemberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "households" ADD CONSTRAINT "households_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_triggeredByMemberId_fkey" FOREIGN KEY ("triggeredByMemberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lodging_units" ADD CONSTRAINT "lodging_units_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lodging_assignments" ADD CONSTRAINT "lodging_assignments_lodgingUnitId_fkey" FOREIGN KEY ("lodgingUnitId") REFERENCES "lodging_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lodging_assignments" ADD CONSTRAINT "lodging_assignments_seasonMemberId_fkey" FOREIGN KEY ("seasonMemberId") REFERENCES "season_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_map_configs" ADD CONSTRAINT "season_map_configs_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lodging_map_versions" ADD CONSTRAINT "lodging_map_versions_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

