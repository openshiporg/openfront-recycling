"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default2
});
module.exports = __toCommonJS(keystone_exports);

// features/keystone/index.ts
var import_auth = require("@keystone-6/auth");
var import_core15 = require("@keystone-6/core");
var import_config = require("dotenv/config");

// features/keystone/models/people.ts
var import_core = require("@keystone-6/core");
var import_fields2 = require("@keystone-6/core/fields");

// features/keystone/access.ts
var ROLE_FLAGS = [
  "canAccessDashboard",
  "canManageTickets",
  "canGradeTickets",
  "canOverridePrices",
  "canVoidTickets",
  "canPaySellers",
  "canManageCashDrawers",
  "canApproveVariances",
  "canManagePricing",
  "canManageMaterials",
  "canManageSellers",
  "canManageAccounts",
  "canManageInventory",
  "canManageSales",
  "canManageDispatch",
  "canDriveJobs",
  "canManageCompliance",
  "canManageFinance",
  "canViewReports",
  "canManageSettings",
  "canManageStaff",
  "canManageOnboarding",
  "canSeeOtherPeople",
  "canEditOtherPeople",
  "canManagePeople",
  "canManageRoles"
];
function isSignedIn({ session }) {
  return Boolean(session);
}
function hasFlag(session, flag2) {
  return session?.data?.role?.[flag2] === true;
}
function isStaff(session) {
  return hasFlag(session, "canAccessDashboard");
}
function seesAllYards(session) {
  return hasFlag(session, "canManageSettings");
}
function sessionYardIds(session) {
  return (session?.data?.yards || []).map((yard) => yard.id);
}
function flag(name) {
  return ({ session }) => isStaff(session) && hasFlag(session, name);
}
var permissions = Object.fromEntries(
  ROLE_FLAGS.map((name) => [name, name === "canAccessDashboard" ? ({ session }) => isStaff(session) : flag(name)])
);
function anyOf(...names) {
  return ({ session }) => isStaff(session) && names.some((name) => hasFlag(session, name));
}
var denyAll = () => false;
var allowAll = () => true;
function yardFilter(path2 = "yard") {
  const paths = Array.isArray(path2) ? path2 : [path2];
  return ({ session }) => {
    if (!isStaff(session)) return false;
    if (seesAllYards(session)) return true;
    const ids = sessionYardIds(session);
    const one = (p) => p.split(".").reduceRight((inner, key) => ({ [key]: inner }), { id: { in: ids } });
    return paths.length === 1 ? one(paths[0]) : { OR: paths.map(one) };
  };
}
function staffList({ read, create, update, delete: del, yard }) {
  const canRead = read || permissions.canAccessDashboard;
  const filter = yard ? yardFilter(yard) : void 0;
  return {
    operation: {
      query: canRead,
      create: create || denyAll,
      update: update || denyAll,
      delete: del || denyAll
    },
    ...filter ? { filter: { query: filter, update: filter, delete: filter } } : {}
  };
}
function appendOnlyList({ read, create, yard }) {
  return staffList({ read, create: create || denyAll, update: denyAll, delete: denyAll, yard });
}
var commandOnlyField = {
  access: { create: denyAll, update: denyAll },
  ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } }
};
var serverOnlyField = {
  access: { read: denyAll, create: denyAll, update: denyAll },
  ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } }
};
var rules = {
  canReadPeople: ({ session }) => {
    if (!session) return false;
    if (hasFlag(session, "canSeeOtherPeople") || hasFlag(session, "canManageStaff")) return true;
    return { id: { equals: session.itemId } };
  },
  canUpdatePeople: ({ session }) => {
    if (!session) return false;
    if (hasFlag(session, "canEditOtherPeople") || hasFlag(session, "canManageStaff")) return true;
    return { id: { equals: session.itemId } };
  }
};

// features/keystone/models/trackingFields.ts
var import_fields = require("@keystone-6/core/fields");
var trackingFields = {
  createdAt: (0, import_fields.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    validation: { isRequired: true },
    defaultValue: { kind: "now" },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  }),
  updatedAt: (0, import_fields.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    db: { updatedAt: true },
    validation: { isRequired: true },
    defaultValue: { kind: "now" },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  })
};

// features/keystone/models/people.ts
var canManageStaff = ({ session }) => permissions.canManageStaff({ session }) || permissions.canManagePeople({ session });
var User = (0, import_core.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: canManageStaff,
      update: isSignedIn,
      delete: canManageStaff
    },
    filter: {
      query: rules.canReadPeople,
      update: rules.canUpdatePeople
    }
  },
  ui: {
    hideCreate: (args) => !canManageStaff(args),
    hideDelete: (args) => !canManageStaff(args),
    listView: { initialColumns: ["name", "email", "role", "yards"] }
  },
  fields: {
    name: (0, import_fields2.text)({ validation: { isRequired: true } }),
    email: (0, import_fields2.text)({ isFilterable: false, isOrderable: false, isIndexed: "unique", validation: { isRequired: true } }),
    password: (0, import_fields2.password)({
      access: {
        read: denyAll,
        update: ({ session, item }) => canManageStaff({ session }) || session?.itemId === item.id
      },
      validation: { isRequired: true }
    }),
    phone: (0, import_fields2.text)(),
    role: (0, import_fields2.relationship)({
      ref: "Role.assignedTo",
      access: { create: canManageStaff, update: canManageStaff },
      ui: { itemView: { fieldMode: (args) => canManageStaff(args) ? "edit" : "read" } }
    }),
    yards: (0, import_fields2.relationship)({
      ref: "Yard.staff",
      many: true,
      access: { create: canManageStaff, update: canManageStaff },
      ui: { itemView: { fieldMode: (args) => canManageStaff(args) ? "edit" : "read" } }
    }),
    sellerProfile: (0, import_fields2.relationship)({
      ref: "Seller.user",
      access: { create: denyAll, update: denyAll },
      ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } }
    }),
    accountContacts: (0, import_fields2.relationship)({
      ref: "AccountContact.user",
      many: true,
      access: { create: denyAll, update: denyAll },
      ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } }
    }),
    ...trackingFields
  }
});
var Role = (0, import_core.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: permissions.canManageRoles,
      update: permissions.canManageRoles,
      delete: permissions.canManageRoles
    }
  },
  ui: {
    hideCreate: (args) => !permissions.canManageRoles(args),
    hideDelete: (args) => !permissions.canManageRoles(args),
    listView: { initialColumns: ["name", "assignedTo"] },
    itemView: { defaultFieldMode: (args) => permissions.canManageRoles(args) ? "edit" : "read" }
  },
  fields: {
    name: (0, import_fields2.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    ...Object.fromEntries(ROLE_FLAGS.map((flag2) => [flag2, (0, import_fields2.checkbox)({ defaultValue: false })])),
    assignedTo: (0, import_fields2.relationship)({ ref: "User.role", many: true, ui: { itemView: { fieldMode: "read" } } }),
    ...trackingFields
  }
});

// features/keystone/models/business.ts
var import_core2 = require("@keystone-6/core");

// features/keystone/models/shared.ts
var import_fields3 = require("@keystone-6/core/fields");
var commandOnlyFieldText = commandOnlyField;
var staffRead = { access: { read: ({ session }) => isStaff(session) } };
var opts = (...values) => values.map((value) => ({ value, label: value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) }));
function status(values, defaultValue) {
  return (0, import_fields3.select)({
    type: "string",
    options: opts(...values),
    defaultValue,
    validation: { isRequired: true },
    isIndexed: true,
    ...commandOnlyField
  });
}
function choice(values, defaultValue, extra = {}) {
  return (0, import_fields3.select)({
    type: "string",
    options: opts(...values),
    ...defaultValue ? { defaultValue } : {},
    ...defaultValue ? { validation: { isRequired: true } } : {},
    ...extra
  });
}
var weight = (extra = {}) => (0, import_fields3.decimal)({ precision: 14, scale: 2, ...extra });
var unitPrice = (extra = {}) => (0, import_fields3.decimal)({ precision: 14, scale: 5, ...extra });
var commandCents = () => (0, import_fields3.integer)({ defaultValue: 0, validation: { isRequired: true }, ...commandOnlyField });
var commandJson = (extra = {}) => (0, import_fields3.json)({ ...commandOnlyField, ...extra });
var commandWeight = () => (0, import_fields3.decimal)({ precision: 14, scale: 2, defaultValue: "0", validation: { isRequired: true }, ...commandOnlyField });
var addressFields = () => ({
  addressLine1: (0, import_fields3.text)(),
  addressLine2: (0, import_fields3.text)(),
  city: (0, import_fields3.text)(),
  region: (0, import_fields3.text)(),
  postalCode: (0, import_fields3.text)(),
  country: (0, import_fields3.text)({ defaultValue: "US" })
});

