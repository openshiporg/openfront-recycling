-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "password" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passwordResetToken" TEXT,
    "passwordResetIssuedAt" TIMESTAMP(3),
    "passwordResetRedeemedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "canAccessDashboard" BOOLEAN NOT NULL DEFAULT false,
    "canManageTickets" BOOLEAN NOT NULL DEFAULT false,
    "canGradeTickets" BOOLEAN NOT NULL DEFAULT false,
    "canOverridePrices" BOOLEAN NOT NULL DEFAULT false,
    "canVoidTickets" BOOLEAN NOT NULL DEFAULT false,
    "canPaySellers" BOOLEAN NOT NULL DEFAULT false,
    "canManageCashDrawers" BOOLEAN NOT NULL DEFAULT false,
    "canApproveVariances" BOOLEAN NOT NULL DEFAULT false,
    "canManagePricing" BOOLEAN NOT NULL DEFAULT false,
    "canManageMaterials" BOOLEAN NOT NULL DEFAULT false,
    "canManageSellers" BOOLEAN NOT NULL DEFAULT false,
    "canManageAccounts" BOOLEAN NOT NULL DEFAULT false,
    "canManageInventory" BOOLEAN NOT NULL DEFAULT false,
    "canManageSales" BOOLEAN NOT NULL DEFAULT false,
    "canManageDispatch" BOOLEAN NOT NULL DEFAULT false,
    "canDriveJobs" BOOLEAN NOT NULL DEFAULT false,
    "canManageCompliance" BOOLEAN NOT NULL DEFAULT false,
    "canManageFinance" BOOLEAN NOT NULL DEFAULT false,
    "canViewReports" BOOLEAN NOT NULL DEFAULT false,
    "canManageSettings" BOOLEAN NOT NULL DEFAULT false,
    "canManageStaff" BOOLEAN NOT NULL DEFAULT false,
    "canManageOnboarding" BOOLEAN NOT NULL DEFAULT false,
    "canSeeOtherPeople" BOOLEAN NOT NULL DEFAULT false,
    "canEditOtherPeople" BOOLEAN NOT NULL DEFAULT false,
    "canManagePeople" BOOLEAN NOT NULL DEFAULT false,
    "canManageRoles" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Recycling',
    "legalName" TEXT NOT NULL DEFAULT '',
    "logo_id" TEXT,
    "logo_filesize" INTEGER,
    "logo_width" INTEGER,
    "logo_height" INTEGER,
    "logo_extension" TEXT,
    "weightUnit" TEXT NOT NULL DEFAULT 'lb',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "isNonprofit" BOOLEAN NOT NULL DEFAULT false,
    "ein" TEXT NOT NULL DEFAULT '',
    "supportEmail" TEXT NOT NULL DEFAULT '',
    "supportPhone" TEXT NOT NULL DEFAULT '',
    "about" TEXT NOT NULL DEFAULT '',
    "marketVisibility" TEXT NOT NULL DEFAULT 'public_without_prices',
    "storefrontTheme" JSONB,
    "onboardingStatus" TEXT NOT NULL DEFAULT 'not_started',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Yard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT 'MAIN',
    "slug" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "addressLine1" TEXT NOT NULL DEFAULT '',
    "addressLine2" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT 'US',
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "hours" JSONB,
    "acceptsPublic" BOOLEAN NOT NULL DEFAULT true,
    "scaleTypes" JSONB,
    "publicNotes" TEXT NOT NULL DEFAULT '',
    "payoutMethods" JSONB DEFAULT '["cash","check","transfer"]',
    "rulesProfile" TEXT,
    "boardPriceList" TEXT,
    "feeTaxRatePercent" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Yard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YardClosure" (
    "id" TEXT NOT NULL,
    "yard" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "isPartial" BOOLEAN NOT NULL DEFAULT false,
    "openTime" TEXT NOT NULL DEFAULT '',
    "closeTime" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YardClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scale" (
    "id" TEXT NOT NULL,
    "yard" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'truck',
    "apiKeyHash" TEXT,
    "lastReadingWeight" DECIMAL(14,2),
    "lastReadingAt" TIMESTAMP(3),
    "lastReadingStable" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sequence" (
    "id" TEXT NOT NULL,
    "yard" TEXT,
    "scopeKey" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'inbound_ticket',
    "next" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'non_ferrous',
    "sortOrder" INTEGER DEFAULT 0,
    "image_id" TEXT,
    "image_filesize" INTEGER,
    "image_width" INTEGER,
    "image_height" INTEGER,
    "image_extension" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "category" TEXT,
    "specName" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "preparationTips" TEXT NOT NULL DEFAULT '',
    "image_id" TEXT,
    "image_filesize" INTEGER,
    "image_width" INTEGER,
    "image_height" INTEGER,
    "image_extension" TEXT,
    "images" JSONB,
    "defaultUnit" TEXT NOT NULL DEFAULT 'lb',
    "direction" TEXT NOT NULL DEFAULT 'pay_seller',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "acceptsFromPublic" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER DEFAULT 0,
    "minimumWeight" DECIMAL(14,2),
    "standardContainerTare" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'board',
    "yard" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceEntry" (
    "id" TEXT NOT NULL,
    "priceList" TEXT,
    "material" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'lb',
    "unitPrice" DECIMAL(14,5) NOT NULL DEFAULT 0,
    "unitPriceHigh" DECIMAL(14,5),
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "publishedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seller" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "searchName" TEXT NOT NULL DEFAULT '',
    "dateOfBirth" TIMESTAMP(3),
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "addressLine1" TEXT NOT NULL DEFAULT '',
    "addressLine2" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT 'US',
    "status" TEXT NOT NULL DEFAULT 'active',
    "statusReason" TEXT NOT NULL DEFAULT '',
    "idVerification" TEXT NOT NULL DEFAULT 'unverified',
    "preferredPayout" TEXT NOT NULL DEFAULT 'cash',
    "priceList" TEXT,
    "defaultNonprofit" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Seller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityDocument" (
    "id" TEXT NOT NULL,
    "seller" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'drivers_license',
    "number" TEXT NOT NULL DEFAULT '',
    "numberNormalized" TEXT NOT NULL DEFAULT '',
    "issuer" TEXT NOT NULL DEFAULT '',
    "expiresOn" TIMESTAMP(3),
    "frontImage_id" TEXT,
    "frontImage_filesize" INTEGER,
    "frontImage_width" INTEGER,
    "frontImage_height" INTEGER,
    "frontImage_extension" TEXT,
    "backImage_id" TEXT,
    "backImage_filesize" INTEGER,
    "backImage_width" INTEGER,
    "backImage_height" INTEGER,
    "backImage_extension" TEXT,
    "thumbprintImage_id" TEXT,
    "thumbprintImage_filesize" INTEGER,
    "thumbprintImage_width" INTEGER,
    "thumbprintImage_height" INTEGER,
    "thumbprintImage_extension" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "seller" TEXT,
    "account" TEXT,
    "plate" TEXT NOT NULL DEFAULT '',
    "plateRegion" TEXT NOT NULL DEFAULT '',
    "make" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'pickup',
    "storedTare" DECIMAL(14,2),
    "storedTareExpiresOn" TIMESTAMP(3),
    "isRemoved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "legalName" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "accountNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "statusReason" TEXT NOT NULL DEFAULT '',
    "isSupplier" BOOLEAN NOT NULL DEFAULT false,
    "isBuyer" BOOLEAN NOT NULL DEFAULT false,
    "isNonprofit" BOOLEAN NOT NULL DEFAULT false,
    "taxId" TEXT NOT NULL DEFAULT '',
    "ein" TEXT NOT NULL DEFAULT '',
    "billingAddressLine1" TEXT NOT NULL DEFAULT '',
    "billingAddressLine2" TEXT NOT NULL DEFAULT '',
    "billingCity" TEXT NOT NULL DEFAULT '',
    "billingRegion" TEXT NOT NULL DEFAULT '',
    "billingPostalCode" TEXT NOT NULL DEFAULT '',
    "billingCountry" TEXT NOT NULL DEFAULT 'US',
    "billingEmail" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "paymentTerms" TEXT NOT NULL DEFAULT 'pay_at_scale',
    "netDays" INTEGER DEFAULT 0,
    "settlementCycle" TEXT NOT NULL DEFAULT 'monthly',
    "weightBasis" TEXT NOT NULL DEFAULT 'shipped',
    "hasCredit" BOOLEAN NOT NULL DEFAULT false,
    "priceList" TEXT,
    "nonprofitSummary" TEXT NOT NULL DEFAULT '',
    "nonprofitWebsite" TEXT NOT NULL DEFAULT '',
    "nonprofitLogo_id" TEXT,
    "nonprofitLogo_filesize" INTEGER,
    "nonprofitLogo_width" INTEGER,
    "nonprofitLogo_height" INTEGER,
    "nonprofitLogo_extension" TEXT,
    "isPublicNonprofit" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountContact" (
    "id" TEXT NOT NULL,
    "account" TEXT,
    "user" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'active',
    "inviteEmail" TEXT NOT NULL DEFAULT '',
    "inviteTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountApplication" (
    "id" TEXT NOT NULL,
    "applicant" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'supplier',
    "businessName" TEXT NOT NULL DEFAULT '',
    "legalName" TEXT NOT NULL DEFAULT '',
    "taxId" TEXT NOT NULL DEFAULT '',
    "addressLine1" TEXT NOT NULL DEFAULT '',
    "addressLine2" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT 'US',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "materials" JSONB,
    "monthlyVolume" TEXT NOT NULL DEFAULT '',
    "containerNeeds" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "w9_filesize" INTEGER,
    "w9_filename" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "decisionReason" TEXT NOT NULL DEFAULT '',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "account" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountDocument" (
    "id" TEXT NOT NULL,
    "account" TEXT,
    "ticket" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "file_filesize" INTEGER,
    "file_filename" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "visibleToAccount" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceSite" (
    "id" TEXT NOT NULL,
    "account" TEXT,
    "seller" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "addressLine1" TEXT NOT NULL DEFAULT '',
    "addressLine2" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT 'US',
    "contactName" TEXT NOT NULL DEFAULT '',
    "contactPhone" TEXT NOT NULL DEFAULT '',
    "accessNotes" TEXT NOT NULL DEFAULT '',
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "seller" TEXT,
    "yard" TEXT,
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "vehicle" TEXT,
    "expectedItems" JSONB,
    "donatePercent" INTEGER DEFAULT 0,
    "nonprofit" TEXT,
    "campaign" TEXT,
    "code" TEXT,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaleTicket" (
    "id" TEXT NOT NULL,
    "yard" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'inbound',
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "seller" TEXT,
    "account" TEXT,
    "site" TEXT,
    "vehicle" TEXT,
    "vehiclePlate" TEXT NOT NULL DEFAULT '',
    "vehiclePlateRegion" TEXT NOT NULL DEFAULT '',
    "vehicleDescription" TEXT NOT NULL DEFAULT '',
    "visit" TEXT,
    "job" TEXT,
    "container" TEXT,
    "shipment" TEXT,
    "adjusts" TEXT,
    "isAdjustment" BOOLEAN NOT NULL DEFAULT false,
    "paymentMode" TEXT NOT NULL DEFAULT 'pay_now',
    "fees" JSONB DEFAULT '[]',
    "materialTotalCents" INTEGER NOT NULL DEFAULT 0,
    "feeTotalCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "collectedCents" INTEGER NOT NULL DEFAULT 0,
    "donatePercent" INTEGER DEFAULT 0,
    "nonprofit" TEXT,
    "campaign" TEXT,
    "complianceSnapshot" JSONB,
    "overrideReason" TEXT NOT NULL DEFAULT '',
    "overrideBy" TEXT,
    "lookupCode" TEXT,
    "certificateRequested" BOOLEAN NOT NULL DEFAULT false,
    "openedBy" TEXT,
    "completedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT NOT NULL DEFAULT '',
    "settlement" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScaleTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketLine" (
    "id" TEXT NOT NULL,
    "ticket" TEXT,
    "sortOrder" INTEGER DEFAULT 0,
    "material" TEXT,
    "materialName" TEXT NOT NULL DEFAULT '',
    "direction" TEXT NOT NULL DEFAULT 'pay_seller',
    "grossWeight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tareWeight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netWeight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deductionWeight" DECIMAL(14,2),
    "deductionPercent" DECIMAL(14,2),
    "deductionReason" TEXT,
    "payWeight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "quantity" INTEGER,
    "unit" TEXT NOT NULL DEFAULT 'lb',
    "unitPrice" DECIMAL(14,5),
    "priceSource" TEXT,
    "priceEntry" TEXT,
    "overrideBy" TEXT,
    "overrideReason" TEXT NOT NULL DEFAULT '',
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "restriction" TEXT,
    "documents" JSONB DEFAULT '[]',
    "payout" TEXT,
    "inventoryUnit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeighEvent" (
    "id" TEXT NOT NULL,
    "ticket" TEXT,
    "line" TEXT,
    "scale" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'gross',
    "weight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "captureMethod" TEXT NOT NULL DEFAULT 'manual',
    "capturedBy" TEXT,
    "capturedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "photo_id" TEXT,
    "photo_filesize" INTEGER,
    "photo_width" INTEGER,
    "photo_height" INTEGER,
    "photo_extension" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeighEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAttachment" (
    "id" TEXT NOT NULL,
    "ticket" TEXT,
    "line" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'material_photo',
    "image_id" TEXT,
    "image_filesize" INTEGER,
    "image_width" INTEGER,
    "image_height" INTEGER,
    "image_extension" TEXT,
    "file_filesize" INTEGER,
    "file_filename" TEXT,
    "signedName" TEXT NOT NULL DEFAULT '',
    "capturedBy" TEXT,
    "capturedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "ticket" TEXT,
    "settlement" TEXT,
    "seller" TEXT,
    "account" TEXT,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "allowedMethods" JSONB DEFAULT '["cash","check","transfer"]',
    "method" TEXT,
    "releaseAt" TIMESTAMP(3),
    "checkNumber" TEXT,
    "bankAccountLabel" TEXT,
    "transferReference" TEXT NOT NULL DEFAULT '',
    "mailToAddress" TEXT NOT NULL DEFAULT '',
    "paidBy" TEXT,
    "paidAt" TIMESTAMP(3),
    "drawerSession" TEXT,
    "replaces" TEXT,
    "returnReason" TEXT NOT NULL DEFAULT '',
    "cancelReason" TEXT NOT NULL DEFAULT '',
    "idempotencyKeyHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashDrawer" (
    "id" TEXT NOT NULL,
    "yard" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashDrawer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashDrawerSession" (
    "id" TEXT NOT NULL,
    "drawer" TEXT,
    "cashier" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "openingFloatCents" INTEGER NOT NULL DEFAULT 0,
    "expectedCents" INTEGER NOT NULL DEFAULT 0,
    "countedCents" INTEGER,
    "varianceCents" INTEGER,
    "openedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvalNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashDrawerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashDrawerEvent" (
    "id" TEXT NOT NULL,
    "session" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'add',
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "payout" TEXT,
    "ticket" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "referenceKey" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashDrawerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountCharge" (
    "id" TEXT NOT NULL,
    "account" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "description" TEXT NOT NULL DEFAULT '',
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "job" TEXT,
    "container" TEXT,
    "serviceDate" TIMESTAMP(3),
    "referenceKey" TEXT,
    "settlement" TEXT,
    "invoiceLine" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "account" TEXT,
    "number" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "ticketTotalCents" INTEGER NOT NULL DEFAULT 0,
    "chargeTotalCents" INTEGER NOT NULL DEFAULT 0,
    "donationTotalCents" INTEGER NOT NULL DEFAULT 0,
    "netCents" INTEGER NOT NULL DEFAULT 0,
    "payout" TEXT,
    "invoice" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "voidReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryBalance" (
    "id" TEXT NOT NULL,
    "yard" TEXT,
    "material" TEXT,
    "onHandWeight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reservedWeight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "heldWeight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalCostCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "yard" TEXT,
    "material" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'receive',
    "weightDelta" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "costDeltaCents" INTEGER NOT NULL DEFAULT 0,
    "weightAfter" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ticket" TEXT,
    "ticketLine" TEXT,
    "processingRun" TEXT,
    "transfer" TEXT,
    "unit" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "referenceKey" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryUnit" (
    "id" TEXT NOT NULL,
    "yard" TEXT,
    "tagNumber" TEXT NOT NULL DEFAULT '',
    "material" TEXT,
    "form" TEXT NOT NULL DEFAULT 'bale',
    "weight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "location" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'available',
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "shipment" TEXT,
    "listing" TEXT,
    "transfer" TEXT,
    "photo_id" TEXT,
    "photo_filesize" INTEGER,
    "photo_width" INTEGER,
    "photo_height" INTEGER,
    "photo_extension" TEXT,
    "createdFromRun" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingRun" (
    "id" TEXT NOT NULL,
    "yard" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "inputs" JSONB DEFAULT '[]',
    "outputs" JSONB DEFAULT '[]',
    "lossWeight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "processingCostCents" INTEGER NOT NULL DEFAULT 0,
    "operator" TEXT,
    "postedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YardTransfer" (
    "id" TEXT NOT NULL,
    "fromYard" TEXT,
    "toYard" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "lines" JSONB DEFAULT '[]',
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "sentBy" TEXT,
    "receivedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YardTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "yard" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "material" TEXT,
    "form" TEXT NOT NULL DEFAULT 'loose',
    "description" TEXT NOT NULL DEFAULT '',
    "photos" JSONB DEFAULT '[]',
    "estimatedWeight" DECIMAL(14,2),
    "availableWeight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "askUnitPrice" DECIMAL(14,5),
    "unit" TEXT NOT NULL DEFAULT 'lb',
    "allowOffers" BOOLEAN NOT NULL DEFAULT true,
    "buyNow" BOOLEAN NOT NULL DEFAULT false,
    "minimumWeight" DECIMAL(14,2),
    "terms" TEXT NOT NULL DEFAULT 'fob_yard',
    "closesAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "listing" TEXT,
    "account" TEXT,
    "contact" TEXT,
    "weight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(14,5),
    "unit" TEXT NOT NULL DEFAULT 'lb',
    "pickupFrom" TIMESTAMP(3),
    "pickupTo" TIMESTAMP(3),
    "message" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "counterUnitPrice" DECIMAL(14,5),
    "counterWeight" DECIMAL(14,2),
    "counterMessage" TEXT NOT NULL DEFAULT '',
    "decisionReason" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "salesOrder" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "number" INTEGER,
    "yard" TEXT,
    "account" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "terms" TEXT NOT NULL DEFAULT 'fob_yard',
    "paymentTerms" TEXT NOT NULL DEFAULT 'net',
    "netDays" INTEGER DEFAULT 30,
    "weightBasis" TEXT NOT NULL DEFAULT 'shipped',
    "shipFrom" TEXT NOT NULL DEFAULT '',
    "shipTo" TEXT NOT NULL DEFAULT '',
    "shipWindowStart" TIMESTAMP(3),
    "shipWindowEnd" TIMESTAMP(3),
    "buyerReference" TEXT NOT NULL DEFAULT '',
    "cancelReason" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderLine" (
    "id" TEXT NOT NULL,
    "order" TEXT,
    "material" TEXT,
    "materialName" TEXT NOT NULL DEFAULT '',
    "weight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tolerancePercent" DECIMAL(14,2) DEFAULT 5,
    "unit" TEXT NOT NULL DEFAULT 'lb',
    "unitPrice" DECIMAL(14,5),
    "shippedWeight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reservedWeight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "listing" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "order" TEXT,
    "number" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "carrier" TEXT NOT NULL DEFAULT '',
    "driverName" TEXT NOT NULL DEFAULT '',
    "truckPlate" TEXT NOT NULL DEFAULT '',
    "trailerNumber" TEXT NOT NULL DEFAULT '',
    "sealNumber" TEXT NOT NULL DEFAULT '',
    "bolNumber" TEXT NOT NULL DEFAULT '',
    "scheduledFor" TIMESTAMP(3),
    "lines" JSONB DEFAULT '[]',
    "shippedWeight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "receivedWeight" DECIMAL(14,2),
    "receivedGradeNote" TEXT NOT NULL DEFAULT '',
    "freightCents" INTEGER NOT NULL DEFAULT 0,
    "invoice" TEXT,
    "job" TEXT,
    "releasedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" INTEGER,
    "account" TEXT,
    "seller" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'sale',
    "status" TEXT NOT NULL DEFAULT 'open',
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "paidCents" INTEGER NOT NULL DEFAULT 0,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "dueOn" TIMESTAMP(3),
    "shipment" TEXT,
    "settlement" TEXT,
    "serviceRequest" TEXT,
    "ticket" TEXT,
    "voidReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoice" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "material" TEXT,
    "weight" DECIMAL(14,2),
    "unit" TEXT,
    "unitPrice" DECIMAL(14,5),
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL DEFAULT 'material',
    "claim" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "shipment" TEXT,
    "account" TEXT,
    "openedBy" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "description" TEXT NOT NULL DEFAULT '',
    "photos" JSONB DEFAULT '[]',
    "claimedCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "creditCents" INTEGER NOT NULL DEFAULT 0,
    "decisionReason" TEXT NOT NULL DEFAULT '',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "isInstalled" BOOLEAN NOT NULL DEFAULT true,
    "credentials" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSession" (
    "id" TEXT NOT NULL,
    "provider" TEXT,
    "invoice" TEXT,
    "serviceRequest" TEXT,
    "ticket" TEXT,
    "payer" TEXT,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerPaymentId" TEXT,
    "clientSecret" TEXT NOT NULL DEFAULT '',
    "idempotencyKeyHash" TEXT,
    "capturedAt" TIMESTAMP(3),
    "capturedCents" INTEGER NOT NULL DEFAULT 0,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "invoice" TEXT,
    "session" TEXT,
    "method" TEXT NOT NULL DEFAULT 'card',
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "reference" TEXT NOT NULL DEFAULT '',
    "referenceKey" TEXT,
    "receivedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'succeeded',
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "payment" TEXT,
    "session" TEXT,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerRefundId" TEXT,
    "failureMessage" TEXT NOT NULL DEFAULT '',
    "claim" TEXT,
    "serviceRequest" TEXT,
    "createdBy" TEXT,
    "idempotencyKeyHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT '',
    "providerEventId" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT '',
    "payloadHash" TEXT NOT NULL DEFAULT '',
    "processedAt" TIMESTAMP(3),
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContainerType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'roll_off',
    "capacityLabel" TEXT NOT NULL DEFAULT '',
    "dimensions" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "image_id" TEXT,
    "image_filesize" INTEGER,
    "image_width" INTEGER,
    "image_height" INTEGER,
    "image_extension" TEXT,
    "suitableFor" TEXT NOT NULL DEFAULT '',
    "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
    "haulFeeCents" INTEGER NOT NULL DEFAULT 0,
    "rentalFeePerDayCents" INTEGER NOT NULL DEFAULT 0,
    "freeRentalDays" INTEGER NOT NULL DEFAULT 0,
    "dryRunFeeCents" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContainerType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Container" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL DEFAULT '',
    "type" TEXT,
    "homeYard" TEXT,
    "status" TEXT NOT NULL DEFAULT 'in_yard',
    "tareWeight" DECIMAL(14,2),
    "site" TEXT,
    "account" TEXT,
    "placedOn" TIMESTAMP(3),
    "rentalChargedThrough" TIMESTAMP(3),
    "currentMaterial" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Container_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "number" INTEGER,
    "yard" TEXT,
    "account" TEXT,
    "seller" TEXT,
    "requestedBy" TEXT,
    "site" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'deliver',
    "containerType" TEXT,
    "container" TEXT,
    "material" TEXT,
    "itemsDescription" TEXT NOT NULL DEFAULT '',
    "photos" JSONB DEFAULT '[]',
    "preferredDate" TIMESTAMP(3),
    "preferredWindow" TEXT NOT NULL DEFAULT 'any',
    "accessNotes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'requested',
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "quoteNote" TEXT NOT NULL DEFAULT '',
    "quoteAcceptedAt" TIMESTAMP(3),
    "chargeToAccount" BOOLEAN NOT NULL DEFAULT false,
    "invoice" TEXT,
    "decisionReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Truck" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "plate" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'roll_off',
    "yard" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Truck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchJob" (
    "id" TEXT NOT NULL,
    "number" INTEGER,
    "yard" TEXT,
    "request" TEXT,
    "shipment" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'deliver',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "scheduledDate" TIMESTAMP(3),
    "sequence" INTEGER DEFAULT 0,
    "driver" TEXT,
    "truck" TEXT,
    "dropContainer" TEXT,
    "pickContainer" TEXT,
    "site" TEXT,
    "startedAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "photos" JSONB DEFAULT '[]',
    "signedName" TEXT NOT NULL DEFAULT '',
    "failureReason" TEXT NOT NULL DEFAULT '',
    "driverNotes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DispatchJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationCampaign" (
    "id" TEXT NOT NULL,
    "account" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "image_id" TEXT,
    "image_filesize" INTEGER,
    "image_width" INTEGER,
    "image_height" INTEGER,
    "image_extension" TEXT,
    "goalWeight" DECIMAL(14,2),
    "goalCents" INTEGER,
    "startsOn" TIMESTAMP(3),
    "endsOn" TIMESTAMP(3),
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonationCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "ticket" TEXT,
    "seller" TEXT,
    "account" TEXT,
    "campaign" TEXT,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "weight" DECIMAL(14,2),
    "itemsSummary" JSONB DEFAULT '[]',
    "kind" TEXT NOT NULL DEFAULT 'payout_donation',
    "status" TEXT NOT NULL DEFAULT 'pledged',
    "receiptNumber" TEXT,
    "receiptIssuedAt" TIMESTAMP(3),
    "goodsOrServicesProvided" BOOLEAN NOT NULL DEFAULT false,
    "showDonorName" BOOLEAN NOT NULL DEFAULT false,
    "settlement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RulesProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "template" TEXT NOT NULL DEFAULT 'general',
    "requireGovernmentId" BOOLEAN NOT NULL DEFAULT true,
    "requireIdPhoto" BOOLEAN NOT NULL DEFAULT true,
    "requireSellerPhoto" BOOLEAN NOT NULL DEFAULT false,
    "requireMaterialPhoto" BOOLEAN NOT NULL DEFAULT true,
    "requireVehiclePlate" BOOLEAN NOT NULL DEFAULT true,
    "requireSignature" BOOLEAN NOT NULL DEFAULT true,
    "requireThumbprint" BOOLEAN NOT NULL DEFAULT false,
    "minimumSellerAge" INTEGER NOT NULL DEFAULT 18,
    "cashLimitPerTicketCents" INTEGER,
    "cashLimitPerDayCents" INTEGER,
    "cashRounding" TEXT NOT NULL DEFAULT 'none',
    "defaultPaymentHoldDays" INTEGER NOT NULL DEFAULT 0,
    "defaultMaterialHoldDays" INTEGER NOT NULL DEFAULT 0,
    "allowEarlyRelease" BOOLEAN NOT NULL DEFAULT false,
    "retentionDays" INTEGER NOT NULL DEFAULT 730,
    "dailyReport" BOOLEAN NOT NULL DEFAULT false,
    "reportDueTime" TEXT NOT NULL DEFAULT '',
    "reportOmitsPrice" BOOLEAN NOT NULL DEFAULT false,
    "ownershipStatement" TEXT NOT NULL DEFAULT 'I am the lawful owner of the material sold on this ticket, or I am authorised by the owner to sell it.',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RulesProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRestriction" (
    "id" TEXT NOT NULL,
    "profile" TEXT,
    "material" TEXT,
    "category" TEXT,
    "label" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'payment_rule',
    "requiredDocuments" JSONB DEFAULT '[]',
    "forbidCash" BOOLEAN NOT NULL DEFAULT false,
    "allowedMethods" JSONB,
    "paymentHoldDays" INTEGER DEFAULT 0,
    "materialHoldDays" INTEGER DEFAULT 0,
    "mailCheckOnly" BOOLEAN NOT NULL DEFAULT false,
    "publicNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoldTag" (
    "id" TEXT NOT NULL,
    "ticket" TEXT,
    "line" TEXT,
    "yard" TEXT,
    "material" TEXT,
    "weight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL DEFAULT 'material',
    "status" TEXT NOT NULL DEFAULT 'held',
    "releaseAt" TIMESTAMP(3),
    "releasedBy" TEXT,
    "releasedAt" TIMESTAMP(3),
    "releaseReason" TEXT NOT NULL DEFAULT '',
    "caseNumber" TEXT NOT NULL DEFAULT '',
    "agency" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HoldTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoNotBuyEntry" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "nameNormalized" TEXT NOT NULL DEFAULT '',
    "dateOfBirth" TIMESTAMP(3),
    "idNumber" TEXT NOT NULL DEFAULT '',
    "idNumberNormalized" TEXT NOT NULL DEFAULT '',
    "plate" TEXT NOT NULL DEFAULT '',
    "plateNormalized" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'yard',
    "reason" TEXT NOT NULL DEFAULT '',
    "expiresOn" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "seller" TEXT,
    "addedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoNotBuyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TheftAlert" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "keywords" TEXT NOT NULL DEFAULT '',
    "reportedOn" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "agency" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "sourceUrl" TEXT NOT NULL DEFAULT '',
    "expiresOn" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TheftAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceReport" (
    "id" TEXT NOT NULL,
    "yard" TEXT,
    "reportDate" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'generated',
    "ticketCount" INTEGER DEFAULT 0,
    "file_filesize" INTEGER,
    "file_filename" TEXT,
    "csv" TEXT NOT NULL DEFAULT '',
    "fileHash" TEXT NOT NULL DEFAULT '',
    "generatedBy" TEXT,
    "submittedBy" TEXT,
    "submittedAt" TIMESTAMP(3),
    "submissionNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "eventType" TEXT NOT NULL DEFAULT '',
    "aggregateType" TEXT NOT NULL DEFAULT '',
    "aggregateId" TEXT NOT NULL DEFAULT '',
    "yard" TEXT,
    "actor" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandReceipt" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "eventType" TEXT NOT NULL DEFAULT '',
    "aggregateType" TEXT NOT NULL DEFAULT '',
    "aggregateId" TEXT NOT NULL DEFAULT '',
    "payloadHash" TEXT NOT NULL DEFAULT '',
    "result" JSONB,
    "actorId" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommandReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthApp" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "clientId" TEXT NOT NULL DEFAULT '',
    "clientSecret" TEXT NOT NULL DEFAULT '',
    "tokenEndpointAuthMethod" TEXT DEFAULT 'client_secret_post',
    "redirectUris" JSONB DEFAULT '[]',
    "scopes" JSONB DEFAULT '["mcp:read","mcp:write"]',
    "webhookUrl" TEXT NOT NULL DEFAULT '',
    "status" TEXT DEFAULT 'active',
    "installUrl" TEXT NOT NULL DEFAULT '',
    "uninstallUrl" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB DEFAULT '{}',
    "developerEmail" TEXT NOT NULL DEFAULT '',
    "privacyPolicyUrl" TEXT NOT NULL DEFAULT '',
    "termsOfServiceUrl" TEXT NOT NULL DEFAULT '',
    "supportUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthToken" (
    "id" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL,
    "token" TEXT NOT NULL DEFAULT '',
    "clientId" TEXT NOT NULL DEFAULT '',
    "user" TEXT,
    "scopes" JSONB DEFAULT '[]',
    "redirectUri" TEXT NOT NULL DEFAULT '',
    "resource" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3),
    "isRevoked" TEXT DEFAULT 'false',
    "authorizationCode" TEXT NOT NULL DEFAULT '',
    "refreshToken" TEXT NOT NULL DEFAULT '',
    "accessToken" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "codeChallenge" TEXT NOT NULL DEFAULT '',
    "codeChallengeMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_User_yards" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_User_yards_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TheftAlert_materials" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TheftAlert_materials_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Yard_code_key" ON "Yard"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Yard_slug_key" ON "Yard"("slug");

-- CreateIndex
CREATE INDEX "Yard_rulesProfile_idx" ON "Yard"("rulesProfile");

-- CreateIndex
CREATE INDEX "Yard_boardPriceList_idx" ON "Yard"("boardPriceList");

-- CreateIndex
CREATE INDEX "YardClosure_yard_idx" ON "YardClosure"("yard");

-- CreateIndex
CREATE UNIQUE INDEX "Scale_apiKeyHash_key" ON "Scale"("apiKeyHash");

-- CreateIndex
CREATE INDEX "Scale_yard_idx" ON "Scale"("yard");

-- CreateIndex
CREATE INDEX "Sequence_yard_idx" ON "Sequence"("yard");

-- CreateIndex
CREATE UNIQUE INDEX "Sequence_scope_kind_key" ON "Sequence"("scopeKey", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialCategory_slug_key" ON "MaterialCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Material_slug_key" ON "Material"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Material_code_key" ON "Material"("code");

-- CreateIndex
CREATE INDEX "Material_category_idx" ON "Material"("category");

-- CreateIndex
CREATE INDEX "PriceList_yard_idx" ON "PriceList"("yard");

-- CreateIndex
CREATE INDEX "PriceEntry_priceList_idx" ON "PriceEntry"("priceList");

-- CreateIndex
CREATE INDEX "PriceEntry_material_idx" ON "PriceEntry"("material");

-- CreateIndex
CREATE INDEX "PriceEntry_publishedBy_idx" ON "PriceEntry"("publishedBy");

-- CreateIndex
CREATE INDEX "PriceEntry_list_material_effective_idx" ON "PriceEntry"("priceList", "material", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "Seller_user_key" ON "Seller"("user");

-- CreateIndex
CREATE INDEX "Seller_searchName_idx" ON "Seller"("searchName");

-- CreateIndex
CREATE INDEX "Seller_phone_idx" ON "Seller"("phone");

-- CreateIndex
CREATE INDEX "Seller_status_idx" ON "Seller"("status");

-- CreateIndex
CREATE INDEX "Seller_idVerification_idx" ON "Seller"("idVerification");

-- CreateIndex
CREATE INDEX "Seller_priceList_idx" ON "Seller"("priceList");

-- CreateIndex
CREATE INDEX "Seller_defaultNonprofit_idx" ON "Seller"("defaultNonprofit");

-- CreateIndex
CREATE INDEX "IdentityDocument_seller_idx" ON "IdentityDocument"("seller");

-- CreateIndex
CREATE INDEX "IdentityDocument_numberNormalized_idx" ON "IdentityDocument"("numberNormalized");

-- CreateIndex
CREATE INDEX "IdentityDocument_verifiedBy_idx" ON "IdentityDocument"("verifiedBy");

-- CreateIndex
CREATE INDEX "Vehicle_seller_idx" ON "Vehicle"("seller");

-- CreateIndex
CREATE INDEX "Vehicle_account_idx" ON "Vehicle"("account");

-- CreateIndex
CREATE INDEX "Vehicle_plate_idx" ON "Vehicle"("plate");

-- CreateIndex
CREATE UNIQUE INDEX "Account_slug_key" ON "Account"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Account_accountNumber_key" ON "Account"("accountNumber");

-- CreateIndex
CREATE INDEX "Account_status_idx" ON "Account"("status");

-- CreateIndex
CREATE INDEX "Account_priceList_idx" ON "Account"("priceList");

-- CreateIndex
CREATE UNIQUE INDEX "AccountContact_inviteTokenHash_key" ON "AccountContact"("inviteTokenHash");

-- CreateIndex
CREATE INDEX "AccountContact_account_idx" ON "AccountContact"("account");

-- CreateIndex
CREATE INDEX "AccountContact_user_idx" ON "AccountContact"("user");

-- CreateIndex
CREATE INDEX "AccountContact_status_idx" ON "AccountContact"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AccountContact_account_user_key" ON "AccountContact"("account", "user");

-- CreateIndex
CREATE INDEX "AccountApplication_applicant_idx" ON "AccountApplication"("applicant");

-- CreateIndex
CREATE INDEX "AccountApplication_status_idx" ON "AccountApplication"("status");

-- CreateIndex
CREATE INDEX "AccountApplication_decidedBy_idx" ON "AccountApplication"("decidedBy");

-- CreateIndex
CREATE INDEX "AccountApplication_account_idx" ON "AccountApplication"("account");

-- CreateIndex
CREATE INDEX "AccountDocument_account_idx" ON "AccountDocument"("account");

-- CreateIndex
CREATE INDEX "AccountDocument_ticket_idx" ON "AccountDocument"("ticket");

-- CreateIndex
CREATE INDEX "ServiceSite_account_idx" ON "ServiceSite"("account");

-- CreateIndex
CREATE INDEX "ServiceSite_seller_idx" ON "ServiceSite"("seller");

-- CreateIndex
CREATE UNIQUE INDEX "Visit_code_key" ON "Visit"("code");

-- CreateIndex
CREATE INDEX "Visit_seller_idx" ON "Visit"("seller");

-- CreateIndex
CREATE INDEX "Visit_yard_idx" ON "Visit"("yard");

-- CreateIndex
CREATE INDEX "Visit_vehicle_idx" ON "Visit"("vehicle");

-- CreateIndex
CREATE INDEX "Visit_nonprofit_idx" ON "Visit"("nonprofit");

-- CreateIndex
CREATE INDEX "Visit_campaign_idx" ON "Visit"("campaign");

-- CreateIndex
CREATE INDEX "Visit_status_idx" ON "Visit"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ScaleTicket_visit_key" ON "ScaleTicket"("visit");

-- CreateIndex
CREATE UNIQUE INDEX "ScaleTicket_shipment_key" ON "ScaleTicket"("shipment");

-- CreateIndex
CREATE UNIQUE INDEX "ScaleTicket_lookupCode_key" ON "ScaleTicket"("lookupCode");

-- CreateIndex
CREATE INDEX "ScaleTicket_yard_idx" ON "ScaleTicket"("yard");

-- CreateIndex
CREATE INDEX "ScaleTicket_status_idx" ON "ScaleTicket"("status");

-- CreateIndex
CREATE INDEX "ScaleTicket_seller_idx" ON "ScaleTicket"("seller");

-- CreateIndex
CREATE INDEX "ScaleTicket_account_idx" ON "ScaleTicket"("account");

-- CreateIndex
CREATE INDEX "ScaleTicket_site_idx" ON "ScaleTicket"("site");

-- CreateIndex
CREATE INDEX "ScaleTicket_vehicle_idx" ON "ScaleTicket"("vehicle");

-- CreateIndex
CREATE INDEX "ScaleTicket_vehiclePlate_idx" ON "ScaleTicket"("vehiclePlate");

-- CreateIndex
CREATE INDEX "ScaleTicket_job_idx" ON "ScaleTicket"("job");

-- CreateIndex
CREATE INDEX "ScaleTicket_container_idx" ON "ScaleTicket"("container");

-- CreateIndex
CREATE INDEX "ScaleTicket_adjusts_idx" ON "ScaleTicket"("adjusts");

-- CreateIndex
CREATE INDEX "ScaleTicket_nonprofit_idx" ON "ScaleTicket"("nonprofit");

-- CreateIndex
CREATE INDEX "ScaleTicket_campaign_idx" ON "ScaleTicket"("campaign");

-- CreateIndex
CREATE INDEX "ScaleTicket_overrideBy_idx" ON "ScaleTicket"("overrideBy");

-- CreateIndex
CREATE INDEX "ScaleTicket_openedBy_idx" ON "ScaleTicket"("openedBy");

-- CreateIndex
CREATE INDEX "ScaleTicket_completedBy_idx" ON "ScaleTicket"("completedBy");

-- CreateIndex
CREATE INDEX "ScaleTicket_voidedBy_idx" ON "ScaleTicket"("voidedBy");

-- CreateIndex
CREATE INDEX "ScaleTicket_settlement_idx" ON "ScaleTicket"("settlement");

-- CreateIndex
CREATE INDEX "ScaleTicket_status_yard_idx" ON "ScaleTicket"("status", "yard");

-- CreateIndex
CREATE UNIQUE INDEX "ScaleTicket_yard_direction_number_key" ON "ScaleTicket"("yard", "direction", "number");

-- CreateIndex
CREATE INDEX "TicketLine_ticket_idx" ON "TicketLine"("ticket");

-- CreateIndex
CREATE INDEX "TicketLine_material_idx" ON "TicketLine"("material");

-- CreateIndex
CREATE INDEX "TicketLine_priceEntry_idx" ON "TicketLine"("priceEntry");

-- CreateIndex
CREATE INDEX "TicketLine_overrideBy_idx" ON "TicketLine"("overrideBy");

-- CreateIndex
CREATE INDEX "TicketLine_restriction_idx" ON "TicketLine"("restriction");

-- CreateIndex
CREATE INDEX "TicketLine_payout_idx" ON "TicketLine"("payout");

-- CreateIndex
CREATE INDEX "TicketLine_inventoryUnit_idx" ON "TicketLine"("inventoryUnit");

-- CreateIndex
CREATE INDEX "WeighEvent_ticket_idx" ON "WeighEvent"("ticket");

-- CreateIndex
CREATE INDEX "WeighEvent_line_idx" ON "WeighEvent"("line");

-- CreateIndex
CREATE INDEX "WeighEvent_scale_idx" ON "WeighEvent"("scale");

-- CreateIndex
CREATE INDEX "WeighEvent_capturedBy_idx" ON "WeighEvent"("capturedBy");

-- CreateIndex
CREATE INDEX "TicketAttachment_ticket_idx" ON "TicketAttachment"("ticket");

-- CreateIndex
CREATE INDEX "TicketAttachment_line_idx" ON "TicketAttachment"("line");

-- CreateIndex
CREATE INDEX "TicketAttachment_capturedBy_idx" ON "TicketAttachment"("capturedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_idempotencyKeyHash_key" ON "Payout"("idempotencyKeyHash");

-- CreateIndex
CREATE INDEX "Payout_ticket_idx" ON "Payout"("ticket");

-- CreateIndex
CREATE INDEX "Payout_settlement_idx" ON "Payout"("settlement");

-- CreateIndex
CREATE INDEX "Payout_seller_idx" ON "Payout"("seller");

-- CreateIndex
CREATE INDEX "Payout_account_idx" ON "Payout"("account");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE INDEX "Payout_paidBy_idx" ON "Payout"("paidBy");

-- CreateIndex
CREATE INDEX "Payout_drawerSession_idx" ON "Payout"("drawerSession");

-- CreateIndex
CREATE INDEX "Payout_replaces_idx" ON "Payout"("replaces");

-- CreateIndex
CREATE INDEX "Payout_status_release_idx" ON "Payout"("status", "releaseAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_bank_check_key" ON "Payout"("bankAccountLabel", "checkNumber");

-- CreateIndex
CREATE INDEX "CashDrawer_yard_idx" ON "CashDrawer"("yard");

-- CreateIndex
CREATE INDEX "CashDrawerSession_drawer_idx" ON "CashDrawerSession"("drawer");

-- CreateIndex
CREATE INDEX "CashDrawerSession_cashier_idx" ON "CashDrawerSession"("cashier");

-- CreateIndex
CREATE INDEX "CashDrawerSession_status_idx" ON "CashDrawerSession"("status");

-- CreateIndex
CREATE INDEX "CashDrawerSession_approvedBy_idx" ON "CashDrawerSession"("approvedBy");

-- CreateIndex
CREATE UNIQUE INDEX "CashDrawerEvent_referenceKey_key" ON "CashDrawerEvent"("referenceKey");

-- CreateIndex
CREATE INDEX "CashDrawerEvent_session_idx" ON "CashDrawerEvent"("session");

-- CreateIndex
CREATE INDEX "CashDrawerEvent_payout_idx" ON "CashDrawerEvent"("payout");

-- CreateIndex
CREATE INDEX "CashDrawerEvent_ticket_idx" ON "CashDrawerEvent"("ticket");

-- CreateIndex
CREATE INDEX "CashDrawerEvent_createdBy_idx" ON "CashDrawerEvent"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "AccountCharge_referenceKey_key" ON "AccountCharge"("referenceKey");

-- CreateIndex
CREATE INDEX "AccountCharge_account_idx" ON "AccountCharge"("account");

-- CreateIndex
CREATE INDEX "AccountCharge_job_idx" ON "AccountCharge"("job");

-- CreateIndex
CREATE INDEX "AccountCharge_container_idx" ON "AccountCharge"("container");

-- CreateIndex
CREATE INDEX "AccountCharge_settlement_idx" ON "AccountCharge"("settlement");

-- CreateIndex
CREATE INDEX "AccountCharge_invoiceLine_idx" ON "AccountCharge"("invoiceLine");

-- CreateIndex
CREATE INDEX "AccountCharge_status_idx" ON "AccountCharge"("status");

-- CreateIndex
CREATE INDEX "Settlement_account_idx" ON "Settlement"("account");

-- CreateIndex
CREATE INDEX "Settlement_status_idx" ON "Settlement"("status");

-- CreateIndex
CREATE INDEX "Settlement_payout_idx" ON "Settlement"("payout");

-- CreateIndex
CREATE INDEX "Settlement_invoice_idx" ON "Settlement"("invoice");

-- CreateIndex
CREATE INDEX "Settlement_approvedBy_idx" ON "Settlement"("approvedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_number_key" ON "Settlement"("number");

-- CreateIndex
CREATE INDEX "InventoryBalance_yard_idx" ON "InventoryBalance"("yard");

-- CreateIndex
CREATE INDEX "InventoryBalance_material_idx" ON "InventoryBalance"("material");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBalance_yard_material_key" ON "InventoryBalance"("yard", "material");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_referenceKey_key" ON "InventoryMovement"("referenceKey");

-- CreateIndex
CREATE INDEX "InventoryMovement_yard_idx" ON "InventoryMovement"("yard");

-- CreateIndex
CREATE INDEX "InventoryMovement_material_idx" ON "InventoryMovement"("material");

-- CreateIndex
CREATE INDEX "InventoryMovement_ticket_idx" ON "InventoryMovement"("ticket");

-- CreateIndex
CREATE INDEX "InventoryMovement_ticketLine_idx" ON "InventoryMovement"("ticketLine");

-- CreateIndex
CREATE INDEX "InventoryMovement_processingRun_idx" ON "InventoryMovement"("processingRun");

-- CreateIndex
CREATE INDEX "InventoryMovement_transfer_idx" ON "InventoryMovement"("transfer");

-- CreateIndex
CREATE INDEX "InventoryMovement_unit_idx" ON "InventoryMovement"("unit");

-- CreateIndex
CREATE INDEX "InventoryMovement_reviewedBy_idx" ON "InventoryMovement"("reviewedBy");

-- CreateIndex
CREATE INDEX "InventoryMovement_createdBy_idx" ON "InventoryMovement"("createdBy");

-- CreateIndex
CREATE INDEX "InventoryUnit_yard_idx" ON "InventoryUnit"("yard");

-- CreateIndex
CREATE INDEX "InventoryUnit_material_idx" ON "InventoryUnit"("material");

-- CreateIndex
CREATE INDEX "InventoryUnit_status_idx" ON "InventoryUnit"("status");

-- CreateIndex
CREATE INDEX "InventoryUnit_shipment_idx" ON "InventoryUnit"("shipment");

-- CreateIndex
CREATE INDEX "InventoryUnit_listing_idx" ON "InventoryUnit"("listing");

-- CreateIndex
CREATE INDEX "InventoryUnit_transfer_idx" ON "InventoryUnit"("transfer");

-- CreateIndex
CREATE INDEX "InventoryUnit_createdFromRun_idx" ON "InventoryUnit"("createdFromRun");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryUnit_yard_tag_key" ON "InventoryUnit"("yard", "tagNumber");

-- CreateIndex
CREATE INDEX "ProcessingRun_yard_idx" ON "ProcessingRun"("yard");

-- CreateIndex
CREATE INDEX "ProcessingRun_status_idx" ON "ProcessingRun"("status");

-- CreateIndex
CREATE INDEX "ProcessingRun_operator_idx" ON "ProcessingRun"("operator");

-- CreateIndex
CREATE INDEX "YardTransfer_fromYard_idx" ON "YardTransfer"("fromYard");

-- CreateIndex
CREATE INDEX "YardTransfer_toYard_idx" ON "YardTransfer"("toYard");

-- CreateIndex
CREATE INDEX "YardTransfer_status_idx" ON "YardTransfer"("status");

-- CreateIndex
CREATE INDEX "YardTransfer_sentBy_idx" ON "YardTransfer"("sentBy");

-- CreateIndex
CREATE INDEX "YardTransfer_receivedBy_idx" ON "YardTransfer"("receivedBy");

-- CreateIndex
CREATE INDEX "Listing_yard_idx" ON "Listing"("yard");

-- CreateIndex
CREATE INDEX "Listing_material_idx" ON "Listing"("material");

-- CreateIndex
CREATE INDEX "Listing_status_idx" ON "Listing"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_salesOrder_key" ON "Offer"("salesOrder");

-- CreateIndex
CREATE INDEX "Offer_listing_idx" ON "Offer"("listing");

-- CreateIndex
CREATE INDEX "Offer_account_idx" ON "Offer"("account");

-- CreateIndex
CREATE INDEX "Offer_contact_idx" ON "Offer"("contact");

-- CreateIndex
CREATE INDEX "Offer_status_idx" ON "Offer"("status");

-- CreateIndex
CREATE INDEX "Offer_decidedBy_idx" ON "Offer"("decidedBy");

-- CreateIndex
CREATE INDEX "SalesOrder_yard_idx" ON "SalesOrder"("yard");

-- CreateIndex
CREATE INDEX "SalesOrder_account_idx" ON "SalesOrder"("account");

-- CreateIndex
CREATE INDEX "SalesOrder_status_idx" ON "SalesOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_number_key" ON "SalesOrder"("number");

-- CreateIndex
CREATE INDEX "SalesOrderLine_order_idx" ON "SalesOrderLine"("order");

-- CreateIndex
CREATE INDEX "SalesOrderLine_material_idx" ON "SalesOrderLine"("material");

-- CreateIndex
CREATE INDEX "SalesOrderLine_listing_idx" ON "SalesOrderLine"("listing");

-- CreateIndex
CREATE INDEX "Shipment_order_idx" ON "Shipment"("order");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");

-- CreateIndex
CREATE INDEX "Shipment_invoice_idx" ON "Shipment"("invoice");

-- CreateIndex
CREATE INDEX "Shipment_job_idx" ON "Shipment"("job");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_number_key" ON "Shipment"("number");

-- CreateIndex
CREATE INDEX "Invoice_account_idx" ON "Invoice"("account");

-- CreateIndex
CREATE INDEX "Invoice_seller_idx" ON "Invoice"("seller");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_shipment_idx" ON "Invoice"("shipment");

-- CreateIndex
CREATE INDEX "Invoice_settlement_idx" ON "Invoice"("settlement");

-- CreateIndex
CREATE INDEX "Invoice_serviceRequest_idx" ON "Invoice"("serviceRequest");

-- CreateIndex
CREATE INDEX "Invoice_ticket_idx" ON "Invoice"("ticket");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoice_idx" ON "InvoiceLine"("invoice");

-- CreateIndex
CREATE INDEX "InvoiceLine_material_idx" ON "InvoiceLine"("material");

-- CreateIndex
CREATE INDEX "InvoiceLine_claim_idx" ON "InvoiceLine"("claim");

-- CreateIndex
CREATE INDEX "Claim_shipment_idx" ON "Claim"("shipment");

-- CreateIndex
CREATE INDEX "Claim_account_idx" ON "Claim"("account");

-- CreateIndex
CREATE INDEX "Claim_openedBy_idx" ON "Claim"("openedBy");

-- CreateIndex
CREATE INDEX "Claim_status_idx" ON "Claim"("status");

-- CreateIndex
CREATE INDEX "Claim_decidedBy_idx" ON "Claim"("decidedBy");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProvider_code_key" ON "PaymentProvider"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSession_serviceRequest_key" ON "PaymentSession"("serviceRequest");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSession_providerPaymentId_key" ON "PaymentSession"("providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSession_idempotencyKeyHash_key" ON "PaymentSession"("idempotencyKeyHash");

-- CreateIndex
CREATE INDEX "PaymentSession_provider_idx" ON "PaymentSession"("provider");

-- CreateIndex
CREATE INDEX "PaymentSession_invoice_idx" ON "PaymentSession"("invoice");

-- CreateIndex
CREATE INDEX "PaymentSession_ticket_idx" ON "PaymentSession"("ticket");

-- CreateIndex
CREATE INDEX "PaymentSession_payer_idx" ON "PaymentSession"("payer");

-- CreateIndex
CREATE INDEX "PaymentSession_status_idx" ON "PaymentSession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_referenceKey_key" ON "Payment"("referenceKey");

-- CreateIndex
CREATE INDEX "Payment_invoice_idx" ON "Payment"("invoice");

-- CreateIndex
CREATE INDEX "Payment_session_idx" ON "Payment"("session");

-- CreateIndex
CREATE INDEX "Payment_recordedBy_idx" ON "Payment"("recordedBy");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_providerRefundId_key" ON "Refund"("providerRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_idempotencyKeyHash_key" ON "Refund"("idempotencyKeyHash");

-- CreateIndex
CREATE INDEX "Refund_payment_idx" ON "Refund"("payment");

-- CreateIndex
CREATE INDEX "Refund_session_idx" ON "Refund"("session");

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE INDEX "Refund_claim_idx" ON "Refund"("claim");

-- CreateIndex
CREATE INDEX "Refund_serviceRequest_idx" ON "Refund"("serviceRequest");

-- CreateIndex
CREATE INDEX "Refund_createdBy_idx" ON "Refund"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_providerEventId_key" ON "PaymentWebhookEvent"("providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "ContainerType_slug_key" ON "ContainerType"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Container_number_key" ON "Container"("number");

-- CreateIndex
CREATE INDEX "Container_type_idx" ON "Container"("type");

-- CreateIndex
CREATE INDEX "Container_homeYard_idx" ON "Container"("homeYard");

-- CreateIndex
CREATE INDEX "Container_status_idx" ON "Container"("status");

-- CreateIndex
CREATE INDEX "Container_site_idx" ON "Container"("site");

-- CreateIndex
CREATE INDEX "Container_account_idx" ON "Container"("account");

-- CreateIndex
CREATE INDEX "Container_currentMaterial_idx" ON "Container"("currentMaterial");

-- CreateIndex
CREATE INDEX "ServiceRequest_yard_idx" ON "ServiceRequest"("yard");

-- CreateIndex
CREATE INDEX "ServiceRequest_account_idx" ON "ServiceRequest"("account");

-- CreateIndex
CREATE INDEX "ServiceRequest_seller_idx" ON "ServiceRequest"("seller");

-- CreateIndex
CREATE INDEX "ServiceRequest_requestedBy_idx" ON "ServiceRequest"("requestedBy");

-- CreateIndex
CREATE INDEX "ServiceRequest_site_idx" ON "ServiceRequest"("site");

-- CreateIndex
CREATE INDEX "ServiceRequest_containerType_idx" ON "ServiceRequest"("containerType");

-- CreateIndex
CREATE INDEX "ServiceRequest_container_idx" ON "ServiceRequest"("container");

-- CreateIndex
CREATE INDEX "ServiceRequest_material_idx" ON "ServiceRequest"("material");

-- CreateIndex
CREATE INDEX "ServiceRequest_status_idx" ON "ServiceRequest"("status");

-- CreateIndex
CREATE INDEX "ServiceRequest_invoice_idx" ON "ServiceRequest"("invoice");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_number_key" ON "ServiceRequest"("number");

-- CreateIndex
CREATE INDEX "Truck_yard_idx" ON "Truck"("yard");

-- CreateIndex
CREATE UNIQUE INDEX "DispatchJob_request_key" ON "DispatchJob"("request");

-- CreateIndex
CREATE INDEX "DispatchJob_yard_idx" ON "DispatchJob"("yard");

-- CreateIndex
CREATE INDEX "DispatchJob_shipment_idx" ON "DispatchJob"("shipment");

-- CreateIndex
CREATE INDEX "DispatchJob_status_idx" ON "DispatchJob"("status");

-- CreateIndex
CREATE INDEX "DispatchJob_driver_idx" ON "DispatchJob"("driver");

-- CreateIndex
CREATE INDEX "DispatchJob_truck_idx" ON "DispatchJob"("truck");

-- CreateIndex
CREATE INDEX "DispatchJob_dropContainer_idx" ON "DispatchJob"("dropContainer");

-- CreateIndex
CREATE INDEX "DispatchJob_pickContainer_idx" ON "DispatchJob"("pickContainer");

-- CreateIndex
CREATE INDEX "DispatchJob_site_idx" ON "DispatchJob"("site");

-- CreateIndex
CREATE UNIQUE INDEX "DispatchJob_number_key" ON "DispatchJob"("number");

-- CreateIndex
CREATE UNIQUE INDEX "DonationCampaign_slug_key" ON "DonationCampaign"("slug");

-- CreateIndex
CREATE INDEX "DonationCampaign_account_idx" ON "DonationCampaign"("account");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_receiptNumber_key" ON "Donation"("receiptNumber");

-- CreateIndex
CREATE INDEX "Donation_ticket_idx" ON "Donation"("ticket");

-- CreateIndex
CREATE INDEX "Donation_seller_idx" ON "Donation"("seller");

-- CreateIndex
CREATE INDEX "Donation_account_idx" ON "Donation"("account");

-- CreateIndex
CREATE INDEX "Donation_campaign_idx" ON "Donation"("campaign");

-- CreateIndex
CREATE INDEX "Donation_status_idx" ON "Donation"("status");

-- CreateIndex
CREATE INDEX "Donation_settlement_idx" ON "Donation"("settlement");

-- CreateIndex
CREATE INDEX "MaterialRestriction_profile_idx" ON "MaterialRestriction"("profile");

-- CreateIndex
CREATE INDEX "MaterialRestriction_material_idx" ON "MaterialRestriction"("material");

-- CreateIndex
CREATE INDEX "MaterialRestriction_category_idx" ON "MaterialRestriction"("category");

-- CreateIndex
CREATE INDEX "HoldTag_ticket_idx" ON "HoldTag"("ticket");

-- CreateIndex
CREATE INDEX "HoldTag_line_idx" ON "HoldTag"("line");

-- CreateIndex
CREATE INDEX "HoldTag_yard_idx" ON "HoldTag"("yard");

-- CreateIndex
CREATE INDEX "HoldTag_material_idx" ON "HoldTag"("material");

-- CreateIndex
CREATE INDEX "HoldTag_status_idx" ON "HoldTag"("status");

-- CreateIndex
CREATE INDEX "HoldTag_releasedBy_idx" ON "HoldTag"("releasedBy");

-- CreateIndex
CREATE INDEX "DoNotBuyEntry_nameNormalized_idx" ON "DoNotBuyEntry"("nameNormalized");

-- CreateIndex
CREATE INDEX "DoNotBuyEntry_idNumberNormalized_idx" ON "DoNotBuyEntry"("idNumberNormalized");

-- CreateIndex
CREATE INDEX "DoNotBuyEntry_plateNormalized_idx" ON "DoNotBuyEntry"("plateNormalized");

-- CreateIndex
CREATE INDEX "DoNotBuyEntry_seller_idx" ON "DoNotBuyEntry"("seller");

-- CreateIndex
CREATE INDEX "DoNotBuyEntry_addedBy_idx" ON "DoNotBuyEntry"("addedBy");

-- CreateIndex
CREATE INDEX "ComplianceReport_yard_idx" ON "ComplianceReport"("yard");

-- CreateIndex
CREATE INDEX "ComplianceReport_status_idx" ON "ComplianceReport"("status");

-- CreateIndex
CREATE INDEX "ComplianceReport_generatedBy_idx" ON "ComplianceReport"("generatedBy");

-- CreateIndex
CREATE INDEX "ComplianceReport_submittedBy_idx" ON "ComplianceReport"("submittedBy");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceReport_yard_date_key" ON "ComplianceReport"("yard", "reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_eventKey_key" ON "AuditEvent"("eventKey");

-- CreateIndex
CREATE INDEX "AuditEvent_eventType_idx" ON "AuditEvent"("eventType");

-- CreateIndex
CREATE INDEX "AuditEvent_aggregateId_idx" ON "AuditEvent"("aggregateId");

-- CreateIndex
CREATE INDEX "AuditEvent_yard_idx" ON "AuditEvent"("yard");

-- CreateIndex
CREATE INDEX "AuditEvent_actor_idx" ON "AuditEvent"("actor");

-- CreateIndex
CREATE UNIQUE INDEX "CommandReceipt_eventKey_key" ON "CommandReceipt"("eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthApp_clientId_key" ON "OAuthApp"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthToken_token_key" ON "OAuthToken"("token");

-- CreateIndex
CREATE INDEX "OAuthToken_clientId_idx" ON "OAuthToken"("clientId");

-- CreateIndex
CREATE INDEX "OAuthToken_user_idx" ON "OAuthToken"("user");

-- CreateIndex
CREATE INDEX "_User_yards_B_index" ON "_User_yards"("B");

-- CreateIndex
CREATE INDEX "_TheftAlert_materials_B_index" ON "_TheftAlert_materials"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_role_fkey" FOREIGN KEY ("role") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Yard" ADD CONSTRAINT "Yard_rulesProfile_fkey" FOREIGN KEY ("rulesProfile") REFERENCES "RulesProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Yard" ADD CONSTRAINT "Yard_boardPriceList_fkey" FOREIGN KEY ("boardPriceList") REFERENCES "PriceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YardClosure" ADD CONSTRAINT "YardClosure_yard_fkey" FOREIGN KEY ("yard") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scale" ADD CONSTRAINT "Scale_yard_fkey" FOREIGN KEY ("yard") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_yard_fkey" FOREIGN KEY ("yard") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_category_fkey" FOREIGN KEY ("category") REFERENCES "MaterialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceList" ADD CONSTRAINT "PriceList_yard_fkey" FOREIGN KEY ("yard") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceEntry" ADD CONSTRAINT "PriceEntry_priceList_fkey" FOREIGN KEY ("priceList") REFERENCES "PriceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceEntry" ADD CONSTRAINT "PriceEntry_material_fkey" FOREIGN KEY ("material") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceEntry" ADD CONSTRAINT "PriceEntry_publishedBy_fkey" FOREIGN KEY ("publishedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seller" ADD CONSTRAINT "Seller_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seller" ADD CONSTRAINT "Seller_priceList_fkey" FOREIGN KEY ("priceList") REFERENCES "PriceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seller" ADD CONSTRAINT "Seller_defaultNonprofit_fkey" FOREIGN KEY ("defaultNonprofit") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDocument" ADD CONSTRAINT "IdentityDocument_seller_fkey" FOREIGN KEY ("seller") REFERENCES "Seller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDocument" ADD CONSTRAINT "IdentityDocument_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_seller_fkey" FOREIGN KEY ("seller") REFERENCES "Seller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_account_fkey" FOREIGN KEY ("account") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_priceList_fkey" FOREIGN KEY ("priceList") REFERENCES "PriceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountContact" ADD CONSTRAINT "AccountContact_account_fkey" FOREIGN KEY ("account") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountContact" ADD CONSTRAINT "AccountContact_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountApplication" ADD CONSTRAINT "AccountApplication_applicant_fkey" FOREIGN KEY ("applicant") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountApplication" ADD CONSTRAINT "AccountApplication_decidedBy_fkey" FOREIGN KEY ("decidedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountApplication" ADD CONSTRAINT "AccountApplication_account_fkey" FOREIGN KEY ("account") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountDocument" ADD CONSTRAINT "AccountDocument_account_fkey" FOREIGN KEY ("account") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountDocument" ADD CONSTRAINT "AccountDocument_ticket_fkey" FOREIGN KEY ("ticket") REFERENCES "ScaleTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSite" ADD CONSTRAINT "ServiceSite_account_fkey" FOREIGN KEY ("account") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSite" ADD CONSTRAINT "ServiceSite_seller_fkey" FOREIGN KEY ("seller") REFERENCES "Seller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_seller_fkey" FOREIGN KEY ("seller") REFERENCES "Seller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_yard_fkey" FOREIGN KEY ("yard") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_vehicle_fkey" FOREIGN KEY ("vehicle") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_nonprofit_fkey" FOREIGN KEY ("nonprofit") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_campaign_fkey" FOREIGN KEY ("campaign") REFERENCES "DonationCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaleTicket" ADD CONSTRAINT "ScaleTicket_yard_fkey" FOREIGN KEY ("yard") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaleTicket" ADD CONSTRAINT "ScaleTicket_seller_fkey" FOREIGN KEY ("seller") REFERENCES "Seller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaleTicket" ADD CONSTRAINT "ScaleTicket_account_fkey" FOREIGN KEY ("account") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaleTicket" ADD CONSTRAINT "ScaleTicket_site_fkey" FOREIGN KEY ("site") REFERENCES "ServiceSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaleTicket" ADD CONSTRAINT "ScaleTicket_vehicle_fkey" FOREIGN KEY ("vehicle") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaleTicket" ADD CONSTRAINT "ScaleTicket_visit_fkey" FOREIGN KEY ("visit") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaleTicket" ADD CONSTRAINT "ScaleTicket_job_fkey" FOREIGN KEY ("job") REFERENCES "DispatchJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaleTicket" ADD CONSTRAINT "ScaleTicket_container_fkey" FOREIGN KEY ("container") REFERENCES "Container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaleTicket" ADD CONSTRAINT "ScaleTicket_shipment_fkey" FOREIGN KEY ("shipment") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaleTicket" ADD CONSTRAINT "ScaleTicket_adjusts_fkey" FOREIGN KEY ("adjusts") REFERENCES "ScaleTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaleTicket" ADD CONSTRAINT "ScaleTicket_nonprofit_fkey" FOREIGN KEY ("nonprofit") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaleTicket" ADD CONSTRAINT "ScaleTicket_campaign_fkey" FOREIGN KEY ("campaign") REFERENCES "DonationCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaleTicket" ADD CONSTRAINT "ScaleTicket_overrideBy_fkey" FOREIGN KEY ("overrideBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaleTicket" ADD CONSTRAINT "ScaleTicket_openedBy_fkey" FOREIGN KEY ("openedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaleTicket" ADD CONSTRAINT "ScaleTicket_completedBy_fkey" FOREIGN KEY ("completedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaleTicket" ADD CONSTRAINT "ScaleTicket_voidedBy_fkey" FOREIGN KEY ("voidedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaleTicket" ADD CONSTRAINT "ScaleTicket_settlement_fkey" FOREIGN KEY ("settlement") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketLine" ADD CONSTRAINT "TicketLine_ticket_fkey" FOREIGN KEY ("ticket") REFERENCES "ScaleTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketLine" ADD CONSTRAINT "TicketLine_material_fkey" FOREIGN KEY ("material") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketLine" ADD CONSTRAINT "TicketLine_priceEntry_fkey" FOREIGN KEY ("priceEntry") REFERENCES "PriceEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketLine" ADD CONSTRAINT "TicketLine_overrideBy_fkey" FOREIGN KEY ("overrideBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketLine" ADD CONSTRAINT "TicketLine_restriction_fkey" FOREIGN KEY ("restriction") REFERENCES "MaterialRestriction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketLine" ADD CONSTRAINT "TicketLine_payout_fkey" FOREIGN KEY ("payout") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketLine" ADD CONSTRAINT "TicketLine_inventoryUnit_fkey" FOREIGN KEY ("inventoryUnit") REFERENCES "InventoryUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeighEvent" ADD CONSTRAINT "WeighEvent_ticket_fkey" FOREIGN KEY ("ticket") REFERENCES "ScaleTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeighEvent" ADD CONSTRAINT "WeighEvent_line_fkey" FOREIGN KEY ("line") REFERENCES "TicketLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeighEvent" ADD CONSTRAINT "WeighEvent_scale_fkey" FOREIGN KEY ("scale") REFERENCES "Scale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeighEvent" ADD CONSTRAINT "WeighEvent_capturedBy_fkey" FOREIGN KEY ("capturedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_ticket_fkey" FOREIGN KEY ("ticket") REFERENCES "ScaleTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_line_fkey" FOREIGN KEY ("line") REFERENCES "TicketLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_capturedBy_fkey" FOREIGN KEY ("capturedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_ticket_fkey" FOREIGN KEY ("ticket") REFERENCES "ScaleTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_settlement_fkey" FOREIGN KEY ("settlement") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_seller_fkey" FOREIGN KEY ("seller") REFERENCES "Seller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_account_fkey" FOREIGN KEY ("account") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_paidBy_fkey" FOREIGN KEY ("paidBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_drawerSession_fkey" FOREIGN KEY ("drawerSession") REFERENCES "CashDrawerSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_replaces_fkey" FOREIGN KEY ("replaces") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawer" ADD CONSTRAINT "CashDrawer_yard_fkey" FOREIGN KEY ("yard") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawerSession" ADD CONSTRAINT "CashDrawerSession_drawer_fkey" FOREIGN KEY ("drawer") REFERENCES "CashDrawer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawerSession" ADD CONSTRAINT "CashDrawerSession_cashier_fkey" FOREIGN KEY ("cashier") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawerSession" ADD CONSTRAINT "CashDrawerSession_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawerEvent" ADD CONSTRAINT "CashDrawerEvent_session_fkey" FOREIGN KEY ("session") REFERENCES "CashDrawerSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawerEvent" ADD CONSTRAINT "CashDrawerEvent_payout_fkey" FOREIGN KEY ("payout") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawerEvent" ADD CONSTRAINT "CashDrawerEvent_ticket_fkey" FOREIGN KEY ("ticket") REFERENCES "ScaleTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawerEvent" ADD CONSTRAINT "CashDrawerEvent_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountCharge" ADD CONSTRAINT "AccountCharge_account_fkey" FOREIGN KEY ("account") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountCharge" ADD CONSTRAINT "AccountCharge_job_fkey" FOREIGN KEY ("job") REFERENCES "DispatchJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountCharge" ADD CONSTRAINT "AccountCharge_container_fkey" FOREIGN KEY ("container") REFERENCES "Container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountCharge" ADD CONSTRAINT "AccountCharge_settlement_fkey" FOREIGN KEY ("settlement") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountCharge" ADD CONSTRAINT "AccountCharge_invoiceLine_fkey" FOREIGN KEY ("invoiceLine") REFERENCES "InvoiceLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_account_fkey" FOREIGN KEY ("account") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_payout_fkey" FOREIGN KEY ("payout") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_yard_fkey" FOREIGN KEY ("yard") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_material_fkey" FOREIGN KEY ("material") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_yard_fkey" FOREIGN KEY ("yard") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_material_fkey" FOREIGN KEY ("material") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_ticket_fkey" FOREIGN KEY ("ticket") REFERENCES "ScaleTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_ticketLine_fkey" FOREIGN KEY ("ticketLine") REFERENCES "TicketLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_processingRun_fkey" FOREIGN KEY ("processingRun") REFERENCES "ProcessingRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_transfer_fkey" FOREIGN KEY ("transfer") REFERENCES "YardTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_unit_fkey" FOREIGN KEY ("unit") REFERENCES "InventoryUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryUnit" ADD CONSTRAINT "InventoryUnit_yard_fkey" FOREIGN KEY ("yard") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryUnit" ADD CONSTRAINT "InventoryUnit_material_fkey" FOREIGN KEY ("material") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryUnit" ADD CONSTRAINT "InventoryUnit_shipment_fkey" FOREIGN KEY ("shipment") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryUnit" ADD CONSTRAINT "InventoryUnit_listing_fkey" FOREIGN KEY ("listing") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryUnit" ADD CONSTRAINT "InventoryUnit_transfer_fkey" FOREIGN KEY ("transfer") REFERENCES "YardTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryUnit" ADD CONSTRAINT "InventoryUnit_createdFromRun_fkey" FOREIGN KEY ("createdFromRun") REFERENCES "ProcessingRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingRun" ADD CONSTRAINT "ProcessingRun_yard_fkey" FOREIGN KEY ("yard") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingRun" ADD CONSTRAINT "ProcessingRun_operator_fkey" FOREIGN KEY ("operator") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YardTransfer" ADD CONSTRAINT "YardTransfer_fromYard_fkey" FOREIGN KEY ("fromYard") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YardTransfer" ADD CONSTRAINT "YardTransfer_toYard_fkey" FOREIGN KEY ("toYard") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YardTransfer" ADD CONSTRAINT "YardTransfer_sentBy_fkey" FOREIGN KEY ("sentBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YardTransfer" ADD CONSTRAINT "YardTransfer_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_yard_fkey" FOREIGN KEY ("yard") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_material_fkey" FOREIGN KEY ("material") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_listing_fkey" FOREIGN KEY ("listing") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_account_fkey" FOREIGN KEY ("account") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_contact_fkey" FOREIGN KEY ("contact") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_decidedBy_fkey" FOREIGN KEY ("decidedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_salesOrder_fkey" FOREIGN KEY ("salesOrder") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_yard_fkey" FOREIGN KEY ("yard") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_account_fkey" FOREIGN KEY ("account") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_order_fkey" FOREIGN KEY ("order") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_material_fkey" FOREIGN KEY ("material") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_listing_fkey" FOREIGN KEY ("listing") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_order_fkey" FOREIGN KEY ("order") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_job_fkey" FOREIGN KEY ("job") REFERENCES "DispatchJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_account_fkey" FOREIGN KEY ("account") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_seller_fkey" FOREIGN KEY ("seller") REFERENCES "Seller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_shipment_fkey" FOREIGN KEY ("shipment") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_settlement_fkey" FOREIGN KEY ("settlement") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_serviceRequest_fkey" FOREIGN KEY ("serviceRequest") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_ticket_fkey" FOREIGN KEY ("ticket") REFERENCES "ScaleTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_material_fkey" FOREIGN KEY ("material") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_claim_fkey" FOREIGN KEY ("claim") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_shipment_fkey" FOREIGN KEY ("shipment") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_account_fkey" FOREIGN KEY ("account") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_openedBy_fkey" FOREIGN KEY ("openedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_decidedBy_fkey" FOREIGN KEY ("decidedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_provider_fkey" FOREIGN KEY ("provider") REFERENCES "PaymentProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_serviceRequest_fkey" FOREIGN KEY ("serviceRequest") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_ticket_fkey" FOREIGN KEY ("ticket") REFERENCES "ScaleTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_payer_fkey" FOREIGN KEY ("payer") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_session_fkey" FOREIGN KEY ("session") REFERENCES "PaymentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_payment_fkey" FOREIGN KEY ("payment") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_session_fkey" FOREIGN KEY ("session") REFERENCES "PaymentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_claim_fkey" FOREIGN KEY ("claim") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_serviceRequest_fkey" FOREIGN KEY ("serviceRequest") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_type_fkey" FOREIGN KEY ("type") REFERENCES "ContainerType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_homeYard_fkey" FOREIGN KEY ("homeYard") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_site_fkey" FOREIGN KEY ("site") REFERENCES "ServiceSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_account_fkey" FOREIGN KEY ("account") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_currentMaterial_fkey" FOREIGN KEY ("currentMaterial") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_yard_fkey" FOREIGN KEY ("yard") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_account_fkey" FOREIGN KEY ("account") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_seller_fkey" FOREIGN KEY ("seller") REFERENCES "Seller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_site_fkey" FOREIGN KEY ("site") REFERENCES "ServiceSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_containerType_fkey" FOREIGN KEY ("containerType") REFERENCES "ContainerType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_container_fkey" FOREIGN KEY ("container") REFERENCES "Container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_material_fkey" FOREIGN KEY ("material") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Truck" ADD CONSTRAINT "Truck_yard_fkey" FOREIGN KEY ("yard") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchJob" ADD CONSTRAINT "DispatchJob_yard_fkey" FOREIGN KEY ("yard") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchJob" ADD CONSTRAINT "DispatchJob_request_fkey" FOREIGN KEY ("request") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchJob" ADD CONSTRAINT "DispatchJob_shipment_fkey" FOREIGN KEY ("shipment") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchJob" ADD CONSTRAINT "DispatchJob_driver_fkey" FOREIGN KEY ("driver") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchJob" ADD CONSTRAINT "DispatchJob_truck_fkey" FOREIGN KEY ("truck") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchJob" ADD CONSTRAINT "DispatchJob_dropContainer_fkey" FOREIGN KEY ("dropContainer") REFERENCES "Container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchJob" ADD CONSTRAINT "DispatchJob_pickContainer_fkey" FOREIGN KEY ("pickContainer") REFERENCES "Container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchJob" ADD CONSTRAINT "DispatchJob_site_fkey" FOREIGN KEY ("site") REFERENCES "ServiceSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationCampaign" ADD CONSTRAINT "DonationCampaign_account_fkey" FOREIGN KEY ("account") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_ticket_fkey" FOREIGN KEY ("ticket") REFERENCES "ScaleTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_seller_fkey" FOREIGN KEY ("seller") REFERENCES "Seller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_account_fkey" FOREIGN KEY ("account") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_campaign_fkey" FOREIGN KEY ("campaign") REFERENCES "DonationCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_settlement_fkey" FOREIGN KEY ("settlement") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRestriction" ADD CONSTRAINT "MaterialRestriction_profile_fkey" FOREIGN KEY ("profile") REFERENCES "RulesProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRestriction" ADD CONSTRAINT "MaterialRestriction_material_fkey" FOREIGN KEY ("material") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRestriction" ADD CONSTRAINT "MaterialRestriction_category_fkey" FOREIGN KEY ("category") REFERENCES "MaterialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoldTag" ADD CONSTRAINT "HoldTag_ticket_fkey" FOREIGN KEY ("ticket") REFERENCES "ScaleTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoldTag" ADD CONSTRAINT "HoldTag_line_fkey" FOREIGN KEY ("line") REFERENCES "TicketLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoldTag" ADD CONSTRAINT "HoldTag_yard_fkey" FOREIGN KEY ("yard") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoldTag" ADD CONSTRAINT "HoldTag_material_fkey" FOREIGN KEY ("material") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoldTag" ADD CONSTRAINT "HoldTag_releasedBy_fkey" FOREIGN KEY ("releasedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoNotBuyEntry" ADD CONSTRAINT "DoNotBuyEntry_seller_fkey" FOREIGN KEY ("seller") REFERENCES "Seller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoNotBuyEntry" ADD CONSTRAINT "DoNotBuyEntry_addedBy_fkey" FOREIGN KEY ("addedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceReport" ADD CONSTRAINT "ComplianceReport_yard_fkey" FOREIGN KEY ("yard") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceReport" ADD CONSTRAINT "ComplianceReport_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceReport" ADD CONSTRAINT "ComplianceReport_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_yard_fkey" FOREIGN KEY ("yard") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_User_yards" ADD CONSTRAINT "_User_yards_A_fkey" FOREIGN KEY ("A") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_User_yards" ADD CONSTRAINT "_User_yards_B_fkey" FOREIGN KEY ("B") REFERENCES "Yard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TheftAlert_materials" ADD CONSTRAINT "_TheftAlert_materials_A_fkey" FOREIGN KEY ("A") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TheftAlert_materials" ADD CONSTRAINT "_TheftAlert_materials_B_fkey" FOREIGN KEY ("B") REFERENCES "TheftAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