// features/keystone/models/business.ts
var BusinessSettings = (0, import_core2.list)({
  isSingleton: true,
  graphql: { plural: "BusinessSettingsItems" },
  access: {
    operation: {
      query: permissions.canAccessDashboard,
      create: permissions.canManageSettings,
      update: permissions.canManageSettings,
      delete: denyAll
    }
  },
  fields: {
    name: (0, import_fields3.text)({ validation: { isRequired: true }, defaultValue: "Recycling" }),
    legalName: (0, import_fields3.text)(),
    logo: (0, import_fields3.image)({ storage: "my_images" }),
    weightUnit: choice(["lb", "kg"], "lb"),
    currencyCode: (0, import_fields3.text)({ defaultValue: "USD", validation: { isRequired: true } }),
    timezone: (0, import_fields3.text)({ defaultValue: "America/New_York", validation: { isRequired: true } }),
    isNonprofit: (0, import_fields3.checkbox)({ defaultValue: false }),
    ein: (0, import_fields3.text)(),
    supportEmail: (0, import_fields3.text)(),
    supportPhone: (0, import_fields3.text)(),
    about: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    marketVisibility: choice(["buyers_only", "public_without_prices", "public"], "public_without_prices"),
    storefrontTheme: (0, import_fields3.json)(),
    onboardingStatus: choice(["not_started", "in_progress", "completed"], "not_started"),
    ...trackingFields
  }
});
var publicYardFilter = ({ session }) => isStaff(session) ? true : { status: { equals: "active" } };
var Yard = (0, import_core2.list)({
  access: {
    operation: { query: allowAll, create: permissions.canManageSettings, update: permissions.canManageSettings, delete: permissions.canManageSettings },
    filter: { query: publicYardFilter }
  },
  ui: { labelField: "name", listView: { initialColumns: ["name", "slug", "status", "city"] } },
  fields: {
    name: (0, import_fields3.text)({ validation: { isRequired: true } }),
    code: (0, import_fields3.text)({ validation: { isRequired: true }, isIndexed: "unique", defaultValue: "MAIN", ui: { description: "Short code printed on ticket numbers, for example MAIN." } }),
    slug: (0, import_fields3.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    status: choice(["active", "closed"], "active"),
    ...addressFields(),
    latitude: (0, import_fields3.decimal)({ precision: 9, scale: 6 }),
    longitude: (0, import_fields3.decimal)({ precision: 9, scale: 6 }),
    phone: (0, import_fields3.text)(),
    email: (0, import_fields3.text)(),
    timezone: (0, import_fields3.text)({ defaultValue: "America/New_York" }),
    hours: (0, import_fields3.json)({ ui: { description: 'Per weekday open and close, e.g. {"mon":{"open":"07:00","close":"16:30"}}' } }),
    closures: (0, import_fields3.relationship)({ ref: "YardClosure.yard", many: true }),
    acceptsPublic: (0, import_fields3.checkbox)({ defaultValue: true }),
    scaleTypes: (0, import_fields3.json)(),
    publicNotes: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    payoutMethods: (0, import_fields3.json)({ defaultValue: ["cash", "check", "transfer"] }),
    rulesProfile: (0, import_fields3.relationship)({ ref: "RulesProfile", ...staffRead }),
    boardPriceList: (0, import_fields3.relationship)({ ref: "PriceList" }),
    feeTaxRatePercent: (0, import_fields3.decimal)({ precision: 6, scale: 3, defaultValue: "0", validation: { isRequired: true } }),
    scales: (0, import_fields3.relationship)({ ref: "Scale.yard", many: true, ...staffRead }),
    drawers: (0, import_fields3.relationship)({ ref: "CashDrawer.yard", many: true, ...staffRead }),
    staff: (0, import_fields3.relationship)({ ref: "User.yards", many: true, ...staffRead }),
    ...trackingFields
  }
});
var YardClosure = (0, import_core2.list)({
  access: {
    operation: { query: allowAll, create: permissions.canManageSettings, update: permissions.canManageSettings, delete: permissions.canManageSettings }
  },
  fields: {
    yard: (0, import_fields3.relationship)({ ref: "Yard.closures" }),
    date: (0, import_fields3.timestamp)({ validation: { isRequired: true } }),
    reason: (0, import_fields3.text)(),
    isPartial: (0, import_fields3.checkbox)({ defaultValue: false }),
    openTime: (0, import_fields3.text)(),
    closeTime: (0, import_fields3.text)(),
    ...trackingFields
  }
});
var Scale = (0, import_core2.list)({
  access: staffList({ create: permissions.canManageSettings, update: permissions.canManageSettings, delete: permissions.canManageSettings, yard: "yard" }),
  fields: {
    yard: (0, import_fields3.relationship)({ ref: "Yard.scales" }),
    name: (0, import_fields3.text)({ validation: { isRequired: true } }),
    kind: choice(["truck", "floor", "bench"], "truck"),
    apiKeyHash: (0, import_fields3.text)({ ...serverOnlyField, isIndexed: "unique" }),
    lastReadingWeight: (0, import_fields3.decimal)({ precision: 14, scale: 2, ...commandOnlyFieldText }),
    lastReadingAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    lastReadingStable: (0, import_fields3.checkbox)({ defaultValue: false, ...commandOnlyFieldText }),
    isActive: (0, import_fields3.checkbox)({ defaultValue: true }),
    ...trackingFields
  }
});
var Sequence = (0, import_core2.list)({
  access: staffList({ read: permissions.canManageSettings, create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    yard: (0, import_fields3.relationship)({ ref: "Yard", ...commandOnlyFieldText }),
    scopeKey: (0, import_fields3.text)({ validation: { isRequired: true }, ...commandOnlyFieldText, ui: { description: 'Yard id, or "business" for business-wide numbers.' } }),
    kind: choice(
      ["inbound_ticket", "outbound_ticket", "invoice", "settlement", "unit_tag", "sales_order", "job", "shipment", "service_request", "receipt", "account"],
      "inbound_ticket",
      commandOnlyFieldText
    ),
    next: (0, import_fields3.integer)({ defaultValue: 1, validation: { isRequired: true }, ...commandOnlyFieldText }),
    ...trackingFields
  }
});

// features/keystone/models/catalog.ts
var import_core3 = require("@keystone-6/core");
var UNITS = ["lb", "cwt", "net_ton", "gross_ton", "kg", "metric_tonne", "each"];
var publicOrStaff = (field) => ({ session }) => isStaff(session) ? true : { [field]: { equals: true } };
var MaterialCategory = (0, import_core3.list)({
  access: {
    operation: { query: allowAll, create: permissions.canManageMaterials, update: permissions.canManageMaterials, delete: permissions.canManageMaterials }
  },
  fields: {
    name: (0, import_fields3.text)({ validation: { isRequired: true } }),
    slug: (0, import_fields3.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    kind: choice(["ferrous", "non_ferrous", "electronics", "paper", "plastic", "glass", "other"], "non_ferrous"),
    sortOrder: (0, import_fields3.integer)({ defaultValue: 0 }),
    image: (0, import_fields3.image)({ storage: "my_images" }),
    materials: (0, import_fields3.relationship)({ ref: "Material.category", many: true }),
    ...trackingFields
  }
});
var Material = (0, import_core3.list)({
  access: {
    operation: { query: allowAll, create: permissions.canManageMaterials, update: permissions.canManageMaterials, delete: permissions.canManageMaterials },
    filter: { query: publicOrStaff("isPublic") }
  },
  ui: { listView: { initialColumns: ["name", "code", "category", "defaultUnit", "direction", "isPublic"] } },
  fields: {
    name: (0, import_fields3.text)({ validation: { isRequired: true } }),
    slug: (0, import_fields3.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    code: (0, import_fields3.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    category: (0, import_fields3.relationship)({ ref: "MaterialCategory.materials" }),
    specName: (0, import_fields3.text)(),
    description: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    preparationTips: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    image: (0, import_fields3.image)({ storage: "my_images" }),
    images: (0, import_fields3.json)(),
    defaultUnit: choice([...UNITS], "lb"),
    direction: choice(["pay_seller", "charge_customer"], "pay_seller"),
    isPublic: (0, import_fields3.checkbox)({ defaultValue: true }),
    isActive: (0, import_fields3.checkbox)({ defaultValue: true }),
    acceptsFromPublic: (0, import_fields3.checkbox)({ defaultValue: true }),
    sortOrder: (0, import_fields3.integer)({ defaultValue: 0 }),
    minimumWeight: weight(),
    standardContainerTare: weight(),
    ...trackingFields
  }
});
var PriceList = (0, import_core3.list)({
  access: {
    operation: { query: permissions.canAccessDashboard, create: permissions.canManagePricing, update: permissions.canManagePricing, delete: denyAll }
  },
  fields: {
    name: (0, import_fields3.text)({ validation: { isRequired: true } }),
    kind: choice(["board", "tier", "contract", "sell"], "board"),
    yard: (0, import_fields3.relationship)({ ref: "Yard" }),
    isActive: (0, import_fields3.checkbox)({ defaultValue: true }),
    accounts: (0, import_fields3.relationship)({ ref: "Account.priceList", many: true }),
    entries: (0, import_fields3.relationship)({ ref: "PriceEntry.priceList", many: true, ui: { itemView: { fieldMode: "read" } } }),
    ...trackingFields
  }
});
var PriceEntry = (0, import_core3.list)({
  access: appendOnlyList({ read: permissions.canAccessDashboard }),
  fields: {
    priceList: (0, import_fields3.relationship)({ ref: "PriceList.entries", ...commandOnlyFieldText }),
    material: (0, import_fields3.relationship)({ ref: "Material", ...commandOnlyFieldText }),
    unit: choice([...UNITS], "lb", commandOnlyFieldText),
    unitPrice: unitPrice({ validation: { isRequired: true }, defaultValue: "0", ...commandOnlyFieldText }),
    unitPriceHigh: unitPrice(commandOnlyFieldText),
    isPublic: (0, import_fields3.checkbox)({ defaultValue: true, ...commandOnlyFieldText }),
    effectiveFrom: (0, import_fields3.timestamp)({ validation: { isRequired: true }, defaultValue: { kind: "now" }, ...commandOnlyFieldText }),
    effectiveTo: (0, import_fields3.timestamp)(commandOnlyFieldText),
    publishedBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    ...trackingFields
  }
});

// features/keystone/models/parties.ts
var import_core4 = require("@keystone-6/core");
var sellerStaff = anyOf("canManageSellers", "canManageTickets");
var accountStaff = permissions.canManageAccounts;
var Seller = (0, import_core4.list)({
  access: staffList({ create: sellerStaff, update: sellerStaff, delete: denyAll }),
  ui: { labelField: "lastName", listView: { initialColumns: ["firstName", "lastName", "phone", "status", "idVerification"] } },
  fields: {
    user: (0, import_fields3.relationship)({ ref: "User.sellerProfile", isFilterable: true }),
    firstName: (0, import_fields3.text)({ validation: { isRequired: true } }),
    lastName: (0, import_fields3.text)({ validation: { isRequired: true } }),
    searchName: (0, import_fields3.text)({ ...commandOnlyFieldText, isIndexed: true, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } } }),
    dateOfBirth: (0, import_fields3.timestamp)(),
    phone: (0, import_fields3.text)({ isIndexed: true }),
    email: (0, import_fields3.text)(),
    ...addressFields(),
    status: status(["active", "flagged", "do_not_buy"], "active"),
    statusReason: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    idVerification: status(["unverified", "verified", "expired"], "unverified"),
    preferredPayout: choice(["cash", "check", "transfer"], "cash"),
    priceList: (0, import_fields3.relationship)({ ref: "PriceList" }),
    defaultNonprofit: (0, import_fields3.relationship)({ ref: "Account" }),
    notes: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    identityDocuments: (0, import_fields3.relationship)({ ref: "IdentityDocument.seller", many: true }),
    vehicles: (0, import_fields3.relationship)({ ref: "Vehicle.seller", many: true }),
    tickets: (0, import_fields3.relationship)({ ref: "ScaleTicket.seller", many: true, ui: { itemView: { fieldMode: "read" } } }),
    ...trackingFields
  },
  hooks: {
    resolveInput: ({ resolvedData, item }) => {
      const first = resolvedData.firstName ?? item?.firstName;
      const last = resolvedData.lastName ?? item?.lastName;
      if (resolvedData.firstName !== void 0 || resolvedData.lastName !== void 0) {
        resolvedData.searchName = `${first || ""} ${last || ""}`.trim().toLowerCase();
      }
      return resolvedData;
    }
  }
});
var IdentityDocument = (0, import_core4.list)({
  access: staffList({ read: sellerStaff, create: sellerStaff, update: sellerStaff, delete: denyAll }),
  fields: {
    seller: (0, import_fields3.relationship)({ ref: "Seller.identityDocuments" }),
    kind: choice(["drivers_license", "state_id", "passport", "military_id", "other"], "drivers_license"),
    number: (0, import_fields3.text)({ validation: { isRequired: true } }),
    numberNormalized: (0, import_fields3.text)({ ...serverOnlyField, isIndexed: true }),
    issuer: (0, import_fields3.text)(),
    expiresOn: (0, import_fields3.timestamp)(),
    frontImage: (0, import_fields3.image)({ storage: "private_images" }),
    backImage: (0, import_fields3.image)({ storage: "private_images" }),
    thumbprintImage: (0, import_fields3.image)({ storage: "private_images" }),
    verifiedBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    verifiedAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    isCurrent: (0, import_fields3.checkbox)({ defaultValue: true }),
    ...trackingFields
  },
  hooks: {
    resolveInput: ({ resolvedData }) => {
      if (typeof resolvedData.number === "string") resolvedData.numberNormalized = resolvedData.number.replace(/[^a-z0-9]/gi, "").toUpperCase();
      return resolvedData;
    }
  }
});
var Vehicle = (0, import_core4.list)({
  access: staffList({ create: sellerStaff, update: sellerStaff, delete: sellerStaff }),
  ui: { labelField: "plate" },
  fields: {
    seller: (0, import_fields3.relationship)({ ref: "Seller.vehicles" }),
    account: (0, import_fields3.relationship)({ ref: "Account.vehicles" }),
    plate: (0, import_fields3.text)({ isIndexed: true }),
    plateRegion: (0, import_fields3.text)(),
    make: (0, import_fields3.text)(),
    model: (0, import_fields3.text)(),
    color: (0, import_fields3.text)(),
    kind: choice(["car", "pickup", "box_truck", "trailer", "roll_off", "semi", "other"], "pickup"),
    storedTare: weight(),
    storedTareExpiresOn: (0, import_fields3.timestamp)(),
    isRemoved: (0, import_fields3.checkbox)({ defaultValue: false }),
    ...trackingFields
  },
  hooks: {
    resolveInput: ({ resolvedData }) => {
      if (typeof resolvedData.plate === "string") resolvedData.plate = resolvedData.plate.replace(/\s+/g, "").toUpperCase();
      return resolvedData;
    }
  }
});
var Account = (0, import_core4.list)({
  access: staffList({ create: accountStaff, update: accountStaff, delete: denyAll }),
  ui: { listView: { initialColumns: ["name", "accountNumber", "status", "isSupplier", "isBuyer", "isNonprofit"] } },
  fields: {
    name: (0, import_fields3.text)({ validation: { isRequired: true } }),
    legalName: (0, import_fields3.text)(),
    slug: (0, import_fields3.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    accountNumber: (0, import_fields3.text)({ isIndexed: "unique", ...commandOnlyFieldText }),
    status: status(["active", "suspended"], "active"),
    statusReason: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    isSupplier: (0, import_fields3.checkbox)({ defaultValue: false }),
    isBuyer: (0, import_fields3.checkbox)({ defaultValue: false }),
    isNonprofit: (0, import_fields3.checkbox)({ defaultValue: false }),
    taxId: (0, import_fields3.text)(),
    ein: (0, import_fields3.text)(),
    billingAddressLine1: (0, import_fields3.text)(),
    billingAddressLine2: (0, import_fields3.text)(),
    billingCity: (0, import_fields3.text)(),
    billingRegion: (0, import_fields3.text)(),
    billingPostalCode: (0, import_fields3.text)(),
    billingCountry: (0, import_fields3.text)({ defaultValue: "US" }),
    billingEmail: (0, import_fields3.text)(),
    phone: (0, import_fields3.text)(),
    paymentTerms: choice(["pay_at_scale", "on_account", "prepay", "net"], "pay_at_scale"),
    netDays: (0, import_fields3.integer)({ defaultValue: 0 }),
    settlementCycle: choice(["weekly", "semi_monthly", "monthly"], "monthly"),
    weightBasis: choice(["shipped", "received"], "shipped"),
    hasCredit: (0, import_fields3.checkbox)({ defaultValue: false }),
    priceList: (0, import_fields3.relationship)({ ref: "PriceList.accounts" }),
    nonprofitSummary: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    nonprofitWebsite: (0, import_fields3.text)(),
    nonprofitLogo: (0, import_fields3.image)({ storage: "my_images" }),
    isPublicNonprofit: (0, import_fields3.checkbox)({ defaultValue: false }),
    contacts: (0, import_fields3.relationship)({ ref: "AccountContact.account", many: true }),
    sites: (0, import_fields3.relationship)({ ref: "ServiceSite.account", many: true }),
    documents: (0, import_fields3.relationship)({ ref: "AccountDocument.account", many: true }),
    vehicles: (0, import_fields3.relationship)({ ref: "Vehicle.account", many: true }),
    notes: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    ...trackingFields
  }
});
var AccountContact = (0, import_core4.list)({
  access: staffList({ create: accountStaff, update: accountStaff, delete: denyAll }),
  fields: {
    account: (0, import_fields3.relationship)({ ref: "Account.contacts" }),
    user: (0, import_fields3.relationship)({ ref: "User.accountContacts" }),
    role: choice(["admin", "member", "billing", "driver"], "member"),
    status: status(["active", "invited", "removed"], "active"),
    inviteEmail: (0, import_fields3.text)(),
    inviteTokenHash: (0, import_fields3.text)({ ...serverOnlyField, isIndexed: "unique" }),
    ...trackingFields
  }
});
var AccountApplication = (0, import_core4.list)({
  access: staffList({ read: accountStaff, create: denyAll, update: accountStaff, delete: denyAll }),
  ui: { labelField: "businessName" },
  fields: {
    applicant: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    kind: choice(["supplier", "buyer", "nonprofit"], "supplier", commandOnlyFieldText),
    businessName: (0, import_fields3.text)({ validation: { isRequired: true } }),
    legalName: (0, import_fields3.text)(),
    taxId: (0, import_fields3.text)(),
    ...addressFields(),
    phone: (0, import_fields3.text)(),
    email: (0, import_fields3.text)(),
    materials: (0, import_fields3.json)(),
    monthlyVolume: (0, import_fields3.text)(),
    containerNeeds: (0, import_fields3.text)(),
    message: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    w9: (0, import_fields3.file)({ storage: "private_files" }),
    status: status(["submitted", "approved", "declined", "withdrawn"], "submitted"),
    decisionReason: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    decidedBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    decidedAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    account: (0, import_fields3.relationship)({ ref: "Account", ...commandOnlyFieldText }),
    ...trackingFields
  }
});
var AccountDocument = (0, import_core4.list)({
  access: staffList({ create: anyOf("canManageAccounts", "canManageFinance"), update: anyOf("canManageAccounts", "canManageFinance"), delete: accountStaff }),
  fields: {
    account: (0, import_fields3.relationship)({ ref: "Account.documents" }),
    ticket: (0, import_fields3.relationship)({ ref: "ScaleTicket" }),
    kind: choice(["w9", "licence", "insurance", "contract", "certificate", "other"], "other"),
    file: (0, import_fields3.file)({ storage: "private_files" }),
    title: (0, import_fields3.text)({ validation: { isRequired: true } }),
    body: (0, import_fields3.text)({ ui: { displayMode: "textarea" }, ...commandOnlyFieldText }),
    visibleToAccount: (0, import_fields3.checkbox)({ defaultValue: true }),
    ...trackingFields
  }
});
var ServiceSite = (0, import_core4.list)({
  access: staffList({ create: anyOf("canManageAccounts", "canManageDispatch"), update: anyOf("canManageAccounts", "canManageDispatch"), delete: denyAll }),
  fields: {
    account: (0, import_fields3.relationship)({ ref: "Account.sites" }),
    seller: (0, import_fields3.relationship)({ ref: "Seller" }),
    name: (0, import_fields3.text)({ validation: { isRequired: true } }),
    ...addressFields(),
    contactName: (0, import_fields3.text)(),
    contactPhone: (0, import_fields3.text)(),
    accessNotes: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    latitude: (0, import_fields3.decimal)({ precision: 9, scale: 6 }),
    longitude: (0, import_fields3.decimal)({ precision: 9, scale: 6 }),
    isActive: (0, import_fields3.checkbox)({ defaultValue: true }),
    ...trackingFields
  }
});

// features/keystone/models/tickets.ts
var import_core5 = require("@keystone-6/core");
var import_fields4 = require("@keystone-6/core/fields");
var ticketStaff = anyOf("canManageTickets", "canGradeTickets");
var Visit = (0, import_core5.list)({
  access: staffList({ read: anyOf("canManageTickets", "canManageSellers"), create: denyAll, update: denyAll, delete: denyAll, yard: "yard" }),
  ui: { labelField: "code" },
  fields: {
    seller: (0, import_fields3.relationship)({ ref: "Seller", ...commandOnlyFieldText }),
    yard: (0, import_fields3.relationship)({ ref: "Yard", ...commandOnlyFieldText }),
    plannedDate: (0, import_fields3.timestamp)({ validation: { isRequired: true }, ...commandOnlyFieldText }),
    vehicle: (0, import_fields3.relationship)({ ref: "Vehicle", ...commandOnlyFieldText }),
    expectedItems: (0, import_fields3.json)({ ...commandOnlyFieldText }),
    donatePercent: (0, import_fields3.integer)({ defaultValue: 0, ...commandOnlyFieldText }),
    nonprofit: (0, import_fields3.relationship)({ ref: "Account", ...commandOnlyFieldText }),
    campaign: (0, import_fields3.relationship)({ ref: "DonationCampaign", ...commandOnlyFieldText }),
    code: (0, import_fields3.text)({ isIndexed: "unique", ...commandOnlyFieldText }),
    status: status(["booked", "arrived", "cancelled", "expired"], "booked"),
    ticket: (0, import_fields3.relationship)({ ref: "ScaleTicket.visit", ...commandOnlyFieldText }),
    ...trackingFields
  }
});
var ScaleTicket = (0, import_core5.list)({
  access: staffList({
    read: permissions.canAccessDashboard,
    create: denyAll,
    update: ticketStaff,
    // notes only; every other field is command-owned
    delete: denyAll,
    yard: "yard"
  }),
  ui: {
    labelField: "lookupCode",
    listView: { initialColumns: ["displayNumber", "yard", "direction", "status", "seller", "account", "totalCents", "completedAt"] }
  },
  fields: {
    yard: (0, import_fields3.relationship)({ ref: "Yard", ...commandOnlyFieldText }),
    direction: choice(["inbound", "outbound"], "inbound", commandOnlyFieldText),
    number: (0, import_fields3.integer)({ validation: { isRequired: true }, ...commandOnlyFieldText }),
    displayNumber: (0, import_fields4.virtual)({
      field: import_core5.graphql.field({
        type: import_core5.graphql.String,
        async resolve(item, _args, context) {
          const yard = item.yardId ? await context.sudo().db.Yard.findOne({ where: { id: item.yardId } }) : null;
          return formatTicketNumber(yard?.code || "YARD", item.direction, item.number);
        }
      })
    }),
    status: status(["open", "completed", "settled", "voided"], "open"),
    seller: (0, import_fields3.relationship)({ ref: "Seller.tickets", ...commandOnlyFieldText }),
    account: (0, import_fields3.relationship)({ ref: "Account", ...commandOnlyFieldText }),
    site: (0, import_fields3.relationship)({ ref: "ServiceSite", ...commandOnlyFieldText }),
    vehicle: (0, import_fields3.relationship)({ ref: "Vehicle", ...commandOnlyFieldText }),
    vehiclePlate: (0, import_fields3.text)({ ...commandOnlyFieldText, isIndexed: true }),
    vehiclePlateRegion: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    vehicleDescription: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    visit: (0, import_fields3.relationship)({ ref: "Visit.ticket", ...commandOnlyFieldText }),
    job: (0, import_fields3.relationship)({ ref: "DispatchJob", ...commandOnlyFieldText }),
    container: (0, import_fields3.relationship)({ ref: "Container", ...commandOnlyFieldText }),
    shipment: (0, import_fields3.relationship)({ ref: "Shipment.ticket", ...commandOnlyFieldText }),
    adjusts: (0, import_fields3.relationship)({ ref: "ScaleTicket.adjustments", ...commandOnlyFieldText }),
    adjustments: (0, import_fields3.relationship)({ ref: "ScaleTicket.adjusts", many: true, ...commandOnlyFieldText }),
    isAdjustment: (0, import_fields3.checkbox)({ defaultValue: false, ...commandOnlyFieldText }),
    paymentMode: choice(["pay_now", "on_account", "donation_only", "customer_pays"], "pay_now", commandOnlyFieldText),
    lines: (0, import_fields3.relationship)({ ref: "TicketLine.ticket", many: true, ...commandOnlyFieldText }),
    weighEvents: (0, import_fields3.relationship)({ ref: "WeighEvent.ticket", many: true, ...commandOnlyFieldText }),
    attachments: (0, import_fields3.relationship)({ ref: "TicketAttachment.ticket", many: true, ...commandOnlyFieldText }),
    fees: (0, import_fields3.json)({ defaultValue: [], ...commandOnlyFieldText }),
    materialTotalCents: commandCents(),
    feeTotalCents: commandCents(),
    taxCents: commandCents(),
    totalCents: commandCents(),
    collectedCents: commandCents(),
    donatePercent: (0, import_fields3.integer)({ defaultValue: 0, ...commandOnlyFieldText }),
    nonprofit: (0, import_fields3.relationship)({ ref: "Account", ...commandOnlyFieldText }),
    campaign: (0, import_fields3.relationship)({ ref: "DonationCampaign", ...commandOnlyFieldText }),
    complianceSnapshot: commandJson(),
    overrideReason: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    overrideBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    lookupCode: (0, import_fields3.text)({ isIndexed: "unique", ...commandOnlyFieldText }),
    certificateRequested: (0, import_fields3.checkbox)({ defaultValue: false, ...commandOnlyFieldText }),
    openedBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    completedBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    completedAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    settledAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    voidedBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    voidedAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    voidReason: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    payouts: (0, import_fields3.relationship)({ ref: "Payout.ticket", many: true, ...commandOnlyFieldText }),
    holdTags: (0, import_fields3.relationship)({ ref: "HoldTag.ticket", many: true, ...commandOnlyFieldText }),
    settlement: (0, import_fields3.relationship)({ ref: "Settlement.tickets", ...commandOnlyFieldText }),
    notes: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    ...trackingFields
  }
});
function formatTicketNumber(yardCode, direction, number) {
  return `${yardCode}-${direction === "outbound" ? "O" : "I"}-${String(number ?? 0).padStart(6, "0")}`;
}
var TicketLine = (0, import_core5.list)({
  access: staffList({ create: denyAll, update: denyAll, delete: denyAll, yard: "ticket.yard" }),
  ui: { labelField: "materialName" },
  fields: {
    ticket: (0, import_fields3.relationship)({ ref: "ScaleTicket.lines", ...commandOnlyFieldText }),
    sortOrder: (0, import_fields3.integer)({ defaultValue: 0, ...commandOnlyFieldText }),
    material: (0, import_fields3.relationship)({ ref: "Material", ...commandOnlyFieldText }),
    materialName: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    direction: choice(["pay_seller", "charge_customer"], "pay_seller", commandOnlyFieldText),
    grossWeight: commandWeight(),
    tareWeight: commandWeight(),
    netWeight: commandWeight(),
    deductionWeight: weight({ ...commandOnlyFieldText }),
    deductionPercent: weight({ ...commandOnlyFieldText }),
    deductionReason: choice(["dirt", "moisture", "plastic", "attachments", "oil", "other"], void 0, commandOnlyFieldText),
    payWeight: commandWeight(),
    quantity: (0, import_fields3.integer)({ ...commandOnlyFieldText }),
    unit: choice([...UNITS], "lb", commandOnlyFieldText),
    unitPrice: unitPrice({ ...commandOnlyFieldText }),
    priceSource: choice(["contract", "price_list", "board", "override"], void 0, commandOnlyFieldText),
    priceEntry: (0, import_fields3.relationship)({ ref: "PriceEntry", ...commandOnlyFieldText }),
    overrideBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    overrideReason: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    amountCents: commandCents(),
    restriction: (0, import_fields3.relationship)({ ref: "MaterialRestriction", ...commandOnlyFieldText }),
    documents: (0, import_fields3.json)({ defaultValue: [], ...commandOnlyFieldText }),
    payout: (0, import_fields3.relationship)({ ref: "Payout.lines", ...commandOnlyFieldText }),
    inventoryUnit: (0, import_fields3.relationship)({ ref: "InventoryUnit", ...commandOnlyFieldText }),
    ...trackingFields
  }
});
var WeighEvent = (0, import_core5.list)({
  access: appendOnlyList({ yard: "ticket.yard" }),
  fields: {
    ticket: (0, import_fields3.relationship)({ ref: "ScaleTicket.weighEvents", ...commandOnlyFieldText }),
    line: (0, import_fields3.relationship)({ ref: "TicketLine", ...commandOnlyFieldText }),
    scale: (0, import_fields3.relationship)({ ref: "Scale", ...commandOnlyFieldText }),
    kind: choice(["gross", "tare", "sequential"], "gross", commandOnlyFieldText),
    weight: commandWeight(),
    captureMethod: choice(["scale", "manual"], "manual", commandOnlyFieldText),
    capturedBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    capturedAt: (0, import_fields3.timestamp)({ defaultValue: { kind: "now" }, ...commandOnlyFieldText }),
    photo: (0, import_fields3.image)({ storage: "private_images", ...commandOnlyFieldText }),
    ...trackingFields
  }
});
var TicketAttachment = (0, import_core5.list)({
  access: {
    ...staffList({ create: ticketStaff, update: denyAll, delete: denyAll, yard: "ticket.yard" }),
    item: {
      create: async ({ inputData, context }) => {
        const ticketId = inputData?.ticket?.connect?.id;
        if (!ticketId) return false;
        const ticket = await context.sudo().db.ScaleTicket.findOne({ where: { id: ticketId } });
        return ticket?.status === "open";
      }
    }
  },
  fields: {
    ticket: (0, import_fields3.relationship)({ ref: "ScaleTicket.attachments" }),
    line: (0, import_fields3.relationship)({ ref: "TicketLine" }),
    kind: choice(["seller_photo", "material_photo", "vehicle_photo", "signature", "thumbprint", "ownership_document", "bol", "other"], "material_photo"),
    image: (0, import_fields3.image)({ storage: "private_images" }),
    file: (0, import_fields3.file)({ storage: "private_files" }),
    signedName: (0, import_fields3.text)(),
    capturedBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    capturedAt: (0, import_fields3.timestamp)({ defaultValue: { kind: "now" }, ...commandOnlyFieldText }),
    ...trackingFields
  },
  hooks: {
    resolveInput: ({ resolvedData, context, operation }) => {
      if (operation === "create" && context.session?.itemId) resolvedData.capturedBy = { connect: { id: context.session.itemId } };
      return resolvedData;
    }
  }
});

// features/keystone/models/money.ts
var import_core6 = require("@keystone-6/core");
var cashStaff = anyOf("canPaySellers", "canManageCashDrawers");
var financeStaff = permissions.canManageFinance;
var Payout = (0, import_core6.list)({
  access: staffList({ read: anyOf("canPaySellers", "canManageFinance", "canManageTickets", "canViewReports"), create: denyAll, update: denyAll, delete: denyAll, yard: "ticket.yard" }),
  fields: {
    ticket: (0, import_fields3.relationship)({ ref: "ScaleTicket.payouts", ...commandOnlyFieldText }),
    lines: (0, import_fields3.relationship)({ ref: "TicketLine.payout", many: true, ...commandOnlyFieldText }),
    settlement: (0, import_fields3.relationship)({ ref: "Settlement", ...commandOnlyFieldText }),
    seller: (0, import_fields3.relationship)({ ref: "Seller", ...commandOnlyFieldText }),
    account: (0, import_fields3.relationship)({ ref: "Account", ...commandOnlyFieldText }),
    amountCents: commandCents(),
    status: status(["pending", "held", "ready", "paid", "cancelled", "returned"], "pending"),
    allowedMethods: commandJson({ defaultValue: ["cash", "check", "transfer"] }),
    method: choice(["cash", "check", "transfer"], void 0, commandOnlyFieldText),
    releaseAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    checkNumber: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    bankAccountLabel: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    transferReference: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    mailToAddress: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    paidBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    paidAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    drawerSession: (0, import_fields3.relationship)({ ref: "CashDrawerSession", ...commandOnlyFieldText }),
    replaces: (0, import_fields3.relationship)({ ref: "Payout", ...commandOnlyFieldText }),
    returnReason: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    cancelReason: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    idempotencyKeyHash: (0, import_fields3.text)({ ...serverOnlyField, isIndexed: "unique" }),
    ...trackingFields
  }
});
var CashDrawer = (0, import_core6.list)({
  access: staffList({ create: permissions.canManageSettings, update: permissions.canManageSettings, delete: denyAll, yard: "yard" }),
  fields: {
    yard: (0, import_fields3.relationship)({ ref: "Yard.drawers" }),
    name: (0, import_fields3.text)({ validation: { isRequired: true } }),
    isActive: (0, import_fields3.checkbox)({ defaultValue: true }),
    sessions: (0, import_fields3.relationship)({ ref: "CashDrawerSession.drawer", many: true, ui: { itemView: { fieldMode: "read" } } }),
    ...trackingFields
  }
});
var CashDrawerSession = (0, import_core6.list)({
  access: staffList({ read: anyOf("canPaySellers", "canManageCashDrawers", "canApproveVariances", "canManageFinance"), create: denyAll, update: denyAll, delete: denyAll, yard: "drawer.yard" }),
  fields: {
    drawer: (0, import_fields3.relationship)({ ref: "CashDrawer.sessions", ...commandOnlyFieldText }),
    cashier: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    status: status(["open", "counting", "closed"], "open"),
    openingFloatCents: commandCents(),
    expectedCents: commandCents(),
    countedCents: (0, import_fields3.integer)({ ...commandOnlyFieldText }),
    varianceCents: (0, import_fields3.integer)({ ...commandOnlyFieldText }),
    openedAt: (0, import_fields3.timestamp)({ defaultValue: { kind: "now" }, ...commandOnlyFieldText }),
    closedAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    approvedBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    approvalNote: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    events: (0, import_fields3.relationship)({ ref: "CashDrawerEvent.session", many: true, ...commandOnlyFieldText }),
    ...trackingFields
  }
});
var CashDrawerEvent = (0, import_core6.list)({
  access: appendOnlyList({ read: cashStaff, yard: "session.drawer.yard" }),
  fields: {
    session: (0, import_fields3.relationship)({ ref: "CashDrawerSession.events", ...commandOnlyFieldText }),
    kind: choice(["open", "payout", "collect", "add", "drop"], "add", commandOnlyFieldText),
    amountCents: commandCents(),
    payout: (0, import_fields3.relationship)({ ref: "Payout", ...commandOnlyFieldText }),
    ticket: (0, import_fields3.relationship)({ ref: "ScaleTicket", ...commandOnlyFieldText }),
    note: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    referenceKey: (0, import_fields3.text)({ isIndexed: "unique", validation: { isRequired: true }, ...commandOnlyFieldText }),
    createdBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    ...trackingFields
  }
});
var AccountCharge = (0, import_core6.list)({
  access: staffList({ read: anyOf("canManageFinance", "canManageAccounts", "canManageDispatch"), create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    account: (0, import_fields3.relationship)({ ref: "Account", ...commandOnlyFieldText }),
    kind: choice(["delivery", "haul", "rental", "dry_run", "processing", "other"], "other", commandOnlyFieldText),
    description: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    amountCents: commandCents(),
    job: (0, import_fields3.relationship)({ ref: "DispatchJob", ...commandOnlyFieldText }),
    container: (0, import_fields3.relationship)({ ref: "Container", ...commandOnlyFieldText }),
    serviceDate: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    referenceKey: (0, import_fields3.text)({ isIndexed: "unique", ...commandOnlyFieldText }),
    settlement: (0, import_fields3.relationship)({ ref: "Settlement.charges", ...commandOnlyFieldText }),
    invoiceLine: (0, import_fields3.relationship)({ ref: "InvoiceLine", ...commandOnlyFieldText }),
    status: status(["open", "settled", "invoiced", "waived"], "open"),
    ...trackingFields
  }
});
var Settlement = (0, import_core6.list)({
  access: staffList({ read: anyOf("canManageFinance", "canManageAccounts"), create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    account: (0, import_fields3.relationship)({ ref: "Account", ...commandOnlyFieldText }),
    number: (0, import_fields3.integer)({ ...commandOnlyFieldText }),
    status: status(["draft", "approved", "paid", "void"], "draft"),
    periodStart: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    periodEnd: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    tickets: (0, import_fields3.relationship)({ ref: "ScaleTicket.settlement", many: true, ...commandOnlyFieldText }),
    charges: (0, import_fields3.relationship)({ ref: "AccountCharge.settlement", many: true, ...commandOnlyFieldText }),
    donations: (0, import_fields3.relationship)({ ref: "Donation.settlement", many: true, ...commandOnlyFieldText }),
    ticketTotalCents: commandCents(),
    chargeTotalCents: commandCents(),
    donationTotalCents: commandCents(),
    netCents: commandCents(),
    payout: (0, import_fields3.relationship)({ ref: "Payout", ...commandOnlyFieldText }),
    invoice: (0, import_fields3.relationship)({ ref: "Invoice", ...commandOnlyFieldText }),
    approvedBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    approvedAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    paidAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    voidReason: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    ...trackingFields
  }
});
var Invoice = (0, import_core6.list)({
  access: staffList({ read: anyOf("canManageFinance", "canManageSales", "canManageAccounts", "canManageDispatch"), create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    number: (0, import_fields3.integer)({ ...commandOnlyFieldText }),
    account: (0, import_fields3.relationship)({ ref: "Account", ...commandOnlyFieldText }),
    seller: (0, import_fields3.relationship)({ ref: "Seller", ...commandOnlyFieldText }),
    kind: choice(["sale", "settlement_balance", "service", "fee_ticket"], "sale", commandOnlyFieldText),
    status: status(["open", "partially_paid", "paid", "void"], "open"),
    lines: (0, import_fields3.relationship)({ ref: "InvoiceLine.invoice", many: true, ...commandOnlyFieldText }),
    subtotalCents: commandCents(),
    taxCents: commandCents(),
    totalCents: commandCents(),
    paidCents: commandCents(),
    refundedCents: commandCents(),
    dueOn: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    shipment: (0, import_fields3.relationship)({ ref: "Shipment", ...commandOnlyFieldText }),
    settlement: (0, import_fields3.relationship)({ ref: "Settlement", ...commandOnlyFieldText }),
    serviceRequest: (0, import_fields3.relationship)({ ref: "ServiceRequest", ...commandOnlyFieldText }),
    ticket: (0, import_fields3.relationship)({ ref: "ScaleTicket", ...commandOnlyFieldText }),
    payments: (0, import_fields3.relationship)({ ref: "Payment.invoice", many: true, ...commandOnlyFieldText }),
    voidReason: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    ...trackingFields
  }
});
var InvoiceLine = (0, import_core6.list)({
  access: staffList({ read: anyOf("canManageFinance", "canManageSales", "canManageAccounts"), create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    invoice: (0, import_fields3.relationship)({ ref: "Invoice.lines", ...commandOnlyFieldText }),
    description: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    material: (0, import_fields3.relationship)({ ref: "Material", ...commandOnlyFieldText }),
    weight: weight({ ...commandOnlyFieldText }),
    unit: choice([...UNITS], void 0, commandOnlyFieldText),
    unitPrice: unitPrice({ ...commandOnlyFieldText }),
    amountCents: commandCents(),
    kind: choice(["material", "freight", "fee", "adjustment", "credit"], "material", commandOnlyFieldText),
    claim: (0, import_fields3.relationship)({ ref: "Claim", ...commandOnlyFieldText }),
    ...trackingFields
  }
});
var Claim = (0, import_core6.list)({
  access: staffList({ read: anyOf("canManageSales", "canManageFinance"), create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    shipment: (0, import_fields3.relationship)({ ref: "Shipment", ...commandOnlyFieldText }),
    account: (0, import_fields3.relationship)({ ref: "Account", ...commandOnlyFieldText }),
    openedBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    kind: choice(["short_weight", "contamination", "wrong_grade", "damage", "other"], "other", commandOnlyFieldText),
    description: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    photos: (0, import_fields3.json)({ defaultValue: [], ...commandOnlyFieldText }),
    claimedCents: commandCents(),
    status: status(["open", "accepted", "rejected", "withdrawn"], "open"),
    creditCents: commandCents(),
    decisionReason: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    decidedBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    decidedAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    ...trackingFields
  }
});
var PaymentProvider = (0, import_core6.list)({
  access: staffList({ read: anyOf("canManageSettings", "canManageFinance"), create: permissions.canManageSettings, update: permissions.canManageSettings, delete: denyAll }),
  fields: {
    name: (0, import_fields3.text)({ validation: { isRequired: true } }),
    code: (0, import_fields3.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    isInstalled: (0, import_fields3.checkbox)({ defaultValue: true }),
    credentials: (0, import_fields3.json)({ ...serverOnlyField }),
    metadata: (0, import_fields3.json)(),
    ...trackingFields
  }
});
var PaymentSession = (0, import_core6.list)({
  access: staffList({ read: anyOf("canManageFinance", "canPaySellers"), create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    provider: (0, import_fields3.relationship)({ ref: "PaymentProvider", ...commandOnlyFieldText }),
    invoice: (0, import_fields3.relationship)({ ref: "Invoice", ...commandOnlyFieldText }),
    serviceRequest: (0, import_fields3.relationship)({ ref: "ServiceRequest.paymentSession", ...commandOnlyFieldText }),
    ticket: (0, import_fields3.relationship)({ ref: "ScaleTicket", ...commandOnlyFieldText }),
    payer: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    amountCents: commandCents(),
    currencyCode: (0, import_fields3.text)({ defaultValue: "USD", ...commandOnlyFieldText }),
    status: status(["pending", "requires_action", "authorized", "captured", "failed", "cancelled", "refunded", "partially_refunded"], "pending"),
    providerPaymentId: (0, import_fields3.text)({ isIndexed: "unique", ...commandOnlyFieldText }),
    clientSecret: (0, import_fields3.text)({ ...serverOnlyField }),
    idempotencyKeyHash: (0, import_fields3.text)({ isIndexed: "unique", ...serverOnlyField }),
    capturedAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    capturedCents: commandCents(),
    refundedCents: commandCents(),
    expiresAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    metadata: (0, import_fields3.json)({ ...commandOnlyFieldText }),
    ...trackingFields
  }
});
var Payment = (0, import_core6.list)({
  access: staffList({ read: permissions.canManageFinance, create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    invoice: (0, import_fields3.relationship)({ ref: "Invoice.payments", ...commandOnlyFieldText }),
    session: (0, import_fields3.relationship)({ ref: "PaymentSession", ...commandOnlyFieldText }),
    method: choice(["card", "wire", "ach", "check", "cash"], "card", commandOnlyFieldText),
    amountCents: commandCents(),
    reference: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    referenceKey: (0, import_fields3.text)({ isIndexed: "unique", ...commandOnlyFieldText }),
    receivedAt: (0, import_fields3.timestamp)({ defaultValue: { kind: "now" }, ...commandOnlyFieldText }),
    recordedBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    status: status(["succeeded", "reversed"], "succeeded"),
    refundedCents: commandCents(),
    ...trackingFields
  }
});
var Refund = (0, import_core6.list)({
  access: staffList({ read: permissions.canManageFinance, create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    payment: (0, import_fields3.relationship)({ ref: "Payment", ...commandOnlyFieldText }),
    session: (0, import_fields3.relationship)({ ref: "PaymentSession", ...commandOnlyFieldText }),
    amountCents: commandCents(),
    reason: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    status: status(["pending", "succeeded", "failed"], "pending"),
    providerRefundId: (0, import_fields3.text)({ isIndexed: "unique", ...commandOnlyFieldText }),
    failureMessage: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    claim: (0, import_fields3.relationship)({ ref: "Claim", ...commandOnlyFieldText }),
    serviceRequest: (0, import_fields3.relationship)({ ref: "ServiceRequest", ...commandOnlyFieldText }),
    createdBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    idempotencyKeyHash: (0, import_fields3.text)({ isIndexed: "unique", ...serverOnlyField }),
    ...trackingFields
  }
});
var PaymentWebhookEvent = (0, import_core6.list)({
  access: appendOnlyList({ read: permissions.canManageFinance }),
  fields: {
    provider: (0, import_fields3.text)({ validation: { isRequired: true }, ...commandOnlyFieldText }),
    providerEventId: (0, import_fields3.text)({ isIndexed: "unique", validation: { isRequired: true }, ...commandOnlyFieldText }),
    type: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    payloadHash: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    processedAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    result: (0, import_fields3.json)({ ...commandOnlyFieldText }),
    ...trackingFields
  }
});

// features/keystone/models/inventory.ts
var import_core7 = require("@keystone-6/core");
var import_fields5 = require("@keystone-6/core/fields");
var import_decimal = require("decimal.js");
var invRead = anyOf("canManageInventory", "canGradeTickets", "canManageSales", "canViewReports");
var costRead = { access: { read: anyOf("canManageInventory", "canManageSales", "canManageFinance", "canViewReports") } };
var InventoryBalance = (0, import_core7.list)({
  access: staffList({ read: invRead, create: denyAll, update: denyAll, delete: denyAll, yard: "yard" }),
  fields: {
    yard: (0, import_fields3.relationship)({ ref: "Yard", ...commandOnlyFieldText }),
    material: (0, import_fields3.relationship)({ ref: "Material", ...commandOnlyFieldText }),
    onHandWeight: commandWeight(),
    reservedWeight: commandWeight(),
    heldWeight: commandWeight(),
    totalCostCents: (0, import_fields3.integer)({ defaultValue: 0, validation: { isRequired: true }, ...commandOnlyFieldText, ...costRead }),
    availableWeight: (0, import_fields5.virtual)({
      field: import_core7.graphql.field({
        type: import_core7.graphql.String,
        resolve(item) {
          return new import_decimal.Decimal(String(item.onHandWeight ?? 0)).minus(String(item.reservedWeight ?? 0)).minus(String(item.heldWeight ?? 0)).toFixed(2);
        }
      })
    }),
    averageCostPerUnit: (0, import_fields5.virtual)({
      ...costRead,
      field: import_core7.graphql.field({
        type: import_core7.graphql.String,
        resolve(item) {
          const onHand = new import_decimal.Decimal(String(item.onHandWeight ?? 0));
          if (onHand.lte(0)) return "0";
          return new import_decimal.Decimal(item.totalCostCents ?? 0).div(onHand).toFixed(5);
        }
      })
    }),
    ...trackingFields
  }
});
var InventoryMovement = (0, import_core7.list)({
  access: appendOnlyList({ read: invRead, yard: "yard" }),
  fields: {
    yard: (0, import_fields3.relationship)({ ref: "Yard", ...commandOnlyFieldText }),
    material: (0, import_fields3.relationship)({ ref: "Material", ...commandOnlyFieldText }),
    kind: choice(["receive", "ship", "regrade_out", "regrade_in", "process_in", "process_out", "transfer_out", "transfer_in", "adjust", "reverse", "hold", "release"], "receive", commandOnlyFieldText),
    weightDelta: commandWeight(),
    costDeltaCents: (0, import_fields3.integer)({ defaultValue: 0, validation: { isRequired: true }, ...commandOnlyFieldText, ...costRead }),
    weightAfter: commandWeight(),
    ticket: (0, import_fields3.relationship)({ ref: "ScaleTicket", ...commandOnlyFieldText }),
    ticketLine: (0, import_fields3.relationship)({ ref: "TicketLine", ...commandOnlyFieldText }),
    processingRun: (0, import_fields3.relationship)({ ref: "ProcessingRun", ...commandOnlyFieldText }),
    transfer: (0, import_fields3.relationship)({ ref: "YardTransfer", ...commandOnlyFieldText }),
    unit: (0, import_fields3.relationship)({ ref: "InventoryUnit", ...commandOnlyFieldText }),
    reason: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    needsReview: (0, import_fields3.checkbox)({ defaultValue: false, ...commandOnlyFieldText }),
    reviewedBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    reviewedAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    referenceKey: (0, import_fields3.text)({ isIndexed: "unique", validation: { isRequired: true }, ...commandOnlyFieldText }),
    occurredAt: (0, import_fields3.timestamp)({ defaultValue: { kind: "now" }, ...commandOnlyFieldText }),
    createdBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    ...trackingFields
  }
});
var InventoryUnit = (0, import_core7.list)({
  access: staffList({ read: invRead, create: denyAll, update: permissions.canManageInventory, delete: denyAll, yard: "yard" }),
  ui: { labelField: "tagNumber" },
  fields: {
    yard: (0, import_fields3.relationship)({ ref: "Yard", ...commandOnlyFieldText }),
    tagNumber: (0, import_fields3.text)({ validation: { isRequired: true }, ...commandOnlyFieldText }),
    material: (0, import_fields3.relationship)({ ref: "Material", ...commandOnlyFieldText }),
    form: choice(["bale", "box", "gaylord", "drum", "pallet", "bundle"], "bale", commandOnlyFieldText),
    weight: commandWeight(),
    location: (0, import_fields3.text)(),
    status: status(["available", "held", "allocated", "shipped", "consumed"], "available"),
    costCents: (0, import_fields3.integer)({ defaultValue: 0, validation: { isRequired: true }, ...commandOnlyFieldText, ...costRead }),
    shipment: (0, import_fields3.relationship)({ ref: "Shipment.units", ...commandOnlyFieldText }),
    listing: (0, import_fields3.relationship)({ ref: "Listing.units", ...commandOnlyFieldText }),
    transfer: (0, import_fields3.relationship)({ ref: "YardTransfer.units", ...commandOnlyFieldText }),
    photo: (0, import_fields3.image)({ storage: "my_images" }),
    createdFromRun: (0, import_fields3.relationship)({ ref: "ProcessingRun", ...commandOnlyFieldText }),
    ...trackingFields
  }
});
var ProcessingRun = (0, import_core7.list)({
  access: staffList({ read: invRead, create: denyAll, update: denyAll, delete: denyAll, yard: "yard" }),
  fields: {
    yard: (0, import_fields3.relationship)({ ref: "Yard", ...commandOnlyFieldText }),
    kind: choice(["bale", "shear", "shred", "strip", "sort", "torch", "other"], "other", commandOnlyFieldText),
    status: status(["draft", "posted", "void"], "draft"),
    inputs: commandJson({ defaultValue: [] }),
    outputs: commandJson({ defaultValue: [] }),
    lossWeight: commandWeight(),
    processingCostCents: commandCents(),
    operator: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    postedAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    notes: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    ...trackingFields
  }
});
var YardTransfer = (0, import_core7.list)({
  access: staffList({ read: invRead, create: denyAll, update: denyAll, delete: denyAll, yard: ["fromYard", "toYard"] }),
  fields: {
    fromYard: (0, import_fields3.relationship)({ ref: "Yard", ...commandOnlyFieldText }),
    toYard: (0, import_fields3.relationship)({ ref: "Yard", ...commandOnlyFieldText }),
    status: status(["draft", "in_transit", "received", "cancelled"], "draft"),
    lines: commandJson({ defaultValue: [] }),
    units: (0, import_fields3.relationship)({ ref: "InventoryUnit.transfer", many: true, ...commandOnlyFieldText }),
    sentAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    receivedAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    sentBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    receivedBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    ...trackingFields
  }
});
var Listing = (0, import_core7.list)({
  access: staffList({ read: permissions.canAccessDashboard, create: denyAll, update: permissions.canManageSales, delete: denyAll, yard: "yard" }),
  fields: {
    yard: (0, import_fields3.relationship)({ ref: "Yard", ...commandOnlyFieldText }),
    title: (0, import_fields3.text)({ validation: { isRequired: true } }),
    material: (0, import_fields3.relationship)({ ref: "Material", ...commandOnlyFieldText }),
    form: choice(["bale", "loose", "box", "gaylord", "drum", "pallet", "bundle"], "loose"),
    description: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    photos: (0, import_fields3.json)({ defaultValue: [] }),
    estimatedWeight: weight(),
    availableWeight: commandWeight(),
    units: (0, import_fields3.relationship)({ ref: "InventoryUnit.listing", many: true, ...commandOnlyFieldText }),
    askUnitPrice: unitPrice(),
    unit: choice([...UNITS], "lb"),
    allowOffers: (0, import_fields3.checkbox)({ defaultValue: true }),
    buyNow: (0, import_fields3.checkbox)({ defaultValue: false }),
    minimumWeight: weight(),
    terms: choice(["fob_yard", "delivered"], "fob_yard"),
    closesAt: (0, import_fields3.timestamp)(),
    status: status(["draft", "open", "paused", "sold_out", "closed"], "draft"),
    offers: (0, import_fields3.relationship)({ ref: "Offer.listing", many: true, ...commandOnlyFieldText }),
    ...trackingFields
  }
});
var Offer = (0, import_core7.list)({
  access: staffList({ read: permissions.canManageSales, create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    listing: (0, import_fields3.relationship)({ ref: "Listing.offers", ...commandOnlyFieldText }),
    account: (0, import_fields3.relationship)({ ref: "Account", ...commandOnlyFieldText }),
    contact: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    weight: commandWeight(),
    unitPrice: unitPrice({ ...commandOnlyFieldText }),
    unit: choice([...UNITS], "lb", commandOnlyFieldText),
    pickupFrom: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    pickupTo: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    message: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    status: status(["submitted", "countered", "accepted", "declined", "withdrawn", "expired"], "submitted"),
    counterUnitPrice: unitPrice({ ...commandOnlyFieldText }),
    counterWeight: weight({ ...commandOnlyFieldText }),
    counterMessage: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    decisionReason: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    expiresAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    decidedBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    salesOrder: (0, import_fields3.relationship)({ ref: "SalesOrder.offer", ...commandOnlyFieldText }),
    ...trackingFields
  }
});
var SalesOrder = (0, import_core7.list)({
  access: staffList({ read: anyOf("canManageSales", "canManageFinance"), create: denyAll, update: permissions.canManageSales, delete: denyAll, yard: "yard" }),
  fields: {
    number: (0, import_fields3.integer)({ ...commandOnlyFieldText }),
    yard: (0, import_fields3.relationship)({ ref: "Yard", ...commandOnlyFieldText }),
    account: (0, import_fields3.relationship)({ ref: "Account", ...commandOnlyFieldText }),
    status: status(["draft", "confirmed", "in_fulfilment", "fulfilled", "closed", "cancelled"], "draft"),
    terms: choice(["fob_yard", "delivered"], "fob_yard", commandOnlyFieldText),
    paymentTerms: choice(["prepay", "net"], "net", commandOnlyFieldText),
    netDays: (0, import_fields3.integer)({ defaultValue: 30, ...commandOnlyFieldText }),
    weightBasis: choice(["shipped", "received"], "shipped", commandOnlyFieldText),
    shipFrom: (0, import_fields3.text)(),
    shipTo: (0, import_fields3.text)(),
    shipWindowStart: (0, import_fields3.timestamp)(),
    shipWindowEnd: (0, import_fields3.timestamp)(),
    lines: (0, import_fields3.relationship)({ ref: "SalesOrderLine.order", many: true, ...commandOnlyFieldText }),
    shipments: (0, import_fields3.relationship)({ ref: "Shipment.order", many: true, ...commandOnlyFieldText }),
    offer: (0, import_fields3.relationship)({ ref: "Offer.salesOrder", ...commandOnlyFieldText }),
    buyerReference: (0, import_fields3.text)(),
    cancelReason: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    notes: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    ...trackingFields
  }
});
var SalesOrderLine = (0, import_core7.list)({
  access: staffList({ read: anyOf("canManageSales", "canManageFinance"), create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    order: (0, import_fields3.relationship)({ ref: "SalesOrder.lines", ...commandOnlyFieldText }),
    material: (0, import_fields3.relationship)({ ref: "Material", ...commandOnlyFieldText }),
    materialName: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    weight: commandWeight(),
    tolerancePercent: weight({ defaultValue: "5", ...commandOnlyFieldText }),
    unit: choice([...UNITS], "lb", commandOnlyFieldText),
    unitPrice: unitPrice({ ...commandOnlyFieldText }),
    shippedWeight: commandWeight(),
    reservedWeight: commandWeight(),
    listing: (0, import_fields3.relationship)({ ref: "Listing", ...commandOnlyFieldText }),
    ...trackingFields
  }
});
var Shipment = (0, import_core7.list)({
  access: staffList({ read: anyOf("canManageSales", "canManageTickets", "canManageFinance"), create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    order: (0, import_fields3.relationship)({ ref: "SalesOrder.shipments", ...commandOnlyFieldText }),
    number: (0, import_fields3.integer)({ ...commandOnlyFieldText }),
    status: status(["scheduled", "loading", "loaded", "released", "delivered", "reconciled", "cancelled"], "scheduled"),
    carrier: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    driverName: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    truckPlate: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    trailerNumber: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    sealNumber: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    bolNumber: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    scheduledFor: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    ticket: (0, import_fields3.relationship)({ ref: "ScaleTicket.shipment", ...commandOnlyFieldText }),
    units: (0, import_fields3.relationship)({ ref: "InventoryUnit.shipment", many: true, ...commandOnlyFieldText }),
    lines: commandJson({ defaultValue: [] }),
    shippedWeight: commandWeight(),
    receivedWeight: weight({ ...commandOnlyFieldText }),
    receivedGradeNote: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    freightCents: commandCents(),
    invoice: (0, import_fields3.relationship)({ ref: "Invoice", ...commandOnlyFieldText }),
    job: (0, import_fields3.relationship)({ ref: "DispatchJob", ...commandOnlyFieldText }),
    releasedAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    deliveredAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    ...trackingFields
  }
});

// features/keystone/models/dispatch.ts
var import_core8 = require("@keystone-6/core");
var import_fields6 = require("@keystone-6/core/fields");
var dispatchStaff = permissions.canManageDispatch;
var ContainerType = (0, import_core8.list)({
  access: {
    operation: { query: allowAll, create: dispatchStaff, update: dispatchStaff, delete: denyAll },
    filter: { query: ({ session }) => isStaff(session) ? true : { isPublic: { equals: true } } }
  },
  fields: {
    name: (0, import_fields3.text)({ validation: { isRequired: true } }),
    slug: (0, import_fields3.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    kind: choice(["roll_off", "lugger", "hopper", "gaylord", "drum", "trailer"], "roll_off"),
    capacityLabel: (0, import_fields3.text)(),
    dimensions: (0, import_fields3.text)(),
    description: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    image: (0, import_fields3.image)({ storage: "my_images" }),
    suitableFor: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    deliveryFeeCents: (0, import_fields3.integer)({ defaultValue: 0, validation: { isRequired: true } }),
    haulFeeCents: (0, import_fields3.integer)({ defaultValue: 0, validation: { isRequired: true } }),
    rentalFeePerDayCents: (0, import_fields3.integer)({ defaultValue: 0, validation: { isRequired: true } }),
    freeRentalDays: (0, import_fields3.integer)({ defaultValue: 0, validation: { isRequired: true } }),
    dryRunFeeCents: (0, import_fields3.integer)({ defaultValue: 0, validation: { isRequired: true } }),
    isPublic: (0, import_fields3.checkbox)({ defaultValue: true }),
    ...trackingFields
  }
});
var Container = (0, import_core8.list)({
  access: staffList({ create: dispatchStaff, update: dispatchStaff, delete: denyAll, yard: "homeYard" }),
  ui: { labelField: "number" },
  fields: {
    number: (0, import_fields3.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    type: (0, import_fields3.relationship)({ ref: "ContainerType" }),
    homeYard: (0, import_fields3.relationship)({ ref: "Yard" }),
    status: status(["in_yard", "assigned", "in_transit", "at_customer", "maintenance", "retired"], "in_yard"),
    tareWeight: weight(),
    site: (0, import_fields3.relationship)({ ref: "ServiceSite", ...commandOnlyFieldText }),
    account: (0, import_fields3.relationship)({ ref: "Account", ...commandOnlyFieldText }),
    placedOn: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    rentalChargedThrough: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    currentMaterial: (0, import_fields3.relationship)({ ref: "Material" }),
    notes: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    daysOnSite: (0, import_fields6.virtual)({
      field: import_core8.graphql.field({
        type: import_core8.graphql.Int,
        resolve(item) {
          if (item.status !== "at_customer" || !item.placedOn) return null;
          return Math.max(0, Math.floor((Date.now() - new Date(item.placedOn).getTime()) / 864e5));
        }
      })
    }),
    ...trackingFields
  }
});
var ServiceRequest = (0, import_core8.list)({
  access: staffList({ read: anyOf("canManageDispatch", "canManageAccounts", "canManageFinance"), create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    number: (0, import_fields3.integer)({ ...commandOnlyFieldText }),
    yard: (0, import_fields3.relationship)({ ref: "Yard", ...commandOnlyFieldText }),
    account: (0, import_fields3.relationship)({ ref: "Account", ...commandOnlyFieldText }),
    seller: (0, import_fields3.relationship)({ ref: "Seller", ...commandOnlyFieldText }),
    requestedBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    site: (0, import_fields3.relationship)({ ref: "ServiceSite", ...commandOnlyFieldText }),
    kind: choice(["deliver", "swap", "pickup", "remove", "live_load", "public_pickup"], "deliver", commandOnlyFieldText),
    containerType: (0, import_fields3.relationship)({ ref: "ContainerType", ...commandOnlyFieldText }),
    container: (0, import_fields3.relationship)({ ref: "Container", ...commandOnlyFieldText }),
    material: (0, import_fields3.relationship)({ ref: "Material", ...commandOnlyFieldText }),
    itemsDescription: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    photos: (0, import_fields3.json)({ defaultValue: [], ...commandOnlyFieldText }),
    preferredDate: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    preferredWindow: choice(["morning", "afternoon", "any"], "any", commandOnlyFieldText),
    accessNotes: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    status: status(["requested", "awaiting_payment", "approved", "scheduled", "completed", "declined", "cancelled"], "requested"),
    feeCents: commandCents(),
    quoteNote: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    quoteAcceptedAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    chargeToAccount: (0, import_fields3.checkbox)({ defaultValue: false, ...commandOnlyFieldText }),
    paymentSession: (0, import_fields3.relationship)({ ref: "PaymentSession.serviceRequest", ...commandOnlyFieldText }),
    invoice: (0, import_fields3.relationship)({ ref: "Invoice", ...commandOnlyFieldText }),
    decisionReason: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    job: (0, import_fields3.relationship)({ ref: "DispatchJob.request", ...commandOnlyFieldText }),
    ...trackingFields
  }
});
var Truck = (0, import_core8.list)({
  access: staffList({ create: dispatchStaff, update: dispatchStaff, delete: denyAll, yard: "yard" }),
  fields: {
    name: (0, import_fields3.text)({ validation: { isRequired: true } }),
    plate: (0, import_fields3.text)(),
    kind: choice(["roll_off", "lugger", "flatbed", "box", "tractor"], "roll_off"),
    yard: (0, import_fields3.relationship)({ ref: "Yard" }),
    isActive: (0, import_fields3.checkbox)({ defaultValue: true }),
    ...trackingFields
  }
});
var DispatchJob = (0, import_core8.list)({
  access: {
    operation: { query: anyOf("canManageDispatch", "canDriveJobs", "canManageTickets"), create: denyAll, update: denyAll, delete: denyAll },
    filter: {
      query: ({ session }) => {
        if (!isStaff(session)) return false;
        const role = session.data.role || {};
        if (role.canManageDispatch || role.canManageTickets || role.canManageSettings) return true;
        return { driver: { id: { equals: session.itemId } } };
      }
    }
  },
  fields: {
    number: (0, import_fields3.integer)({ ...commandOnlyFieldText }),
    yard: (0, import_fields3.relationship)({ ref: "Yard", ...commandOnlyFieldText }),
    request: (0, import_fields3.relationship)({ ref: "ServiceRequest.job", ...commandOnlyFieldText }),
    shipment: (0, import_fields3.relationship)({ ref: "Shipment", ...commandOnlyFieldText }),
    kind: choice(["deliver", "swap", "pickup", "remove", "live_load", "public_pickup", "deliver_to_buyer"], "deliver", commandOnlyFieldText),
    status: status(["planned", "assigned", "en_route", "on_site", "completed", "failed", "cancelled"], "planned"),
    scheduledDate: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    sequence: (0, import_fields3.integer)({ defaultValue: 0, ...commandOnlyFieldText }),
    driver: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    truck: (0, import_fields3.relationship)({ ref: "Truck", ...commandOnlyFieldText }),
    dropContainer: (0, import_fields3.relationship)({ ref: "Container", ...commandOnlyFieldText }),
    pickContainer: (0, import_fields3.relationship)({ ref: "Container", ...commandOnlyFieldText }),
    site: (0, import_fields3.relationship)({ ref: "ServiceSite", ...commandOnlyFieldText }),
    startedAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    arrivedAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    completedAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    photos: (0, import_fields3.json)({ defaultValue: [], ...commandOnlyFieldText }),
    signedName: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    failureReason: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    driverNotes: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    ...trackingFields
  }
});
var DonationCampaign = (0, import_core8.list)({
  access: {
    operation: { query: allowAll, create: anyOf("canManageAccounts", "canManageFinance"), update: anyOf("canManageAccounts", "canManageFinance"), delete: denyAll },
    filter: { query: ({ session }) => isStaff(session) ? true : { isPublic: { equals: true }, status: { equals: "active" } } }
  },
  fields: {
    account: (0, import_fields3.relationship)({ ref: "Account" }),
    name: (0, import_fields3.text)({ validation: { isRequired: true } }),
    slug: (0, import_fields3.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    description: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    image: (0, import_fields3.image)({ storage: "my_images" }),
    goalWeight: weight(),
    goalCents: (0, import_fields3.integer)(),
    startsOn: (0, import_fields3.timestamp)(),
    endsOn: (0, import_fields3.timestamp)(),
    isPublic: (0, import_fields3.checkbox)({ defaultValue: true }),
    status: choice(["draft", "active", "ended"], "draft"),
    raisedCents: (0, import_fields6.virtual)({
      field: import_core8.graphql.field({
        type: import_core8.graphql.Int,
        async resolve(item, _a, context) {
          const rows = await context.sudo().prisma.donation.aggregate({ where: { campaignId: item.id, status: { in: ["credited", "disbursed"] } }, _sum: { amountCents: true } });
          return rows._sum.amountCents || 0;
        }
      })
    }),
    raisedWeight: (0, import_fields6.virtual)({
      field: import_core8.graphql.field({
        type: import_core8.graphql.String,
        async resolve(item, _a, context) {
          const rows = await context.sudo().prisma.donation.aggregate({ where: { campaignId: item.id, status: { in: ["credited", "disbursed"] } }, _sum: { weight: true } });
          return String(rows._sum.weight || "0");
        }
      })
    }),
    donorCount: (0, import_fields6.virtual)({
      field: import_core8.graphql.field({
        type: import_core8.graphql.Int,
        async resolve(item, _a, context) {
          const rows = await context.sudo().prisma.donation.groupBy({ by: ["sellerId"], where: { campaignId: item.id, status: { in: ["credited", "disbursed"] } } });
          return rows.length;
        }
      })
    }),
    ...trackingFields
  }
});
var Donation = (0, import_core8.list)({
  access: staffList({ read: anyOf("canManageAccounts", "canManageFinance", "canManageTickets", "canViewReports"), create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    ticket: (0, import_fields3.relationship)({ ref: "ScaleTicket", ...commandOnlyFieldText }),
    seller: (0, import_fields3.relationship)({ ref: "Seller", ...commandOnlyFieldText }),
    account: (0, import_fields3.relationship)({ ref: "Account", ...commandOnlyFieldText }),
    campaign: (0, import_fields3.relationship)({ ref: "DonationCampaign", ...commandOnlyFieldText }),
    amountCents: commandCents(),
    weight: weight({ ...commandOnlyFieldText }),
    itemsSummary: (0, import_fields3.json)({ defaultValue: [], ...commandOnlyFieldText }),
    kind: choice(["payout_donation", "goods_donation"], "payout_donation", commandOnlyFieldText),
    status: status(["pledged", "credited", "disbursed", "cancelled"], "pledged"),
    receiptNumber: (0, import_fields3.text)({ isIndexed: "unique", ...commandOnlyFieldText }),
    receiptIssuedAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    goodsOrServicesProvided: (0, import_fields3.checkbox)({ defaultValue: false, ...commandOnlyFieldText }),
    showDonorName: (0, import_fields3.checkbox)({ defaultValue: false, ...commandOnlyFieldText }),
    settlement: (0, import_fields3.relationship)({ ref: "Settlement.donations", ...commandOnlyFieldText }),
    ...trackingFields
  }
});

// features/keystone/models/compliance.ts
var import_core9 = require("@keystone-6/core");
var complianceStaff = permissions.canManageCompliance;
var rulesEditors = anyOf("canManageCompliance", "canManageSettings");
var RulesProfile = (0, import_core9.list)({
  access: staffList({ create: rulesEditors, update: rulesEditors, delete: denyAll }),
  fields: {
    name: (0, import_fields3.text)({ validation: { isRequired: true } }),
    region: (0, import_fields3.text)(),
    template: choice(["general", "ohio", "florida", "custom"], "general"),
    requireGovernmentId: (0, import_fields3.checkbox)({ defaultValue: true }),
    requireIdPhoto: (0, import_fields3.checkbox)({ defaultValue: true }),
    requireSellerPhoto: (0, import_fields3.checkbox)({ defaultValue: false }),
    requireMaterialPhoto: (0, import_fields3.checkbox)({ defaultValue: true }),
    requireVehiclePlate: (0, import_fields3.checkbox)({ defaultValue: true }),
    requireSignature: (0, import_fields3.checkbox)({ defaultValue: true }),
    requireThumbprint: (0, import_fields3.checkbox)({ defaultValue: false }),
    minimumSellerAge: (0, import_fields3.integer)({ defaultValue: 18, validation: { isRequired: true } }),
    cashLimitPerTicketCents: (0, import_fields3.integer)(),
    cashLimitPerDayCents: (0, import_fields3.integer)(),
    cashRounding: choice(["none", "nickel_up"], "none"),
    defaultPaymentHoldDays: (0, import_fields3.integer)({ defaultValue: 0, validation: { isRequired: true } }),
    defaultMaterialHoldDays: (0, import_fields3.integer)({ defaultValue: 0, validation: { isRequired: true } }),
    allowEarlyRelease: (0, import_fields3.checkbox)({ defaultValue: false }),
    retentionDays: (0, import_fields3.integer)({ defaultValue: 730, validation: { isRequired: true } }),
    dailyReport: (0, import_fields3.checkbox)({ defaultValue: false }),
    reportDueTime: (0, import_fields3.text)(),
    reportOmitsPrice: (0, import_fields3.checkbox)({ defaultValue: false }),
    ownershipStatement: (0, import_fields3.text)({
      ui: { displayMode: "textarea" },
      defaultValue: "I am the lawful owner of the material sold on this ticket, or I am authorised by the owner to sell it."
    }),
    restrictions: (0, import_fields3.relationship)({ ref: "MaterialRestriction.profile", many: true }),
    ...trackingFields
  }
});
var MaterialRestriction = (0, import_core9.list)({
  access: staffList({ create: rulesEditors, update: rulesEditors, delete: rulesEditors }),
  fields: {
    profile: (0, import_fields3.relationship)({ ref: "RulesProfile.restrictions" }),
    material: (0, import_fields3.relationship)({ ref: "Material" }),
    category: (0, import_fields3.relationship)({ ref: "MaterialCategory" }),
    label: (0, import_fields3.text)({ validation: { isRequired: true } }),
    kind: choice(["prohibited", "proof_of_ownership", "commercial_only", "payment_rule"], "payment_rule"),
    requiredDocuments: (0, import_fields3.json)({ defaultValue: [] }),
    forbidCash: (0, import_fields3.checkbox)({ defaultValue: false }),
    allowedMethods: (0, import_fields3.json)(),
    paymentHoldDays: (0, import_fields3.integer)({ defaultValue: 0 }),
    materialHoldDays: (0, import_fields3.integer)({ defaultValue: 0 }),
    mailCheckOnly: (0, import_fields3.checkbox)({ defaultValue: false }),
    publicNote: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    ...trackingFields
  }
});
var HoldTag = (0, import_core9.list)({
  access: staffList({ read: anyOf("canManageCompliance", "canManageInventory", "canManageTickets", "canPaySellers"), create: denyAll, update: denyAll, delete: denyAll, yard: "yard" }),
  fields: {
    ticket: (0, import_fields3.relationship)({ ref: "ScaleTicket.holdTags", ...commandOnlyFieldText }),
    line: (0, import_fields3.relationship)({ ref: "TicketLine", ...commandOnlyFieldText }),
    yard: (0, import_fields3.relationship)({ ref: "Yard", ...commandOnlyFieldText }),
    material: (0, import_fields3.relationship)({ ref: "Material", ...commandOnlyFieldText }),
    weight: commandWeight(),
    kind: choice(["material", "police"], "material", commandOnlyFieldText),
    status: status(["held", "released", "police_hold", "seized", "cancelled"], "held"),
    releaseAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    releasedBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    releasedAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    releaseReason: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    caseNumber: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    agency: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    ...trackingFields
  }
});
var DoNotBuyEntry = (0, import_core9.list)({
  access: staffList({ read: anyOf("canManageCompliance", "canManageTickets", "canManageSellers"), create: complianceStaff, update: complianceStaff, delete: denyAll }),
  ui: { labelField: "lastName" },
  fields: {
    firstName: (0, import_fields3.text)(),
    lastName: (0, import_fields3.text)(),
    nameNormalized: (0, import_fields3.text)({ isIndexed: true, ...commandOnlyFieldText, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } } }),
    dateOfBirth: (0, import_fields3.timestamp)(),
    idNumber: (0, import_fields3.text)(),
    idNumberNormalized: (0, import_fields3.text)({ isIndexed: true, ...commandOnlyFieldText, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } } }),
    plate: (0, import_fields3.text)(),
    plateNormalized: (0, import_fields3.text)({ isIndexed: true, ...commandOnlyFieldText, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } } }),
    source: choice(["yard", "court", "state_list", "law_enforcement"], "yard"),
    reason: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    expiresOn: (0, import_fields3.timestamp)(),
    isActive: (0, import_fields3.checkbox)({ defaultValue: true }),
    seller: (0, import_fields3.relationship)({ ref: "Seller" }),
    addedBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    ...trackingFields
  },
  hooks: {
    resolveInput: ({ resolvedData, item, context, operation }) => {
      const first = resolvedData.firstName ?? item?.firstName ?? "";
      const last = resolvedData.lastName ?? item?.lastName ?? "";
      resolvedData.nameNormalized = `${first} ${last}`.trim().toLowerCase().replace(/\s+/g, " ") || null;
      const id = resolvedData.idNumber ?? item?.idNumber;
      resolvedData.idNumberNormalized = id ? String(id).replace(/[^a-z0-9]/gi, "").toUpperCase() : null;
      const plate = resolvedData.plate ?? item?.plate;
      resolvedData.plateNormalized = plate ? String(plate).replace(/[^a-z0-9]/gi, "").toUpperCase() : null;
      if (operation === "create" && context.session?.itemId) resolvedData.addedBy = { connect: { id: context.session.itemId } };
      return resolvedData;
    }
  }
});
var TheftAlert = (0, import_core9.list)({
  access: staffList({ create: complianceStaff, update: complianceStaff, delete: denyAll }),
  fields: {
    title: (0, import_fields3.text)({ validation: { isRequired: true } }),
    description: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    materials: (0, import_fields3.relationship)({ ref: "Material", many: true }),
    keywords: (0, import_fields3.text)(),
    reportedOn: (0, import_fields3.timestamp)({ defaultValue: { kind: "now" } }),
    agency: (0, import_fields3.text)(),
    contact: (0, import_fields3.text)(),
    sourceUrl: (0, import_fields3.text)(),
    expiresOn: (0, import_fields3.timestamp)(),
    isActive: (0, import_fields3.checkbox)({ defaultValue: true }),
    ...trackingFields
  }
});
var ComplianceReport = (0, import_core9.list)({
  access: staffList({ read: complianceStaff, create: denyAll, update: denyAll, delete: denyAll, yard: "yard" }),
  fields: {
    yard: (0, import_fields3.relationship)({ ref: "Yard", ...commandOnlyFieldText }),
    reportDate: (0, import_fields3.text)({ validation: { isRequired: true }, ...commandOnlyFieldText, ui: { description: "YYYY-MM-DD in the yard time zone" } }),
    status: status(["generated", "submitted"], "generated"),
    ticketCount: (0, import_fields3.integer)({ defaultValue: 0, ...commandOnlyFieldText }),
    file: (0, import_fields3.file)({ storage: "private_files", ...commandOnlyFieldText }),
    csv: (0, import_fields3.text)({ ...commandOnlyFieldText, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } } }),
    fileHash: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    generatedBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    submittedBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    submittedAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    submissionNote: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    ...trackingFields
  }
});
var AuditEvent = (0, import_core9.list)({
  access: appendOnlyList({ read: anyOf("canManageCompliance", "canManageFinance", "canManageSettings"), yard: void 0 }),
  fields: {
    eventKey: (0, import_fields3.text)({ isIndexed: "unique", validation: { isRequired: true }, ...commandOnlyFieldText }),
    eventType: (0, import_fields3.text)({ validation: { isRequired: true }, isIndexed: true, ...commandOnlyFieldText }),
    aggregateType: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    aggregateId: (0, import_fields3.text)({ isIndexed: true, ...commandOnlyFieldText }),
    yard: (0, import_fields3.relationship)({ ref: "Yard", ...commandOnlyFieldText }),
    actor: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    before: (0, import_fields3.json)({ ...commandOnlyFieldText }),
    after: (0, import_fields3.json)({ ...commandOnlyFieldText }),
    reason: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    occurredAt: (0, import_fields3.timestamp)({ defaultValue: { kind: "now" }, ...commandOnlyFieldText }),
    ...trackingFields
  }
});
var CommandReceipt = (0, import_core9.list)({
  access: appendOnlyList({ read: permissions.canManageSettings }),
  fields: {
    eventKey: (0, import_fields3.text)({ isIndexed: "unique", validation: { isRequired: true }, ...commandOnlyFieldText }),
    eventType: (0, import_fields3.text)({ validation: { isRequired: true }, ...commandOnlyFieldText }),
    aggregateType: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    aggregateId: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    payloadHash: (0, import_fields3.text)({ validation: { isRequired: true }, ...commandOnlyFieldText }),
    result: (0, import_fields3.json)({ ...commandOnlyFieldText }),
    actorId: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    occurredAt: (0, import_fields3.timestamp)({ defaultValue: { kind: "now" }, ...commandOnlyFieldText }),
    ...trackingFields
  }
});

// features/keystone/models/OAuthApp.ts
var import_core10 = require("@keystone-6/core");
var import_fields7 = require("@keystone-6/core/fields");

// features/keystone/mcp-oauth/core.ts
var import_node_crypto = __toESM(require("node:crypto"));
var MCP_SCOPES = ["mcp:read", "mcp:write"];
var MCP_ACCESS_PREFIX = "mcp_at_";
var ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
var REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
var AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1e3;
var CONSENT_TICKET_TTL_MS = 10 * 60 * 1e3;
var DEVELOPMENT_SECRET = "this secret should only be used in testing";
function secret() {
  return process.env.SESSION_SECRET || DEVELOPMENT_SECRET;
}
function randomToken(prefix, bytes = 32) {
  return `${prefix}${import_node_crypto.default.randomBytes(bytes).toString("base64url")}`;
}
function digestToken(token, purpose = "mcp-oauth-token") {
  return import_node_crypto.default.createHmac("sha256", secret()).update(`${purpose}\0${token}`, "utf8").digest("hex");
}
function bearerToken(header) {
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== "string") return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(value);
  return match ? match[1] : null;
}
function isMcpAccessToken(token) {
  return typeof token === "string" && token.startsWith(MCP_ACCESS_PREFIX) && token.length > MCP_ACCESS_PREFIX.length;
}
function storedScopes(value) {
  return Array.isArray(value) ? MCP_SCOPES.filter((scope) => value.includes(scope)) : [];
}

// features/keystone/models/OAuthApp.ts
var OAuthApp = (0, import_core10.list)({
  access: {
    operation: {
      query: permissions.canManagePeople,
      create: permissions.canManagePeople,
      update: permissions.canManagePeople,
      delete: permissions.canManagePeople
    }
  },
  fields: {
    name: (0, import_fields7.text)({
      validation: {
        isRequired: true
      }
    }),
    clientId: (0, import_fields7.text)({
      isIndexed: "unique",
      hooks: {
        resolveInput: ({ operation, resolvedData }) => {
          if (operation === "create" && !resolvedData.clientId) {
            return randomToken("mcp_cl_", 18);
          }
          return resolvedData.clientId;
        }
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
        description: "Auto-generated unique identifier for your application."
      }
    }),
    clientSecret: (0, import_fields7.text)({
      access: {
        read: () => false
      },
      hooks: {
        resolveInput: ({ resolvedData }) => {
          if (resolvedData.clientSecret) {
            return digestToken(resolvedData.clientSecret, "oauth-client-secret");
          }
          return void 0;
        }
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        description: "Stored only as a digest. Public MCP clients have no secret."
      }
    }),
    tokenEndpointAuthMethod: (0, import_fields7.select)({
      options: [
        { label: "Client secret (POST)", value: "client_secret_post" },
        { label: "Client secret (Basic)", value: "client_secret_basic" },
        { label: "None (public PKCE client)", value: "none" }
      ],
      defaultValue: "client_secret_post",
      ui: {
        description: "How the app authenticates at the token endpoint. MCP clients are public (none)."
      }
    }),
    redirectUris: (0, import_fields7.json)({
      defaultValue: [],
      ui: {
        description: "Array of allowed redirect URIs for OAuth callbacks"
      }
    }),
    scopes: (0, import_fields7.json)({
      defaultValue: [...MCP_SCOPES],
      ui: {
        description: "Array of allowed OAuth scopes. MCP scopes only narrow the signed-in user's own access."
      }
    }),
    webhookUrl: (0, import_fields7.text)({
      ui: {
        description: "URL to receive webhook notifications"
      }
    }),
    status: (0, import_fields7.select)({
      options: [
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Pending", value: "pending" }
      ],
      defaultValue: "active"
    }),
    installUrl: (0, import_fields7.text)({
      ui: {
        description: "URL where users can install this app"
      }
    }),
    uninstallUrl: (0, import_fields7.text)({
      ui: {
        description: "URL to handle app uninstallation"
      }
    }),
    description: (0, import_fields7.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    metadata: (0, import_fields7.json)({
      defaultValue: {},
      ui: {
        description: "Additional app-specific configuration and settings"
      }
    }),
    developerEmail: (0, import_fields7.text)(),
    privacyPolicyUrl: (0, import_fields7.text)(),
    termsOfServiceUrl: (0, import_fields7.text)(),
    supportUrl: (0, import_fields7.text)(),
    ...trackingFields
  },
  ui: {
    labelField: "name",
    listView: {
      initialColumns: ["name", "clientId", "status", "createdAt"]
    }
  }
});

// features/keystone/models/OAuthToken.ts
var import_core12 = require("@keystone-6/core");
var import_fields8 = require("@keystone-6/core/fields");
var digestTokenInput = {
  resolveInput: ({ resolvedData, fieldKey }) => resolvedData[fieldKey] ? digestToken(resolvedData[fieldKey]) : resolvedData[fieldKey]
};
var OAuthToken = (0, import_core12.list)({
  access: {
    operation: {
      query: permissions.canManagePeople,
      create: permissions.canManagePeople,
      update: permissions.canManagePeople,
      delete: permissions.canManagePeople
    }
  },
  fields: {
    tokenType: (0, import_fields8.select)({
      options: [
        { label: "Authorization Code", value: "authorization_code" },
        { label: "Access Token", value: "access_token" },
        { label: "Refresh Token", value: "refresh_token" }
      ],
      validation: {
        isRequired: true
      }
    }),
    token: (0, import_fields8.text)({
      access: { read: () => false },
      validation: {
        isRequired: true
      },
      isIndexed: "unique",
      hooks: digestTokenInput
    }),
    clientId: (0, import_fields8.text)({
      validation: {
        isRequired: true
      },
      isIndexed: true
    }),
    user: (0, import_fields8.relationship)({
      ref: "User",
      ui: {
        description: "The user who authorized this token"
      }
    }),
    scopes: (0, import_fields8.json)({
      defaultValue: [],
      ui: {
        description: "Array of granted scopes"
      }
    }),
    redirectUri: (0, import_fields8.text)({
      ui: {
        description: "The redirect URI used during authorization"
      }
    }),
    resource: (0, import_fields8.text)({
      ui: {
        description: "The MCP endpoint (RFC 8707 resource) this grant is for"
      }
    }),
    expiresAt: (0, import_fields8.timestamp)({
      ui: {
        description: "When this token expires"
      }
    }),
    isRevoked: (0, import_fields8.select)({
      options: [
        { label: "Active", value: "false" },
        { label: "Revoked", value: "true" }
      ],
      defaultValue: "false"
    }),
    authorizationCode: (0, import_fields8.text)({
      access: { read: () => false },
      hooks: digestTokenInput,
      ui: {
        description: "The authorization code that was exchanged for this token (for access tokens)"
      }
    }),
    refreshToken: (0, import_fields8.text)({
      access: { read: () => false },
      hooks: digestTokenInput,
      ui: {
        description: "Associated refresh token (for access tokens)"
      }
    }),
    accessToken: (0, import_fields8.text)({
      access: { read: () => false },
      hooks: digestTokenInput,
      ui: {
        description: "Associated access token (for refresh tokens)"
      }
    }),
    state: (0, import_fields8.text)({
      ui: {
        description: "OAuth state parameter for CSRF protection"
      }
    }),
    codeChallenge: (0, import_fields8.text)({
      ui: {
        description: "PKCE code challenge"
      }
    }),
    codeChallengeMethod: (0, import_fields8.select)({
      options: [
        { label: "Plain", value: "plain" },
        { label: "SHA256", value: "S256" }
      ],
      ui: {
        description: "PKCE code challenge method"
      }
    }),
    ...trackingFields
  },
  ui: {
    labelField: "clientId",
    listView: {
      initialColumns: ["tokenType", "clientId", "user", "scopes", "expiresAt", "isRevoked"]
    }
  }
});

// features/keystone/models/index.ts
var models = {
  // §6.1
  User,
  Role,
  // §6.2
  BusinessSettings,
  Yard,
  YardClosure,
  Scale,
  Sequence,
  // §6.3
  MaterialCategory,
  Material,
  PriceList,
  PriceEntry,
  // §6.4
  Seller,
  IdentityDocument,
  Vehicle,
  Account,
  AccountContact,
  AccountApplication,
  AccountDocument,
  ServiceSite,
  // §6.5
  Visit,
  ScaleTicket,
  TicketLine,
  WeighEvent,
  TicketAttachment,
  // §6.6
  Payout,
  CashDrawer,
  CashDrawerSession,
  CashDrawerEvent,
  AccountCharge,
  Settlement,
  // §6.7
  InventoryBalance,
  InventoryMovement,
  InventoryUnit,
  ProcessingRun,
  YardTransfer,
  // §6.8
  Listing,
  Offer,
  SalesOrder,
  SalesOrderLine,
  Shipment,
  Invoice,
  InvoiceLine,
  Claim,
  // §6.9
  PaymentProvider,
  PaymentSession,
  Payment,
  Refund,
  PaymentWebhookEvent,
  // §6.10
  ContainerType,
  Container,
  ServiceRequest,
  Truck,
  DispatchJob,
  // §6.11
  DonationCampaign,
  Donation,
  // §6.12
  RulesProfile,
  MaterialRestriction,
  HoldTag,
  DoNotBuyEntry,
  TheftAlert,
  ComplianceReport,
  AuditEvent,
  CommandReceipt,
  // MCP OAuth (starter)
  OAuthApp,
  OAuthToken
};
var DOMAIN_LIST_COUNT = Object.keys(models).length - 2;

// features/keystone/index.ts
var import_session = require("@keystone-6/core/session");

// features/keystone/mutations/index.ts
var import_schema = require("@graphql-tools/schema");

// features/keystone/mutations/redirectToInit.ts
async function redirectToInit(root, args, context) {
  const userCount = await context.sudo().query.User.count({});
  if (userCount === 0) {
    return true;
  }
  return false;
}
var redirectToInit_default = redirectToInit;

// features/keystone/mutations/index.ts
var graphql4 = String.raw;
function extendGraphqlSchema(baseSchema) {
  return (0, import_schema.mergeSchemas)({
    schemas: [baseSchema],
    typeDefs: graphql4`
      type Query {
        redirectToInit: Boolean
      }
    `,
    resolvers: {
      Query: {
        redirectToInit: redirectToInit_default
      }
    }
  });
}

// features/keystone/lib/mail.ts
var import_nodemailer = require("nodemailer");
function getBaseUrlForEmails() {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK;
  }
  console.warn("SMTP_STORE_LINK not set. Please add SMTP_STORE_LINK to your environment variables for email links to work properly.");
  return "";
}
var transport = (0, import_nodemailer.createTransport)({
  // @ts-ignore
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});
function passwordResetEmail({ url }) {
  const backgroundColor = "#f9f9f9";
  const textColor = "#444444";
  const mainBackgroundColor = "#ffffff";
  const buttonBackgroundColor = "#346df1";
  const buttonBorderColor = "#346df1";
  const buttonTextColor = "#ffffff";
  return `
    <body style="background: ${backgroundColor};">
      <table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: ${mainBackgroundColor}; max-width: 600px; margin: auto; border-radius: 10px;">
        <tr>
          <td align="center" style="padding: 10px 0px 0px 0px; font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            Please click below to reset your password
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" style="border-radius: 5px;" bgcolor="${buttonBackgroundColor}"><a href="${url}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${buttonTextColor}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${buttonBorderColor}; display: inline-block; font-weight: bold;">Reset Password</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            If you did not request this email you can safely ignore it.
          </td>
        </tr>
      </table>
    </body>
  `;
}
async function sendPasswordResetEmail(resetToken, to, baseUrl) {
  const frontendUrl = baseUrl || getBaseUrlForEmails();
  const info = await transport.sendMail({
    to,
    from: process.env.SMTP_FROM,
    subject: "Your password reset token!",
    html: passwordResetEmail({
      url: `${frontendUrl}/dashboard/reset?token=${resetToken}`
    })
  });
  if (process.env.MAIL_USER?.includes("ethereal.email")) {
    console.log(`\u{1F4E7} Message Sent!  Preview it at ${(0, import_nodemailer.getTestMessageUrl)(info)}`);
  }
}

// features/keystone/mcp-oauth/session.ts
async function resolveMcpAccessToken(context, token, listKey = "User") {
  try {
    const sudo = context.sudo();
    const record = await sudo.db.OAuthToken.findOne({ where: { token: digestToken(token) } });
    if (!record || record.tokenType !== "access_token" || record.isRevoked !== "false" || !record.userId || !record.expiresAt || new Date(record.expiresAt).getTime() <= Date.now()) {
      return void 0;
    }
    const app = await sudo.db.OAuthApp.findOne({ where: { clientId: record.clientId } });
    if (!app || app.status !== "active") return void 0;
    const mcp = {
      clientId: record.clientId,
      scopes: storedScopes(record.scopes),
      tokenId: String(record.id)
    };
    return { itemId: String(record.userId), listKey, mcp };
  } catch {
    return void 0;
  }
}
function withMcpBearerSessions(strategy, listKey = "User") {
  return {
    ...strategy,
    async get({ context }) {
      const token = bearerToken(context?.req?.headers?.authorization);
      if (isMcpAccessToken(token)) return resolveMcpAccessToken(context, token, listKey);
      return strategy.get({ context });
    }
  };
}

// features/keystone/prismaConstraints.ts
var COMPOUND_CONSTRAINTS = {
  Sequence: ['@@unique([scopeKey, kind], map: "Sequence_scope_kind_key")'],
  ScaleTicket: [
    '@@unique([yard, direction, number], map: "ScaleTicket_yard_direction_number_key")',
    '@@index([status, yard], map: "ScaleTicket_status_yard_idx")'
  ],
  AccountContact: ['@@unique([account, user], map: "AccountContact_account_user_key")'],
  PriceEntry: ['@@index([priceList, material, effectiveFrom], map: "PriceEntry_list_material_effective_idx")'],
  InventoryBalance: ['@@unique([yard, material], map: "InventoryBalance_yard_material_key")'],
  InventoryUnit: ['@@unique([yard, tagNumber], map: "InventoryUnit_yard_tag_key")'],
  ComplianceReport: ['@@unique([yard, reportDate], map: "ComplianceReport_yard_date_key")'],
  Payout: [
    '@@unique([bankAccountLabel, checkNumber], map: "Payout_bank_check_key")',
    '@@index([status, releaseAt], map: "Payout_status_release_idx")'
  ],
  Invoice: ['@@unique([number], map: "Invoice_number_key")'],
  Settlement: ['@@unique([number], map: "Settlement_number_key")'],
  SalesOrder: ['@@unique([number], map: "SalesOrder_number_key")'],
  Shipment: ['@@unique([number], map: "Shipment_number_key")'],
  ServiceRequest: ['@@unique([number], map: "ServiceRequest_number_key")'],
  DispatchJob: ['@@unique([number], map: "DispatchJob_number_key")']
};
function addDatabaseConstraints(schema) {
  for (const [modelName, directives] of Object.entries(COMPOUND_CONSTRAINTS)) {
    const pattern = new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`);
    const model = schema.match(pattern)?.[0];
    if (!model) throw new Error(`Generated Prisma schema is missing ${modelName}`);
    const resolved = directives.map(
      (directive) => directive.replace(
        /\[([^\]]+)\]/,
        (_m, fields) => `[${fields.split(",").map((f) => f.trim()).map((f) => {
          const bare = f.replace(/\(.*\)$/, "");
          return new RegExp(`\\n\\s*${bare}Id\\s`).test(model) ? f.replace(bare, `${bare}Id`) : f;
        }).join(", ")}]`
      )
    );
    const missing = resolved.filter((directive) => !model.includes(directive));
    if (!missing.length) continue;
    schema = schema.replace(model, model.replace(/\n\}$/, `
${missing.map((directive) => `  ${directive}`).join("\n")}
}`));
  }
  return schema;
}

// features/keystone/lib/keystonePrismaErrors.ts
var RAW_METHOD = /^\$(queryRaw|executeRaw|queryRawUnsafe|executeRawUnsafe|queryRawTyped|runCommandRaw)$/;
var clients = /* @__PURE__ */ new WeakMap();
var delegates = /* @__PURE__ */ new WeakMap();
function isKeystonePrismaError(value) {
  return value instanceof Error && value.extensions?.code === "KS_PRISMA_ERROR";
}
function rethrowKeystonePrismaError(value) {
  if (!isKeystonePrismaError(value)) return value;
  const prisma = value.extensions.prisma ?? {};
  throw Object.assign(value, { code: prisma.code, meta: prisma.meta, clientVersion: prisma.clientVersion });
}
function throwing(result) {
  if (!result || typeof result.then !== "function") return rethrowKeystonePrismaError(result);
  const settled = () => result.then(rethrowKeystonePrismaError);
  return new Proxy(result, {
    get(target, key) {
      if (key === "then") return (ok, fail) => settled().then(ok, fail);
      if (key === "catch") return (fail) => settled().catch(fail);
      if (key === "finally") return (done) => settled().finally(done);
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}
function throwingDelegate(delegate) {
  const cached = delegates.get(delegate);
  if (cached) return cached;
  const wrapped = new Proxy(delegate, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? (...args) => throwing(value.apply(target, args)) : value;
    }
  });
  delegates.set(delegate, wrapped);
  return wrapped;
}
function throwKeystonePrismaErrors(client) {
  const cached = clients.get(client);
  if (cached) return cached;
  const wrapped = new Proxy(client, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (key === "$transaction" && typeof value === "function") {
        return (work, ...options) => {
          if (typeof work === "function") return value.call(target, (tx) => work(throwKeystonePrismaErrors(tx)), ...options);
          return Promise.resolve(value.call(target, work, ...options)).then((results) => Array.isArray(results) ? results.map(rethrowKeystonePrismaError) : results);
        };
      }
      if (key === "$extends" && typeof value === "function") return (...args) => throwKeystonePrismaErrors(value.apply(target, args));
      if (typeof key === "string" && RAW_METHOD.test(key) && typeof value === "function") return (...args) => throwing(value.apply(target, args));
      if (typeof value === "function") return value.bind(target);
      if (typeof key === "string" && !key.startsWith("$") && value && typeof value === "object" && typeof value.findFirst === "function") return throwingDelegate(value);
      return value;
    }
  });
  clients.set(client, wrapped);
  return wrapped;
}

// features/keystone/lib/database-url.ts
var POOL_SIZES = { web: 15, worker: 5 };
var OVERRIDE_ENV = {
  web: "DATABASE_CONNECTION_LIMIT",
  worker: "DATABASE_CONNECTION_LIMIT_WORKER"
};
function pooledDatabaseUrl(url, role = "web") {
  if (!url || !/^postgres(ql)?:\/\//.test(url)) return url;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.searchParams.has("connection_limit")) return url;
  const override = Number(process.env[OVERRIDE_ENV[role]]);
  parsed.searchParams.set("connection_limit", String(Number.isInteger(override) && override > 0 ? override : POOL_SIZES[role]));
  return parsed.toString();
}

// features/keystone/lib/storage.ts
var import_node_path = __toESM(require("node:path"));

// features/keystone/lib/s3-storage.ts
function s3ForcePathStyle(endpoint) {
  let hostname = "";
  try {
    hostname = endpoint ? new URL(endpoint).hostname : "";
  } catch {
  }
  return !(hostname === "storageapi.dev" || hostname.endsWith(".storageapi.dev"));
}

// features/keystone/lib/storage.ts
var LOCAL_UPLOAD_ROOT = process.env.UPLOAD_DIR || import_node_path.default.join(process.cwd(), ".runtime", "uploads");
function s3Configured(env = process.env) {
  return Boolean(env.S3_BUCKET_NAME && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && env.S3_REGION);
}
function s3(type, prefix, signed) {
  const endpoint = process.env.S3_ENDPOINT || void 0;
  return {
    kind: "s3",
    type,
    bucketName: process.env.S3_BUCKET_NAME,
    region: process.env.S3_REGION,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    endpoint,
    pathPrefix: prefix,
    ...signed ? { signed: { expiry: 300 } } : { signed: { expiry: 5e3 } },
    forcePathStyle: s3ForcePathStyle(endpoint)
  };
}
function local(type, folder, route) {
  return {
    kind: "local",
    type,
    storagePath: import_node_path.default.join(LOCAL_UPLOAD_ROOT, folder),
    serverRoute: null,
    generateUrl: (file2) => `${route}/${folder}${file2}`,
    preserve: true
  };
}
function storageConfig() {
  if (s3Configured()) {
    return {
      my_images: s3("image", "public/", false),
      private_images: s3("image", "private/images/", true),
      private_files: s3("file", "private/files/", true)
    };
  }
  return {
    my_images: local("image", "public", "/api/uploads"),
    private_images: local("image", "private-images", "/api/private-files"),
    private_files: local("file", "private-files", "/api/private-files")
  };
}

// features/keystone/index.ts
var databaseURL = process.env.DATABASE_URL || "file:./keystone.db";
var sessionConfig = {
  maxAge: 60 * 60 * 24 * 30,
  secret: process.env.SESSION_SECRET || "this secret should only be used in development"
};
var allFlags = Object.fromEntries(ROLE_FLAGS.map((flag2) => [flag2, true]));
var { withAuth } = (0, import_auth.createAuth)({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  initFirstItem: {
    fields: ["name", "email", "password"],
    itemData: { role: { create: { name: "Owner", ...allFlags } } }
  },
  passwordResetLink: {
    async sendToken(args) {
      await sendPasswordResetEmail(args.token, args.identity);
    }
  },
  sessionData: `
    name
    email
    yards { id }
    role {
      id
      name
      ${ROLE_FLAGS.join("\n      ")}
    }
  `
});
var keystone_default = withAuth(
  (0, import_core15.config)({
    db: {
      provider: "postgresql",
      url: pooledDatabaseUrl(databaseURL),
      // Keystone returns failed queries as values; this makes them throw so transactions roll back.
      extendPrismaClient: throwKeystonePrismaErrors,
      extendPrismaSchema: addDatabaseConstraints
    },
    lists: models,
    storage: storageConfig(),
    ui: {
      isAccessAllowed: ({ session }) => session?.data.role?.canAccessDashboard ?? false
    },
    server: { maxFileSize: 12 * 1024 * 1024 },
    // MCP OAuth bearer tokens resolve to the approving user; everything else is unchanged.
    session: withMcpBearerSessions((0, import_session.statelessSessions)(sessionConfig)),
    graphql: {
      extendGraphqlSchema
    }
  })
);

// keystone.ts
var keystone_default2 = keystone_default;
//# sourceMappingURL=config.js.map
