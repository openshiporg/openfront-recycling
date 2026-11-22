"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
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

// features/integrations/payment/manual.ts
var manual_exports = {};
__export(manual_exports, {
  capturePaymentFunction: () => capturePaymentFunction,
  createPaymentFunction: () => createPaymentFunction,
  generatePaymentLinkFunction: () => generatePaymentLinkFunction,
  getPaymentStatusFunction: () => getPaymentStatusFunction,
  handleWebhookFunction: () => handleWebhookFunction,
  refundPaymentFunction: () => refundPaymentFunction
});
function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function asString(value, fallback = "") {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}
async function handleWebhookFunction() {
  throw new Error("Pay-in-person payments do not accept webhooks.");
}
async function createPaymentFunction({ amount, currency }) {
  return {
    status: "pending",
    data: {
      status: "pending",
      amount: asNumber(amount),
      currency: asString(currency, "usd").toLowerCase(),
      provider: "manual",
      settlement: "offline"
    }
  };
}
async function capturePaymentFunction() {
  throw new Error("Pay-in-person payments are not captured by a processor. Record the payment at checkout.");
}
async function refundPaymentFunction() {
  throw new Error("Pay-in-person payments are not refunded by a processor. Record a cash refund from the checkout receipt.");
}
async function getPaymentStatusFunction() {
  throw new Error("Pay-in-person payments have no processor status to check.");
}
async function generatePaymentLinkFunction() {
  return null;
}
var init_manual = __esm({
  "features/integrations/payment/manual.ts"() {
    "use strict";
  }
});

// features/integrations/payment/stripe.ts
var stripe_exports = {};
__export(stripe_exports, {
  capturePaymentFunction: () => capturePaymentFunction2,
  createPaymentFunction: () => createPaymentFunction2,
  generatePaymentLinkFunction: () => generatePaymentLinkFunction2,
  getPaymentStatusFunction: () => getPaymentStatusFunction2,
  handleWebhookFunction: () => handleWebhookFunction2,
  refundPaymentFunction: () => refundPaymentFunction2,
  stripeConfigured: () => stripeConfigured,
  verifyStripeSignature: () => verifyStripeSignature
});
function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
function secretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Card payments are not set up yet. Add the Stripe secret key in Settings \u2192 Payments, or take payment in person.");
  return key;
}
function form(values) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== void 0 && value !== "") body.append(key, String(value));
  return body;
}
async function stripe(path2, init = {}) {
  const response = await fetch(`${API}${path2}`, {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      ...init.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {},
      ...init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}
    },
    body: init.body,
    redirect: "error"
  });
  const json4 = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json4.error?.message || `Stripe request failed (${response.status}).`);
  return json4;
}
function sessionStatus(session) {
  if (session.payment_status === "paid" || session.payment_status === "no_payment_required") return "captured";
  if (session.status === "expired") return "expired";
  return "pending";
}
function asString2(value) {
  return typeof value === "string" ? value : "";
}
async function createPaymentFunction2({ amount, currency, successUrl, cancelUrl, description, idempotencyKey, metadata, customerEmail }) {
  const cents = Math.round(Number(amount));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error("Payment amount must be greater than zero.");
  const meta = metadata && typeof metadata === "object" ? metadata : {};
  const session = await stripe("/checkout/sessions", {
    method: "POST",
    idempotencyKey: asString2(idempotencyKey) || void 0,
    body: form({
      mode: "payment",
      success_url: asString2(successUrl),
      cancel_url: asString2(cancelUrl),
      .../^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asString2(customerEmail)) ? { customer_email: asString2(customerEmail) } : {},
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": asString2(currency || "usd").toLowerCase(),
      "line_items[0][price_data][unit_amount]": cents,
      "line_items[0][price_data][product_data][name]": asString2(description) || "Payment",
      ...Object.fromEntries(Object.entries(meta).map(([key, value]) => [`metadata[${key}]`, asString2(value)])),
      ...Object.fromEntries(Object.entries(meta).map(([key, value]) => [`payment_intent_data[metadata][${key}]`, asString2(value)]))
    })
  });
  return { status: sessionStatus(session), id: session.id, url: session.url, data: { id: session.id, url: session.url, status: session.status, amount: session.amount_total, provider: "stripe" } };
}
async function getPaymentStatusFunction2({ paymentId }) {
  const session = await stripe(`/checkout/sessions/${encodeURIComponent(asString2(paymentId))}?expand[]=payment_intent.latest_charge`);
  const intent = session.payment_intent && typeof session.payment_intent === "object" ? session.payment_intent : null;
  const charge = intent && intent.latest_charge && typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  const refundedAmount = charge ? charge.amount_refunded : 0;
  let status2 = sessionStatus(session);
  if (status2 === "captured" && refundedAmount > 0) status2 = refundedAmount >= (session.amount_total || 0) ? "refunded" : "partially_refunded";
  return {
    status: status2,
    amount: session.amount_total,
    currency: session.currency,
    refundedAmount,
    data: { id: session.id, status: session.status, paymentStatus: session.payment_status, paymentIntent: intent?.id || session.payment_intent, amount: session.amount_total }
  };
}
async function capturePaymentFunction2(args) {
  return getPaymentStatusFunction2(args);
}
async function refundPaymentFunction2({ paymentId, amount, idempotencyKey }) {
  const session = await stripe(`/checkout/sessions/${encodeURIComponent(asString2(paymentId))}`);
  const intentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!intentId) throw new Error("This payment has nothing to refund.");
  const refund = await stripe("/refunds", {
    method: "POST",
    idempotencyKey: asString2(idempotencyKey) || void 0,
    body: form({ payment_intent: intentId, amount: amount == null ? void 0 : Math.round(Number(amount)) })
  });
  return { status: refund.status === "succeeded" ? "refunded" : refund.status, id: refund.id, amount: refund.amount, failureMessage: refund.failure_reason || "", data: refund };
}
function verifyStripeSignature(rawBody, header, secret2, toleranceSeconds = 300, now = Date.now()) {
  if (!header || !secret2) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=")).filter((p) => p.length === 2).map(([k, v]) => [k, v]));
  const timestamp4 = Number(parts.t);
  if (!Number.isFinite(timestamp4) || Math.abs(now / 1e3 - timestamp4) > toleranceSeconds) return false;
  const expected = (0, import_node_crypto6.createHmac)("sha256", secret2).update(`${parts.t}.${rawBody}`, "utf8").digest();
  const signatures = header.split(",").map((p) => p.trim()).filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  return signatures.some((sig) => {
    if (!/^[a-f0-9]{64}$/i.test(sig)) return false;
    const received = Buffer.from(sig, "hex");
    return received.length === expected.length && (0, import_node_crypto6.timingSafeEqual)(received, expected);
  });
}
async function handleWebhookFunction2({ event, headers, rawBody }) {
  const secret2 = process.env.STRIPE_WEBHOOK_SECRET || "";
  const signature = asString2(headers?.["stripe-signature"]);
  if (!verifyStripeSignature(asString2(rawBody), signature, secret2)) return { isValid: false };
  const record = event || {};
  const object = record.data?.object || {};
  const checkoutSessionId = object.object === "checkout.session" ? object.id : "";
  return { isValid: true, eventId: record.id, type: record.type, checkoutSessionId, paymentIntentId: object.object === "payment_intent" ? object.id : object.payment_intent || "", metadata: object.metadata || {} };
}
var import_node_crypto6, API, generatePaymentLinkFunction2;
var init_stripe = __esm({
  "features/integrations/payment/stripe.ts"() {
    "use strict";
    import_node_crypto6 = require("node:crypto");
    API = "https://api.stripe.com/v1";
    generatePaymentLinkFunction2 = createPaymentFunction2;
  }
});

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
function canActOnYard(session, yardId) {
  if (!isStaff(session)) return false;
  if (seesAllYards(session)) return true;
  return Boolean(yardId) && sessionYardIds(session).includes(String(yardId));
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
    apiKeyHash: (0, import_fields3.text)({ ...serverOnlyField, isIndexed: "unique", db: { isNullable: true } }),
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
    accountNumber: (0, import_fields3.text)({ isIndexed: "unique", ...commandOnlyFieldText, db: { isNullable: true } }),
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
    inviteTokenHash: (0, import_fields3.text)({ ...serverOnlyField, isIndexed: "unique", db: { isNullable: true } }),
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
    body: (0, import_fields3.text)({ ...commandOnlyFieldText, ui: { ...commandOnlyFieldText.ui, displayMode: "textarea" } }),
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
    code: (0, import_fields3.text)({ isIndexed: "unique", ...commandOnlyFieldText, db: { isNullable: true } }),
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
          return formatTicketNumber(String(yard?.code || "YARD"), item.direction, item.number);
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
    lookupCode: (0, import_fields3.text)({ isIndexed: "unique", ...commandOnlyFieldText, db: { isNullable: true } }),
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
    checkNumber: (0, import_fields3.text)({ ...commandOnlyFieldText, db: { isNullable: true } }),
    bankAccountLabel: (0, import_fields3.text)({ ...commandOnlyFieldText, db: { isNullable: true } }),
    transferReference: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    mailToAddress: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    paidBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    paidAt: (0, import_fields3.timestamp)({ ...commandOnlyFieldText }),
    drawerSession: (0, import_fields3.relationship)({ ref: "CashDrawerSession", ...commandOnlyFieldText }),
    replaces: (0, import_fields3.relationship)({ ref: "Payout", ...commandOnlyFieldText }),
    returnReason: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    cancelReason: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    idempotencyKeyHash: (0, import_fields3.text)({ ...serverOnlyField, isIndexed: "unique", db: { isNullable: true } }),
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
    referenceKey: (0, import_fields3.text)({ isIndexed: "unique", ...commandOnlyFieldText, db: { isNullable: true } }),
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
    providerPaymentId: (0, import_fields3.text)({ isIndexed: "unique", ...commandOnlyFieldText, db: { isNullable: true } }),
    clientSecret: (0, import_fields3.text)({ ...serverOnlyField }),
    idempotencyKeyHash: (0, import_fields3.text)({ isIndexed: "unique", ...serverOnlyField, db: { isNullable: true } }),
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
    referenceKey: (0, import_fields3.text)({ isIndexed: "unique", ...commandOnlyFieldText, db: { isNullable: true } }),
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
    providerRefundId: (0, import_fields3.text)({ isIndexed: "unique", ...commandOnlyFieldText, db: { isNullable: true } }),
    failureMessage: (0, import_fields3.text)({ ...commandOnlyFieldText }),
    claim: (0, import_fields3.relationship)({ ref: "Claim", ...commandOnlyFieldText }),
    serviceRequest: (0, import_fields3.relationship)({ ref: "ServiceRequest", ...commandOnlyFieldText }),
    createdBy: (0, import_fields3.relationship)({ ref: "User", ...commandOnlyFieldText }),
    idempotencyKeyHash: (0, import_fields3.text)({ isIndexed: "unique", ...serverOnlyField, db: { isNullable: true } }),
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
    receiptNumber: (0, import_fields3.text)({ isIndexed: "unique", ...commandOnlyFieldText, db: { isNullable: true } }),
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

// features/keystone/commands/tickets.ts
var import_decimal6 = require("decimal.js");
var import_node_crypto5 = require("node:crypto");

// features/keystone/lib/command.ts
var import_node_crypto2 = require("node:crypto");
var import_graphql = require("graphql");
var CommandError = class extends import_graphql.GraphQLError {
  constructor(message, code = "COMMAND_REFUSED", extra = {}) {
    super(message, { extensions: { code, ...extra } });
  }
};
function refuse(message, extra = {}) {
  throw new CommandError(message, "COMMAND_REFUSED", extra);
}
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).filter(([, child]) => child !== void 0).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonicalize(child)])
    );
  }
  return value;
}
function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}
function hashInput(value) {
  return (0, import_node_crypto2.createHash)("sha256").update(canonicalJson(value)).digest("hex");
}
function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value, (_k, v) => typeof v === "bigint" ? Number(v) : v));
}
async function nextSequence(tx, scopeKey, kind, yardId) {
  const rows = await tx.$queryRawUnsafe(
    `INSERT INTO "Sequence" ("id", "yard", "scopeKey", "kind", "next", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 2, NOW(), NOW())
     ON CONFLICT ("scopeKey", "kind") DO UPDATE SET "next" = "Sequence"."next" + 1, "updatedAt" = NOW()
     RETURNING "next" - 1 AS value`,
    (0, import_node_crypto2.randomUUID)(),
    yardId || null,
    scopeKey,
    kind
  );
  return Number(rows[0].value);
}
function requirePermission(session, permission) {
  if (!permission) return;
  const list12 = Array.isArray(permission) ? permission : [permission];
  if (!isStaff(session) || !list12.some((flag2) => hasFlag(session, flag2))) {
    throw new CommandError("You do not have permission to do this.", "FORBIDDEN");
  }
}
function requireYard(session, yardId) {
  if (!canActOnYard(session, yardId)) throw new CommandError("You do not work at this yard.", "FORBIDDEN");
}
function isRetryable(error) {
  const code = error?.code;
  return code === "P2034" || code === "40001" || code === "40P01" || /could not serialize|deadlock detected/i.test(String(error?.message || ""));
}
async function runCommand(context, options, body) {
  const session = context.session || null;
  requirePermission(session, options.permission);
  if (options.requireSignIn && !session?.itemId) throw new CommandError("Sign in first.", "UNAUTHENTICATED");
  const actorId = session?.itemId || null;
  const key = options.idempotencyKey ? `${options.name}:${actorId || "public"}:${options.idempotencyKey}` : null;
  const payloadHash = hashInput({ name: options.name, input: options.input });
  const prisma = context.sudo().prisma;
  for (let attempt = 1; ; attempt += 1) {
    const after = [];
    try {
      const result = await prisma.$transaction(async (tx) => {
        if (key) {
          await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "recycling-command", key);
          const existing = await tx.commandReceipt.findUnique({ where: { eventKey: key } });
          if (existing) {
            if (existing.payloadHash !== payloadHash || existing.eventType !== options.name) {
              throw new CommandError("This idempotency key was already used with different input.", "IDEMPOTENCY_CONFLICT");
            }
            return { replay: true, value: existing.result };
          }
        }
        const now = /* @__PURE__ */ new Date();
        let auditIndex = 0;
        const ctx = {
          tx,
          session,
          actorId,
          now,
          afterCommit: (fn) => after.push(fn),
          sequence: (scopeKey, kind, yardId) => nextSequence(tx, scopeKey, kind, yardId),
          audit: async (event) => {
            auditIndex += 1;
            await tx.auditEvent.create({
              data: {
                eventKey: event.key || `${options.name}:${event.aggregateId}:${key || (0, import_node_crypto2.randomUUID)()}:${auditIndex}`,
                eventType: event.eventType,
                aggregateType: event.aggregateType,
                aggregateId: event.aggregateId,
                yardId: event.yardId || null,
                actorId,
                before: event.before === void 0 ? void 0 : jsonSafe(event.before),
                after: event.after === void 0 ? void 0 : jsonSafe(event.after),
                reason: event.reason || "",
                occurredAt: now
              }
            });
          }
        };
        const value = await body(ctx);
        if (key) {
          await tx.commandReceipt.create({
            data: {
              eventKey: key,
              eventType: options.name,
              aggregateType: options.aggregateType || "",
              aggregateId: String(value?.id || ""),
              payloadHash,
              result: jsonSafe(value) ?? null,
              actorId: actorId || "",
              occurredAt: now
            }
          });
        }
        return { replay: false, value };
      }, { maxWait: 1e4, timeout: 3e4 });
      if (!result.replay) {
        for (const fn of after) {
          try {
            await fn();
          } catch (error) {
            console.error(`[${options.name}] after-commit step failed`, error);
          }
        }
      }
      return result.value;
    } catch (error) {
      if (attempt < 5 && isRetryable(error)) {
        await new Promise((resolve) => setTimeout(resolve, 10 * attempt + Math.floor(Math.random() * 20)));
        continue;
      }
      throw error;
    }
  }
}
async function compareAndSet(tx, model, id, expected, data, message) {
  const statuses = Array.isArray(expected) ? expected : [expected];
  const result = await tx[model].updateMany({ where: { id, status: { in: statuses } }, data });
  if (result.count !== 1) refuse(message || `This ${model} is no longer ${statuses.join(" or ")}.`);
}
async function lockRow(tx, table, id) {
  const rows = await tx.$queryRawUnsafe(`SELECT * FROM "${table}" WHERE "id" = $1 FOR UPDATE`, id);
  return rows[0] || null;
}
function cleanKey(value) {
  const text5 = String(value ?? "").trim();
  if (!text5) return null;
  if (text5.length > 200) refuse("The idempotency key is too long.");
  return text5;
}

// features/keystone/lib/domain.ts
var import_node_crypto4 = require("node:crypto");
var import_decimal3 = require("decimal.js");

// features/keystone/lib/inventory.ts
var import_node_crypto3 = require("node:crypto");
var import_decimal2 = require("decimal.js");
async function lockBalance(tx, yardId, materialId) {
  await tx.$executeRawUnsafe(
    `INSERT INTO "InventoryBalance" ("id", "yard", "material", "onHandWeight", "reservedWeight", "heldWeight", "totalCostCents", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 0, 0, 0, 0, NOW(), NOW()) ON CONFLICT ("yard", "material") DO NOTHING`,
    (0, import_node_crypto3.randomUUID)(),
    yardId,
    materialId
  );
  const rows = await tx.$queryRawUnsafe(
    `SELECT "id", "onHandWeight"::text AS "onHand", "reservedWeight"::text AS "reserved", "heldWeight"::text AS "held", "totalCostCents" AS "cost"
     FROM "InventoryBalance" WHERE "yard" = $1 AND "material" = $2 FOR UPDATE`,
    yardId,
    materialId
  );
  const row = rows[0];
  return { id: row.id, onHand: new import_decimal2.Decimal(row.onHand), reserved: new import_decimal2.Decimal(row.reserved), held: new import_decimal2.Decimal(row.held), cost: Number(row.cost) };
}
function averageCostCents(onHand, costCents, weight2) {
  if (onHand.lte(0)) return 0;
  return new import_decimal2.Decimal(costCents).times(weight2).div(onHand).toDecimalPlaces(0, import_decimal2.Decimal.ROUND_HALF_UP).toNumber();
}
async function postMovement(tx, input) {
  const existing = await tx.inventoryMovement.findUnique({ where: { referenceKey: input.referenceKey } });
  if (existing) return { id: existing.id, created: false, costDeltaCents: existing.costDeltaCents };
  const balance = await lockBalance(tx, input.yardId, input.materialId);
  const delta = new import_decimal2.Decimal(String(input.weightDelta));
  const bucket = input.bucket || "onHand";
  let adjusted = false;
  if (bucket === "held" || bucket === "reserved") {
    const field = bucket === "held" ? "heldWeight" : "reservedWeight";
    const current = bucket === "held" ? balance.held : balance.reserved;
    const next = import_decimal2.Decimal.max(0, current.plus(delta));
    await tx.inventoryBalance.update({ where: { id: balance.id }, data: { [field]: next.toFixed(2) } });
    const movement2 = await tx.inventoryMovement.create({
      data: {
        yardId: input.yardId,
        materialId: input.materialId,
        kind: input.kind,
        weightDelta: delta.toFixed(2),
        costDeltaCents: 0,
        weightAfter: balance.onHand.toFixed(2),
        ticketId: input.ticketId || null,
        ticketLineId: input.ticketLineId || null,
        unitId: input.unitId || null,
        reason: input.reason || "",
        referenceKey: input.referenceKey,
        createdById: input.actorId || null
      }
    });
    return { id: movement2.id, created: true, costDeltaCents: 0 };
  }
  let cost = input.costDeltaCents;
  if (cost === void 0) cost = delta.isNegative() ? -averageCostCents(balance.onHand, balance.cost, delta.abs()) : 0;
  let onHand = balance.onHand.plus(delta);
  let totalCost = balance.cost + cost;
  const movement = await tx.inventoryMovement.create({
    data: {
      yardId: input.yardId,
      materialId: input.materialId,
      kind: input.kind,
      weightDelta: delta.toFixed(2),
      costDeltaCents: cost,
      weightAfter: onHand.toFixed(2),
      ticketId: input.ticketId || null,
      ticketLineId: input.ticketLineId || null,
      processingRunId: input.processingRunId || null,
      transferId: input.transferId || null,
      unitId: input.unitId || null,
      reason: input.reason || "",
      referenceKey: input.referenceKey,
      createdById: input.actorId || null
    }
  });
  if (onHand.isNegative() && !input.allowNegative) {
    const fix = onHand.abs();
    await tx.inventoryMovement.create({
      data: {
        yardId: input.yardId,
        materialId: input.materialId,
        kind: "adjust",
        weightDelta: fix.toFixed(2),
        costDeltaCents: 0,
        weightAfter: "0",
        reason: `Brought to zero after ${input.kind} (${input.referenceKey})`,
        needsReview: true,
        referenceKey: `${input.referenceKey}:zero`,
        ticketId: input.ticketId || null,
        processingRunId: input.processingRunId || null,
        transferId: input.transferId || null,
        createdById: input.actorId || null
      }
    });
    onHand = new import_decimal2.Decimal(0);
    totalCost = 0;
    adjusted = true;
  }
  if (onHand.isZero()) totalCost = 0;
  if (totalCost < 0) totalCost = 0;
  await tx.inventoryBalance.update({ where: { id: balance.id }, data: { onHandWeight: onHand.toFixed(2), totalCostCents: totalCost } });
  return { id: movement.id, created: true, costDeltaCents: cost, adjusted };
}

// features/keystone/lib/domain.ts
function randomCode(length = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = (0, import_node_crypto4.randomBytes)(length);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
function normalizeId(value) {
  return String(value || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
}
function normalizeName(first, last) {
  return `${first || ""} ${last || ""}`.trim().toLowerCase().replace(/\s+/g, " ");
}
async function businessSettings(tx) {
  return await tx.businessSettings.findFirst() || { weightUnit: "lb", currencyCode: "USD", timezone: "America/New_York", isNonprofit: false, name: "", legalName: "", ein: "" };
}
var GENERAL_PROFILE = {
  requireGovernmentId: true,
  requireIdPhoto: true,
  requireSellerPhoto: false,
  requireMaterialPhoto: true,
  requireVehiclePlate: true,
  requireSignature: true,
  requireThumbprint: false,
  minimumSellerAge: 18,
  cashLimitPerTicketCents: null,
  cashLimitPerDayCents: null,
  cashRounding: "none",
  defaultPaymentHoldDays: 0,
  defaultMaterialHoldDays: 0
};
async function yardRules(tx, yardId) {
  const yard = await tx.yard.findUnique({ where: { id: yardId }, include: { rulesProfile: { include: { restrictions: true } } } });
  if (!yard) refuse("Yard not found.");
  const profile = yard.rulesProfile;
  if (!profile) return { profile: GENERAL_PROFILE, restrictions: [] };
  return {
    profile,
    restrictions: profile.restrictions.map((r) => ({
      ...r,
      requiredDocuments: Array.isArray(r.requiredDocuments) ? r.requiredDocuments : [],
      allowedMethods: Array.isArray(r.allowedMethods) && r.allowedMethods.length ? r.allowedMethods : null
    }))
  };
}
async function doNotBuyMatch(tx, input, now = /* @__PURE__ */ new Date()) {
  const or = [];
  if (input.sellerId) or.push({ sellerId: input.sellerId });
  const name = normalizeName(input.firstName, input.lastName);
  if (name && input.dateOfBirth) {
    const day = new Date(input.dateOfBirth);
    const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
    or.push({ nameNormalized: name, dateOfBirth: { gte: start, lt: new Date(start.getTime() + 864e5) } });
  }
  for (const id of (input.idNumbers || []).map(normalizeId).filter(Boolean)) or.push({ idNumberNormalized: id });
  const plate = normalizeId(input.plate);
  if (plate) or.push({ plateNormalized: plate });
  if (!or.length) return null;
  return tx.doNotBuyEntry.findFirst({ where: { isActive: true, OR: or, AND: [{ OR: [{ expiresOn: null }, { expiresOn: { gt: now } }] }] } });
}
async function currentIdentity(tx, sellerId) {
  return tx.identityDocument.findFirst({ where: { sellerId, isCurrent: true }, orderBy: [{ expiresOn: "desc" }, { createdAt: "desc" }] });
}
async function refreshDuePayouts(tx, now = /* @__PURE__ */ new Date(), where = {}) {
  const params = [now];
  let filter = "";
  if (where.ticketId) {
    params.push(where.ticketId);
    filter += ` AND p."ticket" = $${params.length}`;
  }
  if (where.payoutId) {
    params.push(where.payoutId);
    filter += ` AND p."id" = $${params.length}`;
  }
  await tx.$executeRawUnsafe(
    `UPDATE "Payout" p SET "status" = 'ready', "updatedAt" = NOW()
     WHERE p."status" = 'held' AND p."releaseAt" IS NOT NULL AND p."releaseAt" <= $1 ${filter}
       AND NOT EXISTS (SELECT 1 FROM "HoldTag" h WHERE h."ticket" = p."ticket" AND h."status" = 'police_hold')`,
    ...params
  );
}
async function hasPoliceHold(tx, ticketId) {
  if (!ticketId) return false;
  return Boolean(await tx.holdTag.findFirst({ where: { ticketId, status: "police_hold" } }));
}
async function maybeSettleTicket(tx, ticketId, now = /* @__PURE__ */ new Date()) {
  const ticket = await tx.scaleTicket.findUnique({ where: { id: ticketId }, include: { payouts: true, settlement: true } });
  if (!ticket || ticket.status !== "completed") return false;
  let settled = false;
  if (ticket.paymentMode === "on_account") settled = ticket.settlement?.status === "paid";
  else if (ticket.totalCents < 0) {
    const invoice = await tx.invoice.findFirst({ where: { ticketId, kind: "fee_ticket", status: { not: "void" } } });
    settled = invoice?.status === "paid" || ticket.collectedCents >= -ticket.totalCents;
  } else {
    const live = ticket.payouts.filter((p) => p.status !== "cancelled" && p.status !== "returned");
    settled = live.every((p) => p.status === "paid");
  }
  if (!settled) return false;
  const won = await tx.scaleTicket.updateMany({ where: { id: ticketId, status: "completed" }, data: { status: "settled", settledAt: now } });
  return won.count === 1;
}

// features/keystone/lib/pricing.ts
async function currentEntry(tx, priceListId, materialId, at) {
  if (!priceListId) return null;
  return tx.priceEntry.findFirst({
    where: {
      priceListId,
      materialId,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }]
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }]
  });
}
async function resolvePrice(tx, input) {
  const at = input.at || /* @__PURE__ */ new Date();
  const candidates = [];
  if (input.accountId) {
    const account = await tx.account.findUnique({ where: { id: input.accountId }, include: { priceList: true } });
    if (account?.priceList?.isActive) candidates.push({ listId: account.priceList.id, source: account.priceList.kind === "contract" ? "contract" : "price_list" });
  }
  if (input.sellerId) {
    const seller = await tx.seller.findUnique({ where: { id: input.sellerId }, include: { priceList: true } });
    if (seller?.priceList?.isActive) candidates.push({ listId: seller.priceList.id, source: seller.priceList.kind === "contract" ? "contract" : "price_list" });
  }
  const yard = await tx.yard.findUnique({ where: { id: input.yardId } });
  candidates.push({ listId: yard?.boardPriceListId || null, source: "board" });
  candidates.sort((a, b) => (a.source === "contract" ? 0 : a.source === "price_list" ? 1 : 2) - (b.source === "contract" ? 0 : b.source === "price_list" ? 1 : 2));
  for (const candidate of candidates) {
    const entry = await currentEntry(tx, candidate.listId, input.materialId, at);
    if (entry) return { unitPrice: String(entry.unitPrice), unit: entry.unit, source: candidate.source, priceEntryId: entry.id };
  }
  return null;
}

// features/recycling/ticketMath.ts
var import_decimal4 = require("decimal.js");
var LB_FACTORS = { lb: 1, cwt: 100, net_ton: 2e3, gross_ton: 2240, each: 1 };
var KG_FACTORS = { kg: 1, metric_tonne: 1e3, each: 1 };
var TicketMathError = class extends Error {
};
function unitFactor(unit, base = "lb") {
  const factor = (base === "kg" ? KG_FACTORS : LB_FACTORS)[unit];
  if (!factor) throw new TicketMathError(`The unit "${unit}" cannot be used when weights are kept in ${base}.`);
  return factor;
}
function dec(value) {
  if (value === null || value === void 0 || value === "") return new import_decimal4.Decimal(0);
  if (import_decimal4.Decimal.isDecimal(value)) return value;
  return new import_decimal4.Decimal(String(value));
}
function roundCents(value) {
  const sign = value.isNegative() ? -1 : 1;
  return sign * value.abs().toDecimalPlaces(0, import_decimal4.Decimal.ROUND_HALF_UP).toNumber();
}
function computeLine(line, base = "lb") {
  const factor = unitFactor(line.unit, base);
  const price = dec(line.unitPrice);
  if (price.isNegative()) throw new TicketMathError("A unit price cannot be negative; use a charge material instead.");
  if (line.unit === "each") {
    const quantity = Number(line.quantity ?? 0);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new TicketMathError("An item priced each needs a whole quantity above zero.");
    const gross2 = dec(line.grossWeight);
    const tare2 = dec(line.tareWeight);
    const net2 = gross2.gt(0) ? gross2.minus(tare2) : new import_decimal4.Decimal(0);
    const amount2 = roundCents(price.times(quantity).times(100));
    const signed2 = line.direction === "charge_customer" ? -amount2 : amount2;
    return { netWeight: net2.toDecimalPlaces(2), deduction: new import_decimal4.Decimal(0), payWeight: new import_decimal4.Decimal(quantity), amountCents: amount2, signedAmountCents: signed2 };
  }
  const gross = dec(line.grossWeight);
  const tare = dec(line.tareWeight);
  const net = gross.minus(tare);
  if (!net.gt(0)) throw new TicketMathError("Gross weight must be more than tare weight.");
  let deduction;
  if (line.deductionWeight !== null && line.deductionWeight !== void 0 && line.deductionWeight !== "") {
    deduction = dec(line.deductionWeight);
  } else if (line.deductionPercent !== null && line.deductionPercent !== void 0 && line.deductionPercent !== "") {
    const pct = dec(line.deductionPercent);
    if (pct.isNegative() || pct.gt(100)) throw new TicketMathError("A deduction percent must be between 0 and 100.");
    deduction = net.times(pct).div(100).toDecimalPlaces(2, import_decimal4.Decimal.ROUND_HALF_UP);
  } else {
    deduction = new import_decimal4.Decimal(0);
  }
  if (deduction.isNegative()) throw new TicketMathError("A deduction cannot be negative.");
  const payWeight = net.minus(deduction);
  if (payWeight.isNegative()) throw new TicketMathError("The deduction is larger than the net weight.");
  const amount = roundCents(payWeight.times(price).div(factor).times(100));
  const signed = line.direction === "charge_customer" ? -amount : amount;
  return { netWeight: net.toDecimalPlaces(2), deduction: deduction.toDecimalPlaces(2), payWeight: payWeight.toDecimalPlaces(2), amountCents: amount, signedAmountCents: signed };
}
function computeTicketTotals(lines, fees = [], feeTaxRatePercent = 0) {
  const materialTotalCents = lines.reduce((sum, line) => sum + line.signedAmountCents, 0);
  const feeTotalCents = fees.reduce((sum, fee) => sum + Math.trunc(Number(fee.amountCents) || 0), 0);
  const chargeBase = lines.filter((l) => l.signedAmountCents < 0).reduce((s, l) => s - l.signedAmountCents, 0) + fees.filter((f) => f.amountCents < 0).reduce((s, f) => s - f.amountCents, 0);
  const taxCents = roundCents(new import_decimal4.Decimal(chargeBase).times(dec(feeTaxRatePercent)).div(100));
  return { materialTotalCents, feeTotalCents, taxCents, totalCents: materialTotalCents + feeTotalCents - taxCents };
}
function roundCashUpToNickel(cents) {
  return Math.ceil(cents / 5) * 5;
}
function sequentialLineWeights(weights) {
  if (weights.length < 2) throw new TicketMathError("Truck-scale weighing needs a full weight and at least one weight after unloading.");
  const values = weights.map(dec);
  const out = [];
  for (let i = 1; i < values.length; i += 1) {
    if (!values[i - 1].gt(values[i])) throw new TicketMathError(`Weight ${i + 1} must be lower than the weight before it.`);
    out.push({ gross: values[i - 1], tare: values[i] });
  }
  return out;
}

// features/recycling/compliance.ts
function ageOn(dob, now) {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || m === 0 && now.getUTCDate() < dob.getUTCDate()) age -= 1;
  return age;
}
function restrictionsForLine(line, restrictions) {
  return restrictions.filter((r) => r.materialId && r.materialId === line.materialId || !r.materialId && r.categoryId && r.categoryId === line.categoryId);
}
function screenSeller(input) {
  const now = input.now || /* @__PURE__ */ new Date();
  const out = [];
  const { seller, identity, profile } = input;
  if (input.isCommercial) return out;
  if (!seller) {
    out.push({ code: "seller_required", message: "A seller is needed for a retail ticket.", overridable: false });
    return out;
  }
  if (seller.status === "do_not_buy") out.push({ code: "do_not_buy", message: "This seller is on the do-not-buy list. The yard cannot buy from them.", overridable: false });
  if (seller.doNotBuyMatch) out.push({ code: "do_not_buy_list", message: "This seller matches an entry on the do-not-buy list.", overridable: false });
  if (profile.minimumSellerAge > 0) {
    if (!seller.dateOfBirth) out.push({ code: "date_of_birth", message: "Date of birth is needed to check the minimum age.", overridable: true });
    else if (ageOn(new Date(seller.dateOfBirth), now) < profile.minimumSellerAge) out.push({ code: "minimum_age", message: `The seller must be at least ${profile.minimumSellerAge}.`, overridable: false });
  }
  if (profile.requireGovernmentId) {
    if (!identity) out.push({ code: "government_id", message: "A government ID must be on file.", overridable: true });
    else if (identity.expiresOn && new Date(identity.expiresOn).getTime() < now.getTime()) out.push({ code: "id_expired", message: "The ID on file has expired.", overridable: true });
  }
  return out;
}
function validateTicketCompliance(ticket, profile, restrictions) {
  const out = [];
  const now = ticket.now || /* @__PURE__ */ new Date();
  if (!ticket.lines.length) out.push({ code: "no_lines", message: "Add at least one line.", overridable: false });
  for (const line of ticket.lines) {
    if (!line.materialId) out.push({ code: "line_material", message: "Every line needs a material.", lineId: line.id, overridable: false });
    if (!line.hasPrice) out.push({ code: "line_price", message: `${line.materialName || "A line"} has no price.`, lineId: line.id, overridable: false });
  }
  if (ticket.direction !== "inbound" || ticket.isAdjustment) return out;
  if (!ticket.isCommercial) {
    out.push(...screenSeller({ seller: ticket.seller, identity: ticket.identity, profile, isCommercial: false, now }));
    if (profile.requireIdPhoto && ticket.identity && !ticket.identity.hasFrontImage) out.push({ code: "id_photo", message: "A photo of the ID is needed.", overridable: true });
    const kinds = new Set(ticket.attachments.map((a) => a.kind));
    if (profile.requireSellerPhoto && !kinds.has("seller_photo")) out.push({ code: "seller_photo", message: "Take a photo of the seller.", overridable: true });
    if (profile.requireMaterialPhoto && !kinds.has("material_photo")) out.push({ code: "material_photo", message: "Take a photo of the material.", overridable: true });
    if (profile.requireVehiclePlate && !String(ticket.vehiclePlate || "").trim()) out.push({ code: "vehicle_plate", message: "Record the vehicle plate.", overridable: true });
    if (profile.requireSignature && !kinds.has("signature")) out.push({ code: "signature", message: "The seller must sign the ownership statement.", overridable: true });
    if (profile.requireThumbprint && !kinds.has("thumbprint") && !ticket.identity?.hasThumbprint) out.push({ code: "thumbprint", message: "A thumbprint image is needed.", overridable: true });
  }
  for (const line of ticket.lines) {
    for (const r of restrictionsForLine(line, restrictions)) {
      if (r.kind === "prohibited") out.push({ code: "prohibited", message: `${r.label}: the yard does not buy this material.`, lineId: line.id, overridable: false });
      if (r.kind === "commercial_only" && !ticket.isCommercial) out.push({ code: "commercial_only", message: `${r.label}: only bought from commercial accounts.`, lineId: line.id, overridable: false });
      const needed = (r.requiredDocuments || []).filter(Boolean);
      if (r.kind === "proof_of_ownership" && !needed.length) needed.push("proof_of_ownership");
      const have = /* @__PURE__ */ new Set([...line.documents || [], ...ticket.attachments.filter((a) => a.kind === "ownership_document" && (!a.lineId || a.lineId === line.id)).map(() => "proof_of_ownership")]);
      for (const doc of needed) {
        if (!have.has(doc) && !(doc !== "proof_of_ownership" && (line.documents || []).includes(doc))) {
          out.push({ code: `document_${doc}`, message: `${r.label}: ${doc.replace(/_/g, " ")} is needed.`, lineId: line.id, overridable: false });
        }
      }
    }
  }
  return out;
}
function blockingItems(items, override) {
  if (override?.reason && override.reason.trim().length >= 3) return items.filter((i) => !i.overridable);
  return items;
}
function splitPayouts(input) {
  const base = input.yardMethods.length ? input.yardMethods : ["cash", "check", "transfer"];
  const groups = /* @__PURE__ */ new Map();
  const defaultHold = Number(input.profile.defaultPaymentHoldDays || 0);
  let adjust = Number(input.extraCents || 0);
  for (const line of input.lines) {
    if (line.signedAmountCents <= 0) {
      adjust += line.signedAmountCents;
      continue;
    }
    let methods = [...base];
    let holdDays = defaultHold;
    let mailCheckOnly = false;
    for (const r of restrictionsForLine(line, input.restrictions)) {
      if (r.forbidCash) methods = methods.filter((m) => m !== "cash");
      if (r.allowedMethods?.length) methods = methods.filter((m) => r.allowedMethods.includes(m));
      if (r.mailCheckOnly) {
        mailCheckOnly = true;
        methods = methods.filter((m) => m === "check" || m === "transfer");
      }
      holdDays = Math.max(holdDays, Number(r.paymentHoldDays || 0));
    }
    methods.sort();
    const releaseAt = holdDays > 0 ? new Date(input.completedAt.getTime() + holdDays * 864e5) : null;
    const key = `${methods.join(",")}|${releaseAt ? releaseAt.toISOString() : "now"}|${mailCheckOnly}`;
    const group = groups.get(key) || { lineIds: [], amountCents: 0, allowedMethods: methods, releaseAt, mailCheckOnly };
    group.lineIds.push(line.id);
    group.amountCents += line.signedAmountCents;
    groups.set(key, group);
  }
  const list12 = [...groups.values()].sort((a, b) => (a.releaseAt?.getTime() || 0) - (b.releaseAt?.getTime() || 0) || b.allowedMethods.length - a.allowedMethods.length);
  for (const group of list12) {
    if (adjust >= 0) break;
    const take = Math.min(group.amountCents, -adjust);
    group.amountCents -= take;
    adjust += take;
  }
  if (adjust > 0 && list12.length) list12[0].amountCents += adjust;
  return list12.filter((g) => g.amountCents > 0);
}

// features/keystone/lib/sales.ts
var import_decimal5 = require("decimal.js");
async function startShipmentLoading(ctx, shipmentId) {
  const shipment = await lockRow(ctx.tx, "Shipment", shipmentId);
  if (!shipment) refuse("Shipment not found.");
  if (shipment.status !== "scheduled") refuse(`This shipment is ${shipment.status}; only a scheduled shipment can start loading.`);
  await compareAndSet(ctx.tx, "shipment", shipmentId, "scheduled", { status: "loading" });
  const order = await ctx.tx.salesOrder.findUnique({ where: { id: shipment.order } });
  if (!order || !["confirmed", "in_fulfilment"].includes(order.status)) refuse("The sales order is not confirmed.");
  return { shipment, order };
}
async function orderLinePrice(tx, shipmentId, materialId) {
  const shipment = await tx.shipment.findUnique({ where: { id: shipmentId }, include: { order: { include: { lines: true } } } });
  const line = shipment?.order?.lines.find((l) => l.materialId === materialId);
  if (!line || line.unitPrice === null) return null;
  return { unitPrice: new import_decimal5.Decimal(String(line.unitPrice)).toFixed(5), unit: line.unit, orderLineId: line.id };
}
function withinTolerance(shipped, ordered, tolerancePercent) {
  return shipped.gte(ordered.times(new import_decimal5.Decimal(100).minus(tolerancePercent)).div(100));
}
async function loadShipmentFromTicket(ctx, ticket, totals) {
  const { tx, now } = ctx;
  if (!ticket.shipmentId) refuse("An outbound ticket must be for a shipment.");
  const shipment = await lockRow(tx, "Shipment", ticket.shipmentId);
  if (!shipment || shipment.status !== "loading") refuse("The shipment is not loading.");
  const order = await tx.salesOrder.findUnique({ where: { id: shipment.order }, include: { lines: true, account: true } });
  if (!order) refuse("Sales order not found.");
  const settings = await tx.businessSettings.findFirst() || { weightUnit: "lb" };
  const base = settings.weightUnit === "kg" ? "kg" : "lb";
  const units = await tx.inventoryUnit.findMany({ where: { shipmentId: shipment.id } });
  const byMaterial = /* @__PURE__ */ new Map();
  for (const line of ticket.lines) byMaterial.set(line.materialId, (byMaterial.get(line.materialId) || new import_decimal5.Decimal(0)).plus(String(line.payWeight)));
  for (const unit of units) if (!byMaterial.has(unit.materialId)) byMaterial.set(unit.materialId, new import_decimal5.Decimal(0));
  for (const unit of units) {
    if (!ticket.lines.some((l) => l.materialId === unit.materialId)) byMaterial.set(unit.materialId, byMaterial.get(unit.materialId).plus(String(unit.weight)));
  }
  if (!byMaterial.size) refuse("Nothing was loaded.");
  const invoiceLines = [];
  let shippedTotal = new import_decimal5.Decimal(0);
  for (const [materialId, weight2] of byMaterial) {
    const orderLine = order.lines.find((l) => l.materialId === materialId);
    if (!orderLine) refuse("A loaded material is not on the sales order.");
    shippedTotal = shippedTotal.plus(weight2);
    await postMovement(tx, { yardId: ticket.yardId, materialId, kind: "ship", weightDelta: weight2.negated(), referenceKey: `shipment:${shipment.id}:material:${materialId}:ship`, ticketId: ticket.id, actorId: ctx.actorId, reason: `Shipment ${shipment.number}` });
    const release2 = import_decimal5.Decimal.min(new import_decimal5.Decimal(String(orderLine.reservedWeight)), weight2);
    if (release2.gt(0)) await postMovement(tx, { yardId: ticket.yardId, materialId, kind: "release", weightDelta: release2.negated(), bucket: "reserved", referenceKey: `shipment:${shipment.id}:material:${materialId}:unreserve`, ticketId: ticket.id, actorId: ctx.actorId });
    await tx.salesOrderLine.update({ where: { id: orderLine.id }, data: { shippedWeight: new import_decimal5.Decimal(String(orderLine.shippedWeight)).plus(weight2).toFixed(2), reservedWeight: new import_decimal5.Decimal(String(orderLine.reservedWeight)).minus(release2).toFixed(2) } });
    const amountCents = roundCents(weight2.times(String(orderLine.unitPrice ?? 0)).div(unitFactor(orderLine.unit, base)).times(100));
    invoiceLines.push({ description: orderLine.materialName, materialId, weight: weight2.toFixed(2), unit: orderLine.unit, unitPrice: String(orderLine.unitPrice ?? 0), amountCents, kind: "material" });
  }
  for (const unit of units) {
    const won = await tx.inventoryUnit.updateMany({ where: { id: unit.id, status: "allocated", shipmentId: shipment.id }, data: { status: "shipped" } });
    if (won.count !== 1) refuse(`Unit ${unit.tagNumber} is no longer allocated to this shipment.`);
  }
  if (shipment.freightCents) invoiceLines.push({ description: "Freight", amountCents: shipment.freightCents, kind: "freight" });
  const subtotal = invoiceLines.reduce((s, l) => s + l.amountCents, 0);
  const number = await ctx.sequence("business", "invoice");
  const invoice = await tx.invoice.create({
    data: {
      number,
      accountId: order.accountId,
      kind: "sale",
      status: subtotal > 0 ? "open" : "paid",
      subtotalCents: subtotal,
      taxCents: 0,
      totalCents: subtotal,
      dueOn: order.paymentTerms === "prepay" ? now : new Date(now.getTime() + Number(order.netDays || 0) * 864e5),
      shipmentId: shipment.id,
      lines: { create: invoiceLines }
    }
  });
  const release = order.paymentTerms !== "prepay" || subtotal <= 0;
  await compareAndSet(tx, "shipment", shipment.id, "loading", {
    status: release ? "released" : "loaded",
    shippedWeight: shippedTotal.toFixed(2),
    invoiceId: invoice.id,
    releasedAt: release ? now : null,
    lines: [...byMaterial].map(([materialId, weight2]) => ({ materialId, weight: weight2.toFixed(2) }))
  });
  if (order.status === "confirmed") await compareAndSet(tx, "salesOrder", order.id, "confirmed", { status: "in_fulfilment" });
  await maybeFulfilOrder(tx, order.id);
  await ctx.audit({ eventType: "shipment.loaded", aggregateType: "Shipment", aggregateId: shipment.id, after: { shippedWeight: shippedTotal.toFixed(2), invoiceId: invoice.id, released: release, totalCents: totals.totalCents } });
  return { invoiceId: invoice.id };
}
async function maybeFulfilOrder(tx, orderId) {
  const order = await tx.salesOrder.findUnique({ where: { id: orderId }, include: { lines: true } });
  if (!order || order.status !== "in_fulfilment") return false;
  const done = order.lines.every((l) => withinTolerance(new import_decimal5.Decimal(String(l.shippedWeight)), new import_decimal5.Decimal(String(l.weight)), new import_decimal5.Decimal(String(l.tolerancePercent ?? 5))));
  if (!done) return false;
  const won = await tx.salesOrder.updateMany({ where: { id: orderId, status: "in_fulfilment" }, data: { status: "fulfilled" } });
  return won.count === 1;
}
async function maybeCloseOrder(tx, orderId) {
  const order = await tx.salesOrder.findUnique({ where: { id: orderId }, include: { shipments: { include: { invoice: true } } } });
  if (!order || order.status !== "fulfilled") return false;
  const live = order.shipments.filter((s) => s.status !== "cancelled");
  if (!live.length || live.some((s) => !s.invoice || s.invoice.status !== "paid")) return false;
  const openClaim = await tx.claim.findFirst({ where: { shipmentId: { in: live.map((s) => s.id) }, status: "open" } });
  if (openClaim) return false;
  const won = await tx.salesOrder.updateMany({ where: { id: orderId, status: "fulfilled" }, data: { status: "closed" } });
  return won.count === 1;
}
async function afterSaleInvoicePaid(tx, invoice, now = /* @__PURE__ */ new Date()) {
  if (!invoice.shipmentId) return;
  await tx.shipment.updateMany({ where: { id: invoice.shipmentId, status: "loaded" }, data: { status: "released", releasedAt: now } });
  const shipment = await tx.shipment.findUnique({ where: { id: invoice.shipmentId } });
  if (shipment?.orderId) await maybeCloseOrder(tx, shipment.orderId);
}

// features/keystone/commands/tickets.ts
var TICKET_USERS = ["canManageTickets", "canGradeTickets"];
var MANAGER = "canApproveVariances";
async function lockOpenTicket(tx, ctx, ticketId) {
  const row = await lockRow(tx, "ScaleTicket", ticketId);
  if (!row) refuse("Ticket not found.");
  requireYard(ctx.session, row.yard);
  if (row.status !== "open") refuse("This ticket is not open. Lines, weights and prices change only while a ticket is open.");
  return row;
}
function mathGuard(fn) {
  try {
    return fn();
  } catch (error) {
    if (error instanceof TicketMathError) refuse(error.message);
    throw error;
  }
}
function visitExpiresAt(plannedDate) {
  const day = new Date(Date.UTC(plannedDate.getUTCFullYear(), plannedDate.getUTCMonth(), plannedDate.getUTCDate()));
  return new Date(day.getTime() + 2 * 864e5);
}
async function openTicketTx(ctx, input) {
  const { tx } = ctx;
  requireYard(ctx.session, input.yardId);
  const yard = await tx.yard.findUnique({ where: { id: input.yardId } });
  if (!yard || yard.status !== "active") refuse("This yard is not active.");
  const direction = input.direction === "outbound" ? "outbound" : "inbound";
  let sellerId = input.sellerId || null;
  let vehicleId = input.vehicleId || null;
  let donatePercent = Math.max(0, Math.min(100, Math.trunc(Number(input.donatePercent || 0))));
  let nonprofitId = input.nonprofitId || null;
  let campaignId = input.campaignId || null;
  let visitId = null;
  if (input.visitCode) {
    const visit = await tx.visit.findUnique({ where: { code: String(input.visitCode).trim().toUpperCase() } });
    if (!visit) refuse("No visit has that code.");
    if (visit.yardId !== input.yardId) refuse("That visit is booked at another yard.");
    if (visit.status !== "booked") refuse(`That visit is ${visit.status}.`);
    if (visitExpiresAt(visit.plannedDate).getTime() <= ctx.now.getTime()) {
      await tx.visit.updateMany({ where: { id: visit.id, status: "booked" }, data: { status: "expired" } });
      refuse("That visit has expired.");
    }
    await compareAndSet(tx, "visit", visit.id, "booked", { status: "arrived" }, "That visit was already used.");
    visitId = visit.id;
    sellerId = sellerId || visit.sellerId;
    vehicleId = vehicleId || visit.vehicleId;
    if (!input.donatePercent && visit.donatePercent) donatePercent = visit.donatePercent;
    nonprofitId = nonprofitId || visit.nonprofitId;
    campaignId = campaignId || visit.campaignId;
  }
  let paymentMode = input.paymentMode || "pay_now";
  let account = null;
  if (input.accountId) {
    account = await tx.account.findUnique({ where: { id: input.accountId } });
    if (!account) refuse("Account not found.");
    if (account.status !== "active") refuse("This account is suspended and cannot open tickets.");
    if (!input.paymentMode) paymentMode = account.paymentTerms === "on_account" ? "on_account" : "pay_now";
  }
  if (!["pay_now", "on_account", "donation_only", "customer_pays"].includes(paymentMode)) refuse("Payment mode is not valid.");
  if (paymentMode === "on_account" && !account) refuse("Only a commercial account can be put on account.");
  let vehicle = null;
  if (vehicleId) {
    vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle || vehicle.isRemoved) refuse("Vehicle not found.");
  }
  const plate = String(input.vehiclePlate ?? vehicle?.plate ?? "").replace(/\s+/g, "").toUpperCase();
  let screening = [];
  if (direction === "inbound" && !account) {
    if (!sellerId) refuse("Find or add the seller first.");
    const seller = await tx.seller.findUnique({ where: { id: sellerId } });
    if (!seller) refuse("Seller not found.");
    const identity = await currentIdentity(tx, seller.id);
    const listMatch = await doNotBuyMatch(tx, { sellerId: seller.id, firstName: seller.firstName, lastName: seller.lastName, dateOfBirth: seller.dateOfBirth, idNumbers: identity ? [identity.number] : [], plate }, ctx.now);
    const { profile } = await yardRules(tx, input.yardId);
    screening = screenSeller({
      seller: { status: seller.status, dateOfBirth: seller.dateOfBirth, doNotBuyMatch: Boolean(listMatch) },
      identity: identity ? { expiresOn: identity.expiresOn, hasFrontImage: Boolean(identity.frontImage_id) } : null,
      profile,
      isCommercial: false,
      now: ctx.now
    });
    const blocking = screening.filter((item) => !item.overridable);
    if (blocking.length) throw new CommandError(blocking.map((b) => b.message).join(" "), "SCREENING_BLOCKED", { items: blocking });
    if (screening.length) {
      if (!input.overrideReason || input.overrideReason.trim().length < 3 || !hasFlag(ctx.session, MANAGER)) {
        throw new CommandError(`${screening.map((s) => s.message).join(" ")} A manager may override with a written reason.`, "SCREENING_NEEDS_OVERRIDE", { items: screening });
      }
    }
  }
  if (nonprofitId) {
    const np = await tx.account.findUnique({ where: { id: nonprofitId } });
    if (!np?.isNonprofit || np.status !== "active") refuse("Donations go only to an active partner nonprofit.");
  }
  if (campaignId) {
    const campaign = await tx.donationCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign || campaign.status !== "active") refuse("That campaign is not active.");
    nonprofitId = nonprofitId || campaign.accountId;
  }
  if (donatePercent > 0 && !nonprofitId) {
    const settings = await businessSettings(tx);
    if (!settings.isNonprofit) refuse("Choose the nonprofit or campaign that receives the donation.");
  }
  if (direction === "outbound") {
    if (!input.shipmentId) refuse("An outbound ticket is opened for a shipment.");
    const { order } = await startShipmentLoading(ctx, input.shipmentId);
    if (order.yardId !== input.yardId) refuse("That shipment ships from another yard.");
    account = await tx.account.findUnique({ where: { id: order.accountId } });
    paymentMode = "customer_pays";
  }
  const number = await ctx.sequence(`yard:${input.yardId}`, `${direction}_ticket`, input.yardId);
  const ticket = await tx.scaleTicket.create({
    data: {
      yardId: input.yardId,
      direction,
      number,
      status: "open",
      sellerId,
      accountId: account?.id || null,
      siteId: input.siteId || null,
      vehicleId,
      vehiclePlate: plate,
      vehiclePlateRegion: String(input.vehiclePlateRegion ?? vehicle?.plateRegion ?? ""),
      vehicleDescription: String(input.vehicleDescription ?? (vehicle ? [vehicle.color, vehicle.make, vehicle.model].filter(Boolean).join(" ") : "")),
      visitId,
      jobId: input.jobId || null,
      containerId: input.containerId || null,
      shipmentId: input.shipmentId || null,
      paymentMode,
      donatePercent,
      nonprofitId,
      campaignId,
      lookupCode: randomCode(8),
      overrideReason: screening.length ? String(input.overrideReason) : "",
      overrideById: screening.length ? ctx.actorId : null,
      openedById: ctx.actorId,
      notes: input.notes || "",
      fees: []
    }
  });
  await ctx.audit({ eventType: "ticket.opened", aggregateType: "ScaleTicket", aggregateId: ticket.id, yardId: input.yardId, after: { number, direction, sellerId, accountId: account?.id || null }, reason: screening.length ? `Screening override: ${input.overrideReason}` : void 0 });
  if (screening.length) await ctx.audit({ eventType: "ticket.screening_override", aggregateType: "ScaleTicket", aggregateId: ticket.id, yardId: input.yardId, after: { items: screening }, reason: String(input.overrideReason) });
  return ticket;
}
async function readStableScale(tx, scaleId, yardId, now) {
  const scale = await tx.scale.findUnique({ where: { id: scaleId } });
  if (!scale || scale.yardId !== yardId || !scale.isActive) refuse("That scale is not at this yard.");
  if (!scale.lastReadingAt || !scale.lastReadingStable || now.getTime() - new Date(scale.lastReadingAt).getTime() > 1e4 || scale.lastReadingWeight === null) {
    refuse("The scale has no stable reading from the last 10 seconds. Type the weight instead.");
  }
  return { scale, weight: new import_decimal6.Decimal(String(scale.lastReadingWeight)) };
}
async function priceLine(ctx, ticket, material, input) {
  if (input.unitPrice !== void 0 && input.unitPrice !== null && input.unitPrice !== "") {
    if (!hasFlag(ctx.session, "canOverridePrices")) refuse("Changing a price needs the price override permission.");
    if (!input.overrideReason || input.overrideReason.trim().length < 3) refuse("Give a reason for the price override.");
    const price = dec(input.unitPrice);
    if (price.isNegative()) refuse("A unit price cannot be negative.");
    return { unitPrice: price.toFixed(5), unit: material.defaultUnit, source: "override", priceEntryId: null, overrideById: ctx.actorId, overrideReason: input.overrideReason.trim() };
  }
  if (ticket.direction === "outbound") {
    if (!ticket.shipment) refuse("An outbound ticket must be for a shipment.");
    const sale = await orderLinePrice(ctx.tx, ticket.shipment, material.id);
    if (!sale) refuse("This material is not on the sales order for the shipment.");
    return { unitPrice: sale.unitPrice, unit: sale.unit, source: "price_list", priceEntryId: null, overrideById: null, overrideReason: "" };
  }
  const snap = await resolvePrice(ctx.tx, { yardId: ticket.yard, materialId: material.id, accountId: ticket.account, sellerId: ticket.seller, at: ctx.now });
  if (!snap) return { unitPrice: null, unit: material.defaultUnit, source: null, priceEntryId: null, overrideById: null, overrideReason: "" };
  return { unitPrice: new import_decimal6.Decimal(snap.unitPrice).toFixed(5), unit: snap.unit, source: snap.source, priceEntryId: snap.priceEntryId, overrideById: null, overrideReason: "" };
}
function lineDirection(ticket, material, requested) {
  if (ticket.isAdjustment && (requested === "pay_seller" || requested === "charge_customer")) return requested;
  return material.direction === "charge_customer" ? "charge_customer" : "pay_seller";
}
async function addTicketLineTx(ctx, input) {
  const { tx } = ctx;
  const ticket = await lockOpenTicket(tx, ctx, input.ticketId);
  const material = await tx.material.findUnique({ where: { id: input.materialId } });
  if (!material || !material.isActive) refuse("Material not found.");
  const settings = await businessSettings(tx);
  const base = settings.weightUnit === "kg" ? "kg" : "lb";
  let gross = input.grossWeight;
  let tare = input.tareWeight;
  const events = [];
  if (input.grossFromScale || input.tareFromScale) {
    if (!input.scaleId) refuse("Pick the scale to read.");
    const reading = await readStableScale(tx, input.scaleId, ticket.yard, ctx.now);
    if (input.grossFromScale) gross = reading.weight.toFixed(2);
    else tare = reading.weight.toFixed(2);
  }
  if (input.tareWeight === void 0 && !input.tareFromScale && material.standardContainerTare !== null && material.standardContainerTare !== void 0) tare = String(material.standardContainerTare);
  if (gross !== null && gross !== void 0 && gross !== "") events.push({ kind: "gross", weight: dec(gross).toFixed(2), method: input.grossFromScale ? "scale" : "manual", scaleId: input.scaleId || null });
  if (tare !== null && tare !== void 0 && tare !== "") events.push({ kind: "tare", weight: dec(tare).toFixed(2), method: input.tareFromScale ? "scale" : "manual", scaleId: input.scaleId || null });
  const price = await priceLine(ctx, ticket, material, input);
  const direction = lineDirection(ticket, material, input.direction);
  const unit = price.unit || material.defaultUnit;
  const math = mathGuard(() => computeLine({ grossWeight: gross, tareWeight: tare, deductionWeight: input.deductionWeight, deductionPercent: input.deductionPercent, quantity: input.quantity, unit, unitPrice: price.unitPrice ?? 0, direction }, base));
  const count = await tx.ticketLine.count({ where: { ticketId: ticket.id } });
  const line = await tx.ticketLine.create({
    data: {
      ticketId: ticket.id,
      sortOrder: count + 1,
      materialId: material.id,
      materialName: material.name,
      direction,
      grossWeight: dec(gross).toFixed(2),
      tareWeight: dec(tare).toFixed(2),
      netWeight: math.netWeight.toFixed(2),
      deductionWeight: input.deductionWeight === void 0 || input.deductionWeight === null || input.deductionWeight === "" ? null : dec(input.deductionWeight).toFixed(2),
      deductionPercent: input.deductionPercent === void 0 || input.deductionPercent === null || input.deductionPercent === "" ? null : dec(input.deductionPercent).toFixed(2),
      deductionReason: input.deductionReason || null,
      payWeight: math.payWeight.toFixed(2),
      quantity: input.quantity ?? null,
      unit,
      unitPrice: price.unitPrice,
      priceSource: price.source,
      priceEntryId: price.priceEntryId,
      overrideById: price.overrideById,
      overrideReason: price.overrideReason,
      amountCents: price.unitPrice === null ? 0 : math.signedAmountCents,
      documents: input.documents || []
    }
  });
  for (const event of events) {
    await tx.weighEvent.create({ data: { ticketId: ticket.id, lineId: line.id, scaleId: event.scaleId, kind: event.kind, weight: event.weight, captureMethod: event.method, capturedById: ctx.actorId, capturedAt: ctx.now } });
  }
  if (price.source === "override") await ctx.audit({ eventType: "ticket.price_override", aggregateType: "TicketLine", aggregateId: line.id, yardId: ticket.yard, after: { unitPrice: price.unitPrice }, reason: price.overrideReason });
  await recomputeOpenTotals(tx, ticket.id, base);
  return line;
}
async function recordTruckWeightTx(ctx, input) {
  const { tx } = ctx;
  const ticket = await lockOpenTicket(tx, ctx, input.ticketId);
  let weight2;
  let method = "manual";
  if (input.fromScale) {
    if (!input.scaleId) refuse("Pick the scale to read.");
    weight2 = (await readStableScale(tx, input.scaleId, ticket.yard, ctx.now)).weight;
    method = "scale";
  } else {
    if (input.weight === void 0 || input.weight === null || input.weight === "") refuse("Enter the weight.");
    weight2 = dec(input.weight);
  }
  if (!weight2.gt(0)) refuse("A truck weight must be above zero.");
  const previous = await tx.weighEvent.findFirst({ where: { ticketId: ticket.id, kind: "sequential" }, orderBy: [{ capturedAt: "desc" }, { createdAt: "desc" }] });
  if (input.materialId && !previous) refuse("Weigh the full truck first, then unload.");
  if (input.materialId && previous) mathGuard(() => sequentialLineWeights([String(previous.weight), weight2.toFixed(2)]));
  const event = await tx.weighEvent.create({ data: { ticketId: ticket.id, scaleId: input.scaleId || null, kind: "sequential", weight: weight2.toFixed(2), captureMethod: method, capturedById: ctx.actorId, capturedAt: ctx.now } });
  if (!input.materialId) return { weighEventId: event.id, lineId: null };
  const line = await addTicketLineTx(ctx, {
    ticketId: ticket.id,
    materialId: input.materialId,
    grossWeight: String(previous.weight),
    tareWeight: weight2.toFixed(2),
    deductionWeight: input.deductionWeight,
    deductionPercent: input.deductionPercent,
    deductionReason: input.deductionReason,
    documents: input.documents
  });
  return { weighEventId: event.id, lineId: line.id };
}
async function gradeTicketLineTx(ctx, input) {
  const { tx } = ctx;
  const line = await tx.ticketLine.findUnique({ where: { id: input.lineId } });
  if (!line) refuse("Line not found.");
  const ticket = await lockOpenTicket(tx, ctx, line.ticketId);
  const settings = await businessSettings(tx);
  const base = settings.weightUnit === "kg" ? "kg" : "lb";
  const materialChanged = Boolean(input.materialId && input.materialId !== line.materialId);
  const material = await tx.material.findUnique({ where: { id: input.materialId || line.materialId } });
  if (!material || !material.isActive) refuse("Material not found.");
  let price = { unitPrice: line.unitPrice === null ? null : String(line.unitPrice), unit: line.unit, source: line.priceSource, priceEntryId: line.priceEntryId, overrideById: line.overrideById, overrideReason: line.overrideReason };
  if (materialChanged || input.reprice || input.unitPrice !== void 0 && input.unitPrice !== null && input.unitPrice !== "") {
    if (input.reprice && !materialChanged && !input.unitPrice && !hasFlag(ctx.session, "canOverridePrices")) refuse("Repricing an open ticket needs the price override permission.");
    price = await priceLine(ctx, ticket, material, input);
  }
  const has = (v) => v !== void 0;
  const deductionWeight = has(input.deductionWeight) ? input.deductionWeight : line.deductionWeight === null ? null : String(line.deductionWeight);
  const deductionPercent = has(input.deductionPercent) ? input.deductionPercent : line.deductionPercent === null ? null : String(line.deductionPercent);
  const quantity = has(input.quantity) ? input.quantity : line.quantity;
  const direction = lineDirection(ticket, material, line.direction);
  const math = mathGuard(() => computeLine({ grossWeight: String(line.grossWeight), tareWeight: String(line.tareWeight), deductionWeight: has(input.deductionWeight) && input.deductionWeight !== null ? deductionWeight : has(input.deductionPercent) ? null : deductionWeight, deductionPercent, quantity, unit: price.unit, unitPrice: price.unitPrice ?? 0, direction }, base));
  const before = { materialId: line.materialId, unitPrice: line.unitPrice === null ? null : String(line.unitPrice), deductionWeight: line.deductionWeight === null ? null : String(line.deductionWeight), deductionPercent: line.deductionPercent === null ? null : String(line.deductionPercent) };
  const updated = await tx.ticketLine.update({
    where: { id: line.id },
    data: {
      materialId: material.id,
      materialName: material.name,
      direction,
      deductionWeight: has(input.deductionWeight) && input.deductionWeight !== null && input.deductionWeight !== "" ? dec(input.deductionWeight).toFixed(2) : has(input.deductionPercent) ? null : line.deductionWeight,
      deductionPercent: deductionPercent === null || deductionPercent === void 0 || deductionPercent === "" ? null : dec(deductionPercent).toFixed(2),
      deductionReason: has(input.deductionReason) ? input.deductionReason || null : line.deductionReason,
      netWeight: math.netWeight.toFixed(2),
      payWeight: math.payWeight.toFixed(2),
      quantity: quantity ?? null,
      unit: price.unit,
      unitPrice: price.unitPrice,
      priceSource: price.source,
      priceEntryId: price.priceEntryId,
      overrideById: price.overrideById,
      overrideReason: price.overrideReason || "",
      amountCents: price.unitPrice === null ? 0 : math.signedAmountCents,
      documents: input.documents ?? line.documents ?? []
    }
  });
  await ctx.audit({ eventType: price.source === "override" && price.overrideReason !== line.overrideReason ? "ticket.price_override" : "ticket.line_graded", aggregateType: "TicketLine", aggregateId: line.id, yardId: ticket.yard, before, after: { materialId: material.id, unitPrice: price.unitPrice, deductionWeight: updated.deductionWeight === null ? null : String(updated.deductionWeight), deductionPercent: updated.deductionPercent === null ? null : String(updated.deductionPercent) }, reason: price.overrideReason || void 0 });
  await recomputeOpenTotals(tx, ticket.id, base);
  return updated;
}
async function splitTicketLineTx(ctx, input) {
  const { tx } = ctx;
  const line = await tx.ticketLine.findUnique({ where: { id: input.lineId } });
  if (!line) refuse("Line not found.");
  const ticket = await lockOpenTicket(tx, ctx, line.ticketId);
  const take = dec(input.weight);
  const net = new import_decimal6.Decimal(String(line.netWeight));
  if (!take.gt(0) || !take.lt(net)) refuse("The split weight must be above zero and less than the net weight of the line.");
  const settings = await businessSettings(tx);
  const base = settings.weightUnit === "kg" ? "kg" : "lb";
  const newTare = new import_decimal6.Decimal(String(line.tareWeight)).plus(take);
  const math = mathGuard(() => computeLine({ grossWeight: String(line.grossWeight), tareWeight: newTare, deductionWeight: line.deductionWeight === null ? null : import_decimal6.Decimal.min(String(line.deductionWeight), net.minus(take)), deductionPercent: line.deductionPercent === null ? null : String(line.deductionPercent), unit: line.unit, unitPrice: line.unitPrice === null ? 0 : String(line.unitPrice), direction: line.direction }, base));
  await tx.ticketLine.update({ where: { id: line.id }, data: { tareWeight: newTare.toFixed(2), netWeight: math.netWeight.toFixed(2), payWeight: math.payWeight.toFixed(2), amountCents: line.unitPrice === null ? 0 : math.signedAmountCents, ...line.deductionWeight !== null ? { deductionWeight: import_decimal6.Decimal.min(String(line.deductionWeight), net.minus(take)).toFixed(2) } : {} } });
  const created = await addTicketLineTx(ctx, { ticketId: ticket.id, materialId: input.materialId, grossWeight: take.toFixed(2), tareWeight: "0" });
  await ctx.audit({ eventType: "ticket.line_split", aggregateType: "TicketLine", aggregateId: line.id, yardId: ticket.yard, after: { newLineId: created.id, weight: take.toFixed(2) } });
  return created;
}
async function removeTicketLineTx(ctx, input) {
  const { tx } = ctx;
  const line = await tx.ticketLine.findUnique({ where: { id: input.lineId } });
  if (!line) refuse("Line not found.");
  const ticket = await lockOpenTicket(tx, ctx, line.ticketId);
  await tx.ticketLine.delete({ where: { id: line.id } });
  await ctx.audit({ eventType: "ticket.line_removed", aggregateType: "TicketLine", aggregateId: line.id, yardId: ticket.yard, before: { materialId: line.materialId, payWeight: String(line.payWeight), amountCents: line.amountCents }, reason: input.reason || void 0 });
  const settings = await businessSettings(tx);
  await recomputeOpenTotals(tx, ticket.id, settings.weightUnit === "kg" ? "kg" : "lb");
  return { id: ticket.id };
}
async function updateTicketDetailsTx(ctx, input) {
  const { tx } = ctx;
  const ticket = await lockOpenTicket(tx, ctx, input.ticketId);
  const data = {};
  if (input.vehiclePlate !== void 0) data.vehiclePlate = String(input.vehiclePlate || "").replace(/\s+/g, "").toUpperCase();
  if (input.vehiclePlateRegion !== void 0) data.vehiclePlateRegion = input.vehiclePlateRegion || "";
  if (input.vehicleDescription !== void 0) data.vehicleDescription = input.vehicleDescription || "";
  if (input.vehicleId !== void 0) data.vehicleId = input.vehicleId || null;
  if (input.siteId !== void 0) data.siteId = input.siteId || null;
  if (input.containerId !== void 0) data.containerId = input.containerId || null;
  if (input.jobId !== void 0) data.jobId = input.jobId || null;
  if (input.notes !== void 0) data.notes = input.notes || "";
  if (input.donatePercent !== void 0) {
    const pct = Math.trunc(Number(input.donatePercent || 0));
    if (pct < 0 || pct > 100) refuse("Donation percent must be between 0 and 100.");
    data.donatePercent = pct;
  }
  if (input.campaignId !== void 0) {
    data.campaignId = input.campaignId || null;
    if (input.campaignId) {
      const campaign = await tx.donationCampaign.findUnique({ where: { id: input.campaignId } });
      if (!campaign || campaign.status !== "active") refuse("That campaign is not active.");
      data.nonprofitId = campaign.accountId;
    }
  }
  if (input.nonprofitId !== void 0 && input.campaignId === void 0) {
    if (input.nonprofitId) {
      const np = await tx.account.findUnique({ where: { id: input.nonprofitId } });
      if (!np?.isNonprofit || np.status !== "active") refuse("Donations go only to an active partner nonprofit.");
    }
    data.nonprofitId = input.nonprofitId || null;
  }
  if (input.paymentMode !== void 0 && input.paymentMode) {
    if (!["pay_now", "on_account", "donation_only", "customer_pays"].includes(input.paymentMode)) refuse("Payment mode is not valid.");
    if (input.paymentMode === "on_account" && !ticket.account) refuse("Only a commercial account can be put on account.");
    data.paymentMode = input.paymentMode;
  }
  if (input.fees !== void 0) {
    const fees = (input.fees || []).map((fee) => ({ label: String(fee.label || "").slice(0, 120), amountCents: Math.trunc(Number(fee.amountCents)) }));
    if (fees.some((fee) => !fee.label || !Number.isSafeInteger(fee.amountCents))) refuse("Each fee needs a label and an amount in cents.");
    data.fees = fees;
  }
  const updated = await tx.scaleTicket.update({ where: { id: ticket.id }, data });
  const settings = await businessSettings(tx);
  await recomputeOpenTotals(tx, ticket.id, settings.weightUnit === "kg" ? "kg" : "lb");
  return updated;
}
async function recomputeOpenTotals(tx, ticketId, _base) {
  const ticket = await tx.scaleTicket.findUnique({ where: { id: ticketId }, include: { lines: true, yard: true } });
  const totals = computeTicketTotals(ticket.lines.map((l) => ({ signedAmountCents: l.amountCents })), Array.isArray(ticket.fees) ? ticket.fees : [], String(ticket.yard?.feeTaxRatePercent ?? 0));
  await tx.scaleTicket.update({ where: { id: ticketId }, data: totals });
  return totals;
}
async function ticketComplianceChecklist(tx, ticketId, now = /* @__PURE__ */ new Date()) {
  const ticket = await tx.scaleTicket.findUnique({ where: { id: ticketId }, include: { lines: { include: { material: true } }, attachments: true, seller: true } });
  if (!ticket) refuse("Ticket not found.");
  const { profile, restrictions } = await yardRules(tx, ticket.yardId);
  const identity = ticket.sellerId ? await currentIdentity(tx, ticket.sellerId) : null;
  const listMatch = ticket.seller ? await doNotBuyMatch(tx, { sellerId: ticket.sellerId, firstName: ticket.seller.firstName, lastName: ticket.seller.lastName, dateOfBirth: ticket.seller.dateOfBirth, idNumbers: identity ? [identity.number] : [], plate: ticket.vehiclePlate }, now) : null;
  const items = validateTicketCompliance({
    direction: ticket.direction,
    isCommercial: Boolean(ticket.accountId),
    isAdjustment: ticket.isAdjustment,
    now,
    seller: ticket.seller ? { status: ticket.seller.status, dateOfBirth: ticket.seller.dateOfBirth, doNotBuyMatch: Boolean(listMatch) } : null,
    identity: identity ? { expiresOn: identity.expiresOn, hasFrontImage: Boolean(identity.frontImage_id), hasThumbprint: Boolean(identity.thumbprintImage_id) } : null,
    vehiclePlate: ticket.vehiclePlate,
    attachments: ticket.attachments.map((a) => ({ kind: a.kind, lineId: a.lineId })),
    lines: ticket.lines.map((l) => ({ id: l.id, materialId: l.materialId, categoryId: l.material?.categoryId, materialName: l.materialName, hasPrice: l.unitPrice !== null, documents: Array.isArray(l.documents) ? l.documents : [] }))
  }, profile, restrictions);
  return { ticket, profile, restrictions, items, identity };
}
async function completeTicketTx(ctx, input) {
  const { tx, now } = ctx;
  const row = await lockOpenTicket(tx, ctx, input.ticketId);
  const settings = await businessSettings(tx);
  const base = settings.weightUnit === "kg" ? "kg" : "lb";
  const { ticket, profile, restrictions, items } = await ticketComplianceChecklist(tx, row.id, now);
  for (const line of ticket.lines) {
    if (line.unitPrice === null) continue;
    const math = mathGuard(() => computeLine({ grossWeight: String(line.grossWeight), tareWeight: String(line.tareWeight), deductionWeight: line.deductionWeight === null ? null : String(line.deductionWeight), deductionPercent: line.deductionPercent === null ? null : String(line.deductionPercent), quantity: line.quantity, unit: line.unit, unitPrice: String(line.unitPrice), direction: line.direction }, base));
    if (math.signedAmountCents !== line.amountCents) await tx.ticketLine.update({ where: { id: line.id }, data: { amountCents: math.signedAmountCents, payWeight: math.payWeight.toFixed(2), netWeight: math.netWeight.toFixed(2) } });
    line.amountCents = math.signedAmountCents;
    line.payWeight = math.payWeight.toFixed(2);
  }
  const override = input.overrideReason ? { reason: input.overrideReason } : null;
  if (override && !hasFlag(ctx.session, MANAGER)) refuse("Only a manager may override a compliance item.");
  const blocking = blockingItems(items, override);
  if (blocking.length) throw new CommandError(`The ticket cannot be completed yet: ${blocking.map((i) => i.message).join(" ")}`, "COMPLIANCE_INCOMPLETE", { items: blocking });
  const overridden = override ? items.filter((i) => i.overridable) : [];
  const totals = computeTicketTotals(ticket.lines.map((l) => ({ signedAmountCents: l.amountCents })), Array.isArray(ticket.fees) ? ticket.fees : [], String((await tx.yard.findUnique({ where: { id: ticket.yardId } }))?.feeTaxRatePercent ?? 0));
  if (ticket.direction === "outbound") {
    await loadShipmentFromTicket(ctx, ticket, totals);
  } else {
    await postInboundEffects(ctx, ticket, totals, profile, restrictions, settings);
  }
  await compareAndSet(tx, "scaleTicket", ticket.id, "open", {
    status: "completed",
    ...totals,
    completedById: ctx.actorId,
    completedAt: now,
    complianceSnapshot: { checkedAt: now.toISOString(), items, overridden: overridden.map((i) => i.code), profile },
    ...overridden.length ? { overrideReason: String(input.overrideReason), overrideById: ctx.actorId } : {}
  }, "This ticket was already completed.");
  if (ticket.containerId) await tx.container.updateMany({ where: { id: ticket.containerId, status: "in_transit" }, data: { status: "in_yard", siteId: null, accountId: null, placedOn: null } });
  await ctx.audit({ eventType: "ticket.completed", aggregateType: "ScaleTicket", aggregateId: ticket.id, yardId: ticket.yardId, after: { ...totals, lines: ticket.lines.length }, reason: overridden.length ? `Compliance override: ${input.overrideReason}` : void 0 });
  await maybeSettleTicket(tx, ticket.id, now);
  return tx.scaleTicket.findUnique({ where: { id: ticket.id } });
}
async function postInboundEffects(ctx, ticket, totals, profile, restrictions, settings) {
  const { tx, now } = ctx;
  for (const line of ticket.lines) {
    const weight2 = new import_decimal6.Decimal(String(line.payWeight));
    if (weight2.isZero()) continue;
    const sign = ticket.isAdjustment && line.direction === "charge_customer" ? -1 : 1;
    const costDeltaCents = ticket.isAdjustment ? sign * Math.abs(line.amountCents) : Math.max(0, line.amountCents);
    await postMovement(tx, {
      yardId: ticket.yardId,
      materialId: line.materialId,
      kind: "receive",
      weightDelta: weight2.times(sign),
      costDeltaCents,
      referenceKey: `ticket:${ticket.id}:line:${line.id}:receive`,
      ticketId: ticket.id,
      ticketLineId: line.id,
      actorId: ctx.actorId,
      allowNegative: false
    });
    const lineRestrictions = restrictionsForLine({ materialId: line.materialId, categoryId: line.material?.categoryId }, restrictions);
    const holdDays = Math.max(Number(profile.defaultMaterialHoldDays || 0), ...lineRestrictions.map((r) => Number(r.materialHoldDays || 0)));
    if (holdDays > 0 && sign > 0) {
      const tag = await tx.holdTag.create({ data: { ticketId: ticket.id, lineId: line.id, yardId: ticket.yardId, materialId: line.materialId, weight: weight2.toFixed(2), kind: "material", status: "held", releaseAt: new Date(now.getTime() + holdDays * 864e5) } });
      await postMovement(tx, { yardId: ticket.yardId, materialId: line.materialId, kind: "hold", weightDelta: weight2, bucket: "held", referenceKey: `hold:${tag.id}:place`, ticketId: ticket.id, ticketLineId: line.id, actorId: ctx.actorId });
    }
  }
  let donationCents = 0;
  if (ticket.donatePercent > 0 && totals.totalCents > 0) {
    donationCents = new import_decimal6.Decimal(totals.totalCents).times(ticket.donatePercent).div(100).toDecimalPlaces(0, import_decimal6.Decimal.ROUND_HALF_UP).toNumber();
  }
  const goodsDonation = settings.isNonprofit && (ticket.paymentMode === "donation_only" || ticket.donatePercent === 100 && !ticket.nonprofitId);
  if (donationCents > 0 || goodsDonation) {
    const receiptNo = await ctx.sequence("business", "donation_receipt");
    const receiptNumber = `D-${now.getUTCFullYear()}-${String(receiptNo).padStart(6, "0")}`;
    await tx.donation.create({
      data: {
        ticketId: ticket.id,
        sellerId: ticket.sellerId,
        accountId: goodsDonation ? null : ticket.nonprofitId,
        campaignId: ticket.campaignId,
        amountCents: goodsDonation ? 0 : donationCents,
        weight: ticket.lines.reduce((s, l) => s.plus(String(l.payWeight)), new import_decimal6.Decimal(0)).toFixed(2),
        itemsSummary: ticket.lines.map((l) => ({ material: l.materialName, weight: String(l.payWeight), unit: settings.weightUnit })),
        kind: goodsDonation ? "goods_donation" : "payout_donation",
        status: "credited",
        receiptNumber,
        receiptIssuedAt: now,
        goodsOrServicesProvided: false
      }
    });
    if (goodsDonation) donationCents = Math.max(0, totals.totalCents);
  }
  if (ticket.paymentMode === "on_account") return;
  if (totals.totalCents < 0) {
    const number = await ctx.sequence("business", "invoice");
    await tx.invoice.create({
      data: {
        number,
        sellerId: ticket.sellerId,
        accountId: ticket.accountId,
        ticketId: ticket.id,
        kind: "fee_ticket",
        status: "open",
        subtotalCents: -totals.totalCents - totals.taxCents,
        taxCents: totals.taxCents,
        totalCents: -totals.totalCents,
        dueOn: now,
        lines: { create: [
          ...ticket.lines.filter((l) => l.amountCents < 0).map((l) => ({ description: l.materialName, materialId: l.materialId, weight: String(l.payWeight), unit: l.unit, unitPrice: String(l.unitPrice), amountCents: -l.amountCents, kind: "fee" })),
          ...ticket.lines.filter((l) => l.amountCents > 0).map((l) => ({ description: `Less ${l.materialName}`, materialId: l.materialId, weight: String(l.payWeight), unit: l.unit, unitPrice: String(l.unitPrice), amountCents: -l.amountCents, kind: "credit" })),
          ...(Array.isArray(ticket.fees) ? ticket.fees : []).filter((f) => f.amountCents !== 0).map((f) => ({ description: f.label, amountCents: -f.amountCents, kind: "fee" })),
          ...totals.taxCents ? [{ description: "Tax on fees", amountCents: totals.taxCents, kind: "fee" }] : []
        ] }
      }
    });
    return;
  }
  const payable = totals.totalCents - donationCents;
  if (payable <= 0 || ticket.paymentMode === "donation_only") return;
  const yard = await tx.yard.findUnique({ where: { id: ticket.yardId } });
  const groups = splitPayouts({
    lines: ticket.lines.map((l) => ({ id: l.id, signedAmountCents: l.amountCents, materialId: l.materialId, categoryId: l.material?.categoryId })),
    restrictions,
    yardMethods: Array.isArray(yard?.payoutMethods) ? yard.payoutMethods : ["cash", "check", "transfer"],
    profile,
    completedAt: now,
    extraCents: totals.feeTotalCents - totals.taxCents - donationCents
  });
  const seller = ticket.sellerId ? await tx.seller.findUnique({ where: { id: ticket.sellerId } }) : null;
  for (const group of groups) {
    const held = Boolean(group.releaseAt && group.releaseAt.getTime() > now.getTime());
    const payout = await tx.payout.create({
      data: {
        ticketId: ticket.id,
        sellerId: ticket.sellerId,
        accountId: ticket.accountId,
        amountCents: group.amountCents,
        status: held ? "held" : "ready",
        allowedMethods: group.allowedMethods,
        releaseAt: group.releaseAt,
        mailToAddress: group.mailCheckOnly && seller ? [seller.addressLine1, seller.addressLine2, seller.city, seller.region, seller.postalCode].filter(Boolean).join(", ") : "",
        lines: { connect: group.lineIds.map((id) => ({ id })) }
      }
    });
    await ctx.audit({ eventType: "payout.created", aggregateType: "Payout", aggregateId: payout.id, yardId: ticket.yardId, after: { amountCents: group.amountCents, status: payout.status, allowedMethods: group.allowedMethods, releaseAt: group.releaseAt } });
  }
}
async function voidTicketTx(ctx, input) {
  const { tx, now } = ctx;
  const reason = String(input.reason || "").trim();
  if (reason.length < 3) refuse("Give a reason for the void.");
  const row = await lockRow(tx, "ScaleTicket", input.ticketId);
  if (!row) refuse("Ticket not found.");
  requireYard(ctx.session, row.yard);
  if (row.status === "open") {
    if (!hasFlag(ctx.session, "canManageTickets") && !hasFlag(ctx.session, "canVoidTickets")) refuse("You cannot void tickets.");
    await compareAndSet(tx, "scaleTicket", row.id, "open", { status: "voided", voidReason: reason, voidedById: ctx.actorId, voidedAt: now });
    if (row.visit) await tx.visit.updateMany({ where: { id: row.visit, status: "arrived" }, data: { status: "booked" } });
    await ctx.audit({ eventType: "ticket.voided", aggregateType: "ScaleTicket", aggregateId: row.id, yardId: row.yard, before: { status: "open" }, after: { status: "voided" }, reason });
    return tx.scaleTicket.findUnique({ where: { id: row.id } });
  }
  if (row.status !== "completed") refuse(row.status === "settled" ? "A settled ticket never changes. Issue an adjustment ticket." : "This ticket is already void.");
  if (!hasFlag(ctx.session, "canVoidTickets")) refuse("Only a manager may void a completed ticket.");
  if (row.direction === "outbound") refuse("An outbound ticket with a loaded shipment cannot be voided; cancel or adjust the shipment instead.");
  const payouts = await tx.payout.findMany({ where: { ticketId: row.id } });
  if (payouts.some((p) => p.status === "paid" || p.status === "returned")) refuse("A payout on this ticket is paid. Issue an adjustment ticket instead.");
  if (row.settlement) {
    const settlement = await tx.settlement.findUnique({ where: { id: row.settlement } });
    if (settlement && settlement.status !== "draft" && settlement.status !== "void") refuse("This ticket is on an approved settlement.");
  }
  const invoice = await tx.invoice.findFirst({ where: { ticketId: row.id, kind: "fee_ticket", status: { not: "void" } } });
  if (invoice && invoice.paidCents > 0) refuse("A fee on this ticket has been paid. Issue an adjustment ticket instead.");
  if (row.collectedCents > 0) refuse("Cash was collected on this ticket. Issue an adjustment ticket instead.");
  const movements = await tx.inventoryMovement.findMany({ where: { ticketId: row.id, kind: { in: ["receive", "hold"] } } });
  for (const movement of movements.filter((m) => m.kind === "receive")) {
    await postMovement(tx, { yardId: movement.yardId, materialId: movement.materialId, kind: "reverse", weightDelta: new import_decimal6.Decimal(String(movement.weightDelta)).negated(), costDeltaCents: -movement.costDeltaCents, referenceKey: `${movement.referenceKey}:reverse`, ticketId: row.id, ticketLineId: movement.ticketLineId, actorId: ctx.actorId, reason });
  }
  const tags = await tx.holdTag.findMany({ where: { ticketId: row.id, status: { in: ["held", "police_hold"] } } });
  for (const tag of tags) {
    await compareAndSet(tx, "holdTag", tag.id, ["held", "police_hold"], { status: "cancelled", releasedAt: now, releasedById: ctx.actorId, releaseReason: `Ticket voided: ${reason}` });
    await postMovement(tx, { yardId: tag.yardId, materialId: tag.materialId, kind: "release", weightDelta: new import_decimal6.Decimal(String(tag.weight)).negated(), bucket: "held", referenceKey: `hold:${tag.id}:release`, ticketId: row.id, actorId: ctx.actorId, reason });
  }
  for (const payout of payouts.filter((p) => p.status === "ready" || p.status === "held" || p.status === "pending")) {
    await compareAndSet(tx, "payout", payout.id, ["ready", "held", "pending"], { status: "cancelled", cancelReason: `Ticket voided: ${reason}` }, "A payout on this ticket changed while voiding. Try again.");
  }
  await tx.donation.updateMany({ where: { ticketId: row.id, status: { in: ["pledged", "credited"] } }, data: { status: "cancelled" } });
  if (invoice) await compareAndSet(tx, "invoice", invoice.id, ["open"], { status: "void", voidReason: `Ticket voided: ${reason}` });
  if (row.settlement) await tx.scaleTicket.update({ where: { id: row.id }, data: { settlementId: null } });
  await compareAndSet(tx, "scaleTicket", row.id, "completed", { status: "voided", voidReason: reason, voidedById: ctx.actorId, voidedAt: now });
  await ctx.audit({ eventType: "ticket.voided", aggregateType: "ScaleTicket", aggregateId: row.id, yardId: row.yard, before: { status: "completed", totalCents: row.totalCents }, after: { status: "voided", reversedMovements: movements.length, cancelledPayouts: payouts.length }, reason });
  return tx.scaleTicket.findUnique({ where: { id: row.id } });
}
async function createAdjustmentTicketTx(ctx, input) {
  const { tx } = ctx;
  if (!hasFlag(ctx.session, MANAGER)) refuse("Only a manager may issue an adjustment ticket.");
  const reason = String(input.reason || "").trim();
  if (reason.length < 3) refuse("Give a reason for the adjustment.");
  const original = await tx.scaleTicket.findUnique({ where: { id: input.ticketId } });
  if (!original) refuse("Ticket not found.");
  requireYard(ctx.session, original.yardId);
  if (!["completed", "settled"].includes(original.status)) refuse("Only a completed or settled ticket can be adjusted.");
  if (original.isAdjustment) refuse("Adjust the original ticket, not an adjustment.");
  const number = await ctx.sequence(`yard:${original.yardId}`, `${original.direction}_ticket`, original.yardId);
  const ticket = await tx.scaleTicket.create({
    data: {
      yardId: original.yardId,
      direction: original.direction,
      number,
      status: "open",
      sellerId: original.sellerId,
      accountId: original.accountId,
      siteId: original.siteId,
      vehiclePlate: original.vehiclePlate,
      vehiclePlateRegion: original.vehiclePlateRegion,
      vehicleDescription: original.vehicleDescription,
      adjustsId: original.id,
      isAdjustment: true,
      paymentMode: original.paymentMode === "on_account" ? "on_account" : "pay_now",
      lookupCode: randomCode(8),
      openedById: ctx.actorId,
      notes: reason,
      fees: []
    }
  });
  await ctx.audit({ eventType: "ticket.adjustment_opened", aggregateType: "ScaleTicket", aggregateId: ticket.id, yardId: original.yardId, after: { adjusts: original.id, number }, reason });
  return ticket;
}
function hashScaleKey(key) {
  return (0, import_node_crypto5.createHash)("sha256").update(`recycling-scale:${key}`).digest("hex");
}
async function issueScaleKeyTx(ctx, input) {
  const scale = await ctx.tx.scale.findUnique({ where: { id: input.scaleId } });
  if (!scale) refuse("Scale not found.");
  requireYard(ctx.session, scale.yardId);
  const key = `sk_${randomCode(32)}`;
  await ctx.tx.scale.update({ where: { id: scale.id }, data: { apiKeyHash: hashScaleKey(key) } });
  await ctx.audit({ eventType: "scale.key_issued", aggregateType: "Scale", aggregateId: scale.id, yardId: scale.yardId });
  return { id: scale.id, key };
}
var refetch = (context, id) => context.db.ScaleTicket.findOne({ where: { id } });
var ticketTypeDefs = `
  input TicketFeeInput { label: String!, amountCents: Int! }
  input OpenTicketInput {
    yardId: ID!, direction: String, sellerId: ID, accountId: ID, siteId: ID, vehicleId: ID, vehiclePlate: String, vehiclePlateRegion: String,
    vehicleDescription: String, visitCode: String, jobId: ID, containerId: ID, shipmentId: ID, paymentMode: String, donatePercent: Int,
    nonprofitId: ID, campaignId: ID, overrideReason: String, notes: String
  }
  input TicketLineInput {
    ticketId: ID!, materialId: ID!, grossWeight: String, tareWeight: String, quantity: Int, deductionWeight: String, deductionPercent: String,
    deductionReason: String, unitPrice: String, overrideReason: String, documents: [String!], direction: String, scaleId: ID,
    grossFromScale: Boolean, tareFromScale: Boolean
  }
  input GradeTicketLineInput {
    lineId: ID!, materialId: ID, deductionWeight: String, deductionPercent: String, deductionReason: String, unitPrice: String,
    overrideReason: String, documents: [String!], reprice: Boolean, quantity: Int
  }
  input TruckWeightInput {
    ticketId: ID!, weight: String, scaleId: ID, fromScale: Boolean, materialId: ID, deductionWeight: String, deductionPercent: String,
    deductionReason: String, documents: [String!]
  }
  input TicketDetailsInput {
    ticketId: ID!, vehiclePlate: String, vehiclePlateRegion: String, vehicleDescription: String, vehicleId: ID, donatePercent: Int,
    nonprofitId: ID, campaignId: ID, paymentMode: String, fees: [TicketFeeInput!], notes: String, siteId: ID, containerId: ID, jobId: ID
  }
  type TruckWeightResult { weighEventId: ID!, line: TicketLine }
  type ScaleKeyResult { id: ID!, key: String! }
  type ComplianceItem { code: String!, message: String!, lineId: ID, overridable: Boolean! }
`;
var ticketMutationDefs = `
  openTicket(data: OpenTicketInput!, idempotencyKey: String): ScaleTicket
  addTicketLine(data: TicketLineInput!, idempotencyKey: String): TicketLine
  recordTruckWeight(data: TruckWeightInput!, idempotencyKey: String): TruckWeightResult
  gradeTicketLine(data: GradeTicketLineInput!, idempotencyKey: String): TicketLine
  splitTicketLine(lineId: ID!, weight: String!, materialId: ID!, idempotencyKey: String): TicketLine
  removeTicketLine(lineId: ID!, reason: String, idempotencyKey: String): ScaleTicket
  updateTicketDetails(data: TicketDetailsInput!, idempotencyKey: String): ScaleTicket
  completeTicket(ticketId: ID!, overrideReason: String, idempotencyKey: String): ScaleTicket
  voidTicket(ticketId: ID!, reason: String!, idempotencyKey: String): ScaleTicket
  createAdjustmentTicket(ticketId: ID!, reason: String!, idempotencyKey: String): ScaleTicket
  issueScaleKey(scaleId: ID!): ScaleKeyResult
`;
var ticketQueryDefs = `
  ticketComplianceChecklist(ticketId: ID!): [ComplianceItem!]
`;
var ticketResolvers = {
  Mutation: {
    openTicket: async (_, { data, idempotencyKey }, context) => {
      const r = await runCommand(context, { name: "openTicket", input: data, idempotencyKey: cleanKey(idempotencyKey), permission: "canManageTickets", aggregateType: "ScaleTicket" }, (ctx) => openTicketTx(ctx, data));
      return refetch(context, r.id);
    },
    addTicketLine: async (_, { data, idempotencyKey }, context) => {
      const r = await runCommand(context, { name: "addTicketLine", input: data, idempotencyKey: cleanKey(idempotencyKey), permission: [...TICKET_USERS], aggregateType: "TicketLine" }, (ctx) => addTicketLineTx(ctx, data));
      return context.db.TicketLine.findOne({ where: { id: r.id } });
    },
    recordTruckWeight: async (_, { data, idempotencyKey }, context) => {
      const r = await runCommand(context, { name: "recordTruckWeight", input: data, idempotencyKey: cleanKey(idempotencyKey), permission: [...TICKET_USERS] }, (ctx) => recordTruckWeightTx(ctx, data));
      return { weighEventId: r.weighEventId, line: r.lineId ? await context.db.TicketLine.findOne({ where: { id: r.lineId } }) : null };
    },
    gradeTicketLine: async (_, { data, idempotencyKey }, context) => {
      const r = await runCommand(context, { name: "gradeTicketLine", input: data, idempotencyKey: cleanKey(idempotencyKey), permission: [...TICKET_USERS], aggregateType: "TicketLine" }, (ctx) => gradeTicketLineTx(ctx, data));
      return context.db.TicketLine.findOne({ where: { id: r.id } });
    },
    splitTicketLine: async (_, args, context) => {
      const r = await runCommand(context, { name: "splitTicketLine", input: { lineId: args.lineId, weight: args.weight, materialId: args.materialId }, idempotencyKey: cleanKey(args.idempotencyKey), permission: [...TICKET_USERS] }, (ctx) => splitTicketLineTx(ctx, args));
      return context.db.TicketLine.findOne({ where: { id: r.id } });
    },
    removeTicketLine: async (_, args, context) => {
      const r = await runCommand(context, { name: "removeTicketLine", input: { lineId: args.lineId, reason: args.reason }, idempotencyKey: cleanKey(args.idempotencyKey), permission: [...TICKET_USERS] }, (ctx) => removeTicketLineTx(ctx, args));
      return refetch(context, r.id);
    },
    updateTicketDetails: async (_, { data, idempotencyKey }, context) => {
      const r = await runCommand(context, { name: "updateTicketDetails", input: data, idempotencyKey: cleanKey(idempotencyKey), permission: [...TICKET_USERS] }, (ctx) => updateTicketDetailsTx(ctx, data));
      return refetch(context, r.id);
    },
    completeTicket: async (_, args, context) => {
      const r = await runCommand(context, { name: "completeTicket", input: { ticketId: args.ticketId, overrideReason: args.overrideReason }, idempotencyKey: cleanKey(args.idempotencyKey), permission: [...TICKET_USERS], aggregateType: "ScaleTicket" }, (ctx) => completeTicketTx(ctx, args));
      return refetch(context, r.id);
    },
    voidTicket: async (_, args, context) => {
      const r = await runCommand(context, { name: "voidTicket", input: { ticketId: args.ticketId, reason: args.reason }, idempotencyKey: cleanKey(args.idempotencyKey), permission: ["canManageTickets", "canVoidTickets"], aggregateType: "ScaleTicket" }, (ctx) => voidTicketTx(ctx, args));
      return refetch(context, r.id);
    },
    createAdjustmentTicket: async (_, args, context) => {
      const r = await runCommand(context, { name: "createAdjustmentTicket", input: { ticketId: args.ticketId, reason: args.reason }, idempotencyKey: cleanKey(args.idempotencyKey), permission: MANAGER, aggregateType: "ScaleTicket" }, (ctx) => createAdjustmentTicketTx(ctx, args));
      return refetch(context, r.id);
    },
    issueScaleKey: async (_, args, context) => runCommand(context, { name: "issueScaleKey", input: args, permission: "canManageSettings" }, (ctx) => issueScaleKeyTx(ctx, args))
  },
  Query: {
    ticketComplianceChecklist: async (_, { ticketId }, context) => {
      if (!hasFlag(context.session, "canAccessDashboard")) throw new CommandError("Staff only.", "FORBIDDEN");
      const ticket = await context.sudo().prisma.scaleTicket.findUnique({ where: { id: ticketId } });
      if (!ticket) refuse("Ticket not found.");
      requireYard(context.session, ticket.yardId);
      const { items } = await ticketComplianceChecklist(context.sudo().prisma, ticketId);
      return items;
    }
  }
};

// features/keystone/commands/money.ts
var import_node_crypto8 = require("node:crypto");

// features/integrations/payment/index.ts
var paymentProviderAdapters = {
  manual: { load: () => Promise.resolve().then(() => (init_manual(), manual_exports)), settlement: "offline", webhook: null },
  stripe: { load: () => Promise.resolve().then(() => (init_stripe(), stripe_exports)), settlement: "processor", webhook: { secretEnv: "STRIPE_WEBHOOK_SECRET", signatureHeader: "stripe-signature" } }
};
function isPaymentProviderAdapterCode(value) {
  return Object.prototype.hasOwnProperty.call(paymentProviderAdapters, value);
}
function getPaymentProviderRegistration(code) {
  const bare = code.replace(/^pp_/, "");
  return isPaymentProviderAdapterCode(bare) ? paymentProviderAdapters[bare] : null;
}
async function paymentAdapter(code) {
  const registration = getPaymentProviderRegistration(code);
  if (!registration) throw new Error(`Payment adapter ${code} is not registered.`);
  return { registration, adapter: await registration.load() };
}

// features/keystone/lib/paymentWebhookSecurity.ts
var import_node_crypto7 = require("node:crypto");

// features/keystone/commands/money.ts
var hashKey = (value) => (0, import_node_crypto8.createHash)("sha256").update(value).digest("hex");
async function drawerExpectedCents(tx, sessionId) {
  const events = await tx.cashDrawerEvent.findMany({ where: { sessionId }, select: { kind: true, amountCents: true } });
  return events.reduce((sum, e) => sum + (e.kind === "payout" || e.kind === "drop" ? -e.amountCents : e.amountCents), 0);
}
async function lockOpenDrawerSession(ctx, sessionId, { mine = true } = {}) {
  const row = await lockRow(ctx.tx, "CashDrawerSession", sessionId);
  if (!row) refuse("Drawer session not found.");
  if (row.status !== "open") refuse("This drawer session is not open.");
  if (mine && row.cashier !== ctx.actorId && !hasFlag(ctx.session, "canManageCashDrawers")) refuse("This is another cashier\u2019s drawer.");
  const drawer = await ctx.tx.cashDrawer.findUnique({ where: { id: row.drawer } });
  requireYard(ctx.session, drawer?.yardId);
  return { row, drawer };
}
async function drawerEvent(ctx, sessionId, kind, amountCents, referenceKey, extra = {}) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) refuse("The amount must be above zero.");
  await ctx.tx.cashDrawerEvent.create({ data: { sessionId, kind, amountCents, referenceKey, createdById: ctx.actorId, note: "", ...extra } });
  const expected = await drawerExpectedCents(ctx.tx, sessionId);
  await ctx.tx.cashDrawerSession.update({ where: { id: sessionId }, data: { expectedCents: expected } });
  return expected;
}
async function openDrawerSessionTx(ctx, input) {
  const drawer = await ctx.tx.cashDrawer.findUnique({ where: { id: input.drawerId } });
  if (!drawer || !drawer.isActive) refuse("Drawer not found.");
  requireYard(ctx.session, drawer.yardId);
  const float = Math.trunc(Number(input.openingFloatCents));
  if (!Number.isSafeInteger(float) || float < 0) refuse("Count the opening float.");
  if (await ctx.tx.cashDrawerSession.findFirst({ where: { drawerId: drawer.id, status: { in: ["open", "counting"] } } })) refuse("This drawer already has an open session.");
  if (await ctx.tx.cashDrawerSession.findFirst({ where: { cashierId: ctx.actorId, status: { in: ["open", "counting"] } } })) refuse("You already have a drawer open.");
  const session = await ctx.tx.cashDrawerSession.create({ data: { drawerId: drawer.id, cashierId: ctx.actorId, status: "open", openingFloatCents: float, expectedCents: float, openedAt: ctx.now } });
  if (float > 0) await ctx.tx.cashDrawerEvent.create({ data: { sessionId: session.id, kind: "open", amountCents: float, referenceKey: `drawer:${session.id}:open`, createdById: ctx.actorId, note: "Opening float" } });
  await ctx.audit({ eventType: "drawer.opened", aggregateType: "CashDrawerSession", aggregateId: session.id, yardId: drawer.yardId, after: { openingFloatCents: float } });
  return session;
}
async function moveDrawerCashTx(ctx, input, key) {
  if (input.kind !== "add" && input.kind !== "drop") refuse("Choose add or drop.");
  const { row, drawer } = await lockOpenDrawerSession(ctx, input.sessionId);
  const amount = Math.trunc(Number(input.amountCents));
  if (input.kind === "drop" && amount > row.expectedCents) refuse("You cannot drop more cash than the drawer holds.");
  const expected = await drawerEvent(ctx, row.id, input.kind, amount, `drawer:${row.id}:${input.kind}:${key}`, { note: input.note || "" });
  await ctx.audit({ eventType: `drawer.${input.kind}`, aggregateType: "CashDrawerSession", aggregateId: row.id, yardId: drawer.yardId, after: { amountCents: amount, expectedCents: expected } });
  return ctx.tx.cashDrawerSession.findUnique({ where: { id: row.id } });
}
async function countDrawerTx(ctx, input) {
  const { row, drawer } = await lockOpenDrawerSession(ctx, input.sessionId);
  const counted = Math.trunc(Number(input.countedCents));
  if (!Number.isSafeInteger(counted) || counted < 0) refuse("Enter the counted cash.");
  const expected = await drawerExpectedCents(ctx.tx, row.id);
  const variance = counted - expected;
  const closes = variance === 0;
  await compareAndSet(ctx.tx, "cashDrawerSession", row.id, "open", { status: closes ? "closed" : "counting", countedCents: counted, varianceCents: variance, expectedCents: expected, ...closes ? { closedAt: ctx.now } : {} });
  await ctx.audit({ eventType: closes ? "drawer.closed" : "drawer.counted", aggregateType: "CashDrawerSession", aggregateId: row.id, yardId: drawer.yardId, after: { countedCents: counted, expectedCents: expected, varianceCents: variance } });
  return ctx.tx.cashDrawerSession.findUnique({ where: { id: row.id } });
}
async function approveDrawerCloseTx(ctx, input) {
  const row = await lockRow(ctx.tx, "CashDrawerSession", input.sessionId);
  if (!row) refuse("Drawer session not found.");
  const drawer = await ctx.tx.cashDrawer.findUnique({ where: { id: row.drawer } });
  requireYard(ctx.session, drawer?.yardId);
  if (row.status !== "counting") refuse("Only a counted drawer with a variance waits for approval.");
  const note = String(input.note || "").trim();
  if (note.length < 3) refuse("Write a note explaining the variance.");
  if (row.cashier === ctx.actorId && !hasFlag(ctx.session, "canManageSettings")) refuse("Another manager must approve your own drawer variance.");
  await compareAndSet(ctx.tx, "cashDrawerSession", row.id, "counting", { status: "closed", closedAt: ctx.now, approvedById: ctx.actorId, approvalNote: note });
  await ctx.audit({ eventType: "drawer.variance_approved", aggregateType: "CashDrawerSession", aggregateId: row.id, yardId: drawer?.yardId, after: { varianceCents: row.varianceCents }, reason: note });
  return ctx.tx.cashDrawerSession.findUnique({ where: { id: row.id } });
}
async function recountDrawerTx(ctx, input) {
  const row = await lockRow(ctx.tx, "CashDrawerSession", input.sessionId);
  if (!row || row.status !== "counting") refuse("Only a counted drawer can be recounted.");
  if (row.cashier !== ctx.actorId && !hasFlag(ctx.session, "canManageCashDrawers")) refuse("This is another cashier\u2019s drawer.");
  await compareAndSet(ctx.tx, "cashDrawerSession", row.id, "counting", { status: "open", countedCents: null, varianceCents: null });
  return ctx.tx.cashDrawerSession.findUnique({ where: { id: row.id } });
}
async function cashPaidToday(tx, payout, now) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const where = { status: "paid", method: "cash", paidAt: { gte: start }, id: { not: payout.id } };
  if (payout.sellerId) where.sellerId = payout.sellerId;
  else if (payout.accountId) where.accountId = payout.accountId;
  else return 0;
  const agg = await tx.payout.aggregate({ where, _sum: { amountCents: true } });
  return agg._sum.amountCents || 0;
}
async function payPayoutTx(ctx, input) {
  const { tx, now } = ctx;
  await refreshDuePayouts(tx, now, { payoutId: input.payoutId });
  const payout = await lockRow(tx, "Payout", input.payoutId);
  if (!payout) refuse("Payout not found.");
  const ticket = payout.ticket ? await tx.scaleTicket.findUnique({ where: { id: payout.ticket } }) : null;
  const yardId = ticket?.yardId || null;
  if (yardId) requireYard(ctx.session, yardId);
  if (payout.status === "paid") refuse("This payout is already paid.");
  if (payout.status === "held") {
    if (await hasPoliceHold(tx, payout.ticket)) refuse("A police hold is on this ticket. The payout cannot be paid.");
    refuse(`This payout is held until ${new Date(payout.releaseAt).toISOString()}.`);
  }
  if (payout.status !== "ready") refuse(`This payout is ${payout.status}.`);
  if (await hasPoliceHold(tx, payout.ticket)) refuse("A police hold is on this ticket. The payout cannot be paid.");
  const allowed = Array.isArray(payout.allowedMethods) && payout.allowedMethods.length ? payout.allowedMethods : ["cash", "check", "transfer"];
  if (!allowed.includes(input.method)) refuse(`This payout can be paid only by ${allowed.join(" or ")}.`);
  const data = { status: "paid", method: input.method, paidById: ctx.actorId, paidAt: now };
  let cashCents = payout.amountCents;
  if (input.method === "cash") {
    if (!input.drawerSessionId) refuse("Open your drawer to pay cash.");
    const { row } = await lockOpenDrawerSession(ctx, input.drawerSessionId);
    const { profile } = yardId ? await yardRules(tx, yardId) : { profile: {} };
    if (profile.cashRounding === "nickel_up") cashCents = roundCashUpToNickel(payout.amountCents);
    if (profile.cashLimitPerTicketCents && cashCents > profile.cashLimitPerTicketCents) refuse(`Cash over ${(profile.cashLimitPerTicketCents / 100).toFixed(2)} per ticket is not allowed here. Pay by check or transfer.`);
    if (profile.cashLimitPerDayCents && await cashPaidToday(tx, payout, now) + cashCents > profile.cashLimitPerDayCents) refuse("This seller has reached today\u2019s cash limit. Pay by check or transfer.");
    const expected = await drawerExpectedCents(tx, row.id);
    if (cashCents > expected) refuse(`The drawer holds ${(expected / 100).toFixed(2)}; add cash from the safe or pay by check.`);
    data.drawerSessionId = row.id;
  } else if (input.method === "check") {
    const checkNumber = String(input.checkNumber || "").trim();
    if (!checkNumber) refuse("Enter the check number.");
    data.checkNumber = checkNumber;
    data.bankAccountLabel = String(input.bankAccountLabel || "Operating").trim();
    const used = await tx.payout.findFirst({ where: { checkNumber, bankAccountLabel: data.bankAccountLabel, id: { not: payout.id } } });
    if (used) refuse(`Check ${checkNumber} on ${data.bankAccountLabel} is already used.`);
  } else {
    const reference = String(input.transferReference || "").trim();
    if (!reference) refuse("Enter the bank transfer reference.");
    data.transferReference = reference;
  }
  await compareAndSet(tx, "payout", payout.id, "ready", data, "This payout was just paid by someone else.");
  if (input.method === "cash") {
    await drawerEvent(ctx, String(data.drawerSessionId), "payout", cashCents, `payout:${payout.id}`, { payoutId: payout.id, ticketId: payout.ticket, note: cashCents !== payout.amountCents ? `Rounded up from ${payout.amountCents} cents` : "" });
  }
  await ctx.audit({ eventType: "payout.paid", aggregateType: "Payout", aggregateId: payout.id, yardId, after: { method: input.method, amountCents: payout.amountCents, cashCents: input.method === "cash" ? cashCents : void 0, checkNumber: data.checkNumber, transferReference: data.transferReference } });
  if (payout.ticket) await maybeSettleTicket(tx, payout.ticket, now);
  if (payout.settlement) await settleIfPaid(ctx, payout.settlement);
  return tx.payout.findUnique({ where: { id: payout.id } });
}
async function returnPayoutTx(ctx, input) {
  const reason = String(input.reason || "").trim();
  if (reason.length < 3) refuse("Give the reason the payment came back.");
  const payout = await lockRow(ctx.tx, "Payout", input.payoutId);
  if (!payout) refuse("Payout not found.");
  if (payout.status !== "paid") refuse("Only a paid payout can be returned.");
  if (payout.method === "cash") refuse("A cash payout cannot be returned; record cash received with an adjustment ticket.");
  await compareAndSet(ctx.tx, "payout", payout.id, "paid", { status: "returned", returnReason: reason });
  const replacement = await ctx.tx.payout.create({
    data: {
      ticketId: payout.ticket,
      settlementId: payout.settlement,
      sellerId: payout.seller,
      accountId: payout.account,
      amountCents: payout.amountCents,
      status: "ready",
      allowedMethods: payout.allowedMethods,
      mailToAddress: payout.mailToAddress,
      replacesId: payout.id
    }
  });
  const lines = await ctx.tx.ticketLine.findMany({ where: { payouts: { some: { id: payout.id } } }, select: { id: true } });
  if (lines.length) await ctx.tx.payout.update({ where: { id: replacement.id }, data: { lines: { connect: lines } } });
  await ctx.audit({ eventType: "payout.returned", aggregateType: "Payout", aggregateId: payout.id, after: { replacementId: replacement.id }, reason });
  return replacement;
}
async function cancelPayoutTx(ctx, input) {
  const reason = String(input.reason || "").trim();
  if (reason.length < 3) refuse("Give a reason.");
  const payout = await lockRow(ctx.tx, "Payout", input.payoutId);
  if (!payout) refuse("Payout not found.");
  await compareAndSet(ctx.tx, "payout", payout.id, ["ready", "held", "pending"], { status: "cancelled", cancelReason: reason }, "Only an unpaid payout can be cancelled.");
  await ctx.audit({ eventType: "payout.cancelled", aggregateType: "Payout", aggregateId: payout.id, reason });
  return ctx.tx.payout.findUnique({ where: { id: payout.id } });
}
async function applyPaymentToInvoice(ctx, invoiceId, amountCents) {
  const invoice = await lockRow(ctx.tx, "Invoice", invoiceId);
  if (!invoice) refuse("Invoice not found.");
  if (invoice.status === "void") refuse("This invoice is void.");
  if (invoice.status === "paid") refuse("This invoice is already paid.");
  const balance = invoice.totalCents - invoice.paidCents;
  if (amountCents > balance) refuse(`The balance due is ${(balance / 100).toFixed(2)}.`);
  const paid = invoice.paidCents + amountCents;
  const status2 = paid >= invoice.totalCents ? "paid" : "partially_paid";
  await compareAndSet(ctx.tx, "invoice", invoice.id, ["open", "partially_paid"], { paidCents: paid, status: status2 });
  if (status2 === "paid") await afterInvoicePaid(ctx, { ...invoice, id: invoice.id, status: status2, paidCents: paid });
  return status2;
}
async function afterInvoicePaid(ctx, invoice) {
  const full = await ctx.tx.invoice.findUnique({ where: { id: invoice.id } });
  if (full.kind === "sale") await afterSaleInvoicePaid(ctx.tx, full, ctx.now);
  if (full.ticketId) await maybeSettleTicket(ctx.tx, full.ticketId, ctx.now);
  if (full.settlementId) await settleIfPaid(ctx, full.settlementId);
  if (full.kind === "service" || full.serviceRequestId) {
    const request = await ctx.tx.serviceRequest.findFirst({ where: { OR: [{ invoiceId: full.id }, ...full.serviceRequestId ? [{ id: full.serviceRequestId }] : []] } });
    if (request?.status === "awaiting_payment") await ctx.tx.serviceRequest.updateMany({ where: { id: request.id, status: "awaiting_payment" }, data: { status: "requested" } });
  }
  await ctx.tx.accountCharge.updateMany({ where: { invoiceLine: { invoiceId: full.id }, status: "invoiced" }, data: { status: "settled" } });
}
async function recordInvoicePaymentTx(ctx, input, key) {
  const amount = Math.trunc(Number(input.amountCents));
  if (!Number.isSafeInteger(amount) || amount <= 0) refuse("The amount must be above zero.");
  if (!["wire", "ach", "check", "cash"].includes(input.method)) refuse("Choose wire, ACH, check or cash.");
  const reference = String(input.reference || "").trim();
  if (input.method !== "cash" && !reference) refuse("Enter the payment reference (wire, ACH or check number).");
  const status2 = await applyPaymentToInvoice(ctx, input.invoiceId, amount);
  const payment = await ctx.tx.payment.create({
    data: { invoiceId: input.invoiceId, method: input.method, amountCents: amount, reference, referenceKey: `manual:${input.method}:${reference || key}:${input.invoiceId}`, receivedAt: input.receivedAt ? new Date(input.receivedAt) : ctx.now, recordedById: ctx.actorId, status: "succeeded" }
  }).catch((error) => {
    if (error?.code === "P2002") refuse("This payment reference is already recorded on this invoice.");
    throw error;
  });
  if (input.method === "cash") {
    if (!input.drawerSessionId) refuse("Open your drawer to take cash.");
    const { row } = await lockOpenDrawerSession(ctx, input.drawerSessionId);
    const invoice = await ctx.tx.invoice.findUnique({ where: { id: input.invoiceId } });
    await drawerEvent(ctx, row.id, "collect", amount, `payment:${payment.id}`, { ticketId: invoice.ticketId, note: `Invoice ${invoice.number}` });
    if (invoice.ticketId) {
      await ctx.tx.$executeRawUnsafe(`UPDATE "ScaleTicket" SET "collectedCents" = "collectedCents" + $1 WHERE "id" = $2`, amount, invoice.ticketId);
      await maybeSettleTicket(ctx.tx, invoice.ticketId, ctx.now);
    }
  }
  await ctx.audit({ eventType: "invoice.payment_recorded", aggregateType: "Invoice", aggregateId: input.invoiceId, after: { paymentId: payment.id, method: input.method, amountCents: amount, reference, status: status2 } });
  return payment;
}
async function voidInvoiceTx(ctx, input) {
  const reason = String(input.reason || "").trim();
  if (reason.length < 3) refuse("Give a reason.");
  const invoice = await lockRow(ctx.tx, "Invoice", input.invoiceId);
  if (!invoice) refuse("Invoice not found.");
  if (invoice.paidCents > 0) refuse("Money was received on this invoice; refund it first.");
  await compareAndSet(ctx.tx, "invoice", invoice.id, "open", { status: "void", voidReason: reason }, "Only an open invoice can be voided.");
  await ctx.tx.accountCharge.updateMany({ where: { invoiceLine: { invoiceId: invoice.id }, status: "invoiced" }, data: { status: "open", invoiceLineId: null } });
  await ctx.audit({ eventType: "invoice.voided", aggregateType: "Invoice", aggregateId: invoice.id, reason });
  return ctx.tx.invoice.findUnique({ where: { id: invoice.id } });
}
async function invoiceAccountChargesTx(ctx, input) {
  const account = await ctx.tx.account.findUnique({ where: { id: input.accountId } });
  if (!account) refuse("Account not found.");
  const charges = await ctx.tx.accountCharge.findMany({ where: { accountId: account.id, status: "open", settlementId: null } });
  if (!charges.length) refuse("This account has no open charges.");
  const total = charges.reduce((s, c) => s + c.amountCents, 0);
  if (total <= 0) refuse("The open charges do not add up to an amount due.");
  const number = await ctx.sequence("business", "invoice");
  const invoice = await ctx.tx.invoice.create({ data: { number, accountId: account.id, kind: "service", status: "open", subtotalCents: total, taxCents: 0, totalCents: total, dueOn: new Date(ctx.now.getTime() + Number(input.netDays ?? account.netDays ?? 30) * 864e5) } });
  for (const charge of charges) {
    const line = await ctx.tx.invoiceLine.create({ data: { invoiceId: invoice.id, description: charge.description || charge.kind, amountCents: charge.amountCents, kind: "fee" } });
    const won = await ctx.tx.accountCharge.updateMany({ where: { id: charge.id, status: "open" }, data: { status: "invoiced", invoiceLineId: line.id } });
    if (won.count !== 1) refuse("A charge changed while invoicing. Try again.");
  }
  await ctx.audit({ eventType: "invoice.issued", aggregateType: "Invoice", aggregateId: invoice.id, after: { totalCents: total, charges: charges.length } });
  return invoice;
}
function publicBaseUrl() {
  return (process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "http://localhost:3000")).replace(/\/$/, "");
}
async function activeCardProvider(tx) {
  const provider = await tx.paymentProvider.findFirst({ where: { code: "pp_stripe", isInstalled: true } });
  if (!provider) refuse("Card payments are not switched on. Install the Stripe provider in Settings \u2192 Payments.");
  return provider;
}
async function createCardSessionTx(ctx, target, key) {
  const { tx } = ctx;
  let amountCents = 0;
  let description = "";
  let payerEmail = "";
  if (target.invoiceId) {
    const invoice = await lockRow(tx, "Invoice", target.invoiceId);
    if (!invoice || !["open", "partially_paid"].includes(invoice.status)) refuse("This invoice is not open.");
    amountCents = invoice.totalCents - invoice.paidCents;
    description = `Invoice ${invoice.number}`;
  } else if (target.serviceRequestId) {
    const request = await lockRow(tx, "ServiceRequest", target.serviceRequestId);
    if (!request || request.status !== "awaiting_payment") refuse("This request has nothing to pay.");
    amountCents = request.feeCents;
    description = `Service request ${request.number}`;
  } else refuse("Choose what to pay.");
  if (amountCents <= 0) refuse("Nothing is due.");
  const existing = await tx.paymentSession.findFirst({ where: { ...target.invoiceId ? { invoiceId: target.invoiceId } : { serviceRequestId: target.serviceRequestId }, status: "pending", amountCents, expiresAt: { gt: ctx.now } } });
  if (existing?.providerPaymentId) return { session: existing, reuse: true, description, payerEmail };
  const provider = await activeCardProvider(tx);
  const settings = await businessSettings(tx);
  const session = existing || await tx.paymentSession.create({
    data: {
      providerId: provider.id,
      invoiceId: target.invoiceId || null,
      serviceRequestId: target.serviceRequestId || null,
      payerId: ctx.actorId,
      amountCents,
      currencyCode: settings.currencyCode || "USD",
      status: "pending",
      idempotencyKeyHash: hashKey(`card-session:${key}`),
      expiresAt: new Date(ctx.now.getTime() + 23 * 36e5)
    }
  });
  if (ctx.actorId) payerEmail = (await tx.user.findUnique({ where: { id: ctx.actorId } }))?.email || "";
  return { session, reuse: false, description, payerEmail };
}
async function startProviderCheckout(prisma, sessionId, input) {
  const session = await prisma.paymentSession.findUnique({ where: { id: sessionId }, include: { provider: true } });
  if (session.providerPaymentId) {
    const meta = session.metadata || {};
    return { sessionId, url: meta.url || null };
  }
  const { adapter } = await paymentAdapter(session.provider.code);
  const base = publicBaseUrl();
  const sep = input.returnPath.includes("?") ? "&" : "?";
  const result = await adapter.createPaymentFunction({
    provider: { code: session.provider.code },
    amount: session.amountCents,
    currency: session.currencyCode,
    description: input.description,
    customerEmail: input.payerEmail,
    idempotencyKey: `recycling-session-${session.id}`,
    metadata: { paymentSessionId: session.id },
    successUrl: `${base}${input.returnPath}${sep}payment=${session.id}`,
    cancelUrl: `${base}${input.returnPath}${sep}payment=${session.id}&cancelled=1`
  });
  await prisma.paymentSession.updateMany({ where: { id: session.id, providerPaymentId: null }, data: { providerPaymentId: result.id, metadata: { url: result.url } } });
  return { sessionId, url: result.url };
}
var SESSION_FORWARD = {
  pending: ["captured", "failed", "cancelled", "expired"],
  requires_action: ["captured", "failed", "cancelled", "expired"],
  authorized: ["captured", "failed", "cancelled"]
};
async function reconcileCardSession(context, sessionId) {
  const prisma = context.sudo().prisma;
  const session = await prisma.paymentSession.findUnique({ where: { id: sessionId }, include: { provider: true } });
  if (!session) throw new CommandError("Payment not found.", "NOT_FOUND");
  const registration = getPaymentProviderRegistration(session.provider?.code || "");
  if (!registration || registration.settlement !== "processor" || !session.providerPaymentId) return session;
  if (!["pending", "requires_action", "authorized"].includes(session.status)) return session;
  const { adapter } = await paymentAdapter(session.provider.code);
  const remote = await adapter.getPaymentStatusFunction({ provider: { code: session.provider.code }, paymentId: session.providerPaymentId });
  const observed = String(remote.status || "");
  if (remote.amount != null && Number(remote.amount) !== session.amountCents) throw new CommandError("The provider reported a different amount. Review this payment with the provider.");
  const next = observed === "expired" ? "cancelled" : observed === "refunded" || observed === "partially_refunded" ? "captured" : observed;
  if (!SESSION_FORWARD[session.status]?.includes(next)) return session;
  return runCommand(context.sudo(), { name: "captureCardSession", input: { sessionId }, idempotencyKey: `${sessionId}:${next}` }, async (ctx) => {
    const row = await lockRow(ctx.tx, "PaymentSession", sessionId);
    if (!SESSION_FORWARD[row.status]?.includes(next)) return ctx.tx.paymentSession.findUnique({ where: { id: sessionId } });
    if (next !== "captured") {
      await compareAndSet(ctx.tx, "paymentSession", sessionId, row.status, { status: next });
      return ctx.tx.paymentSession.findUnique({ where: { id: sessionId } });
    }
    await compareAndSet(ctx.tx, "paymentSession", sessionId, row.status, { status: "captured", capturedAt: ctx.now, capturedCents: row.amountCents });
    const payment = await ctx.tx.payment.create({ data: { invoiceId: row.invoice, sessionId, method: "card", amountCents: row.amountCents, reference: row.providerPaymentId, referenceKey: `card:${row.providerPaymentId}`, receivedAt: ctx.now, status: "succeeded" } });
    if (row.invoice) {
      const invoice = await lockRow(ctx.tx, "Invoice", row.invoice);
      const room = invoice.totalCents - invoice.paidCents;
      if (invoice.status === "void" || room < row.amountCents) {
        await ctx.audit({ eventType: "payment.overpaid", aggregateType: "PaymentSession", aggregateId: sessionId, after: { invoiceId: row.invoice, amountCents: row.amountCents, balanceCents: room }, reason: "Card payment captured after the invoice was settled or voided; refund it." });
      } else {
        await applyPaymentToInvoice(ctx, row.invoice, row.amountCents);
      }
    }
    if (row.serviceRequest) {
      await ctx.tx.serviceRequest.updateMany({ where: { id: row.serviceRequest, status: "awaiting_payment" }, data: { status: "requested" } });
    }
    await ctx.audit({ eventType: "payment.captured", aggregateType: "PaymentSession", aggregateId: sessionId, after: { paymentId: payment.id, amountCents: row.amountCents } });
    return ctx.tx.paymentSession.findUnique({ where: { id: sessionId } });
  });
}
async function reserveRefundTx(ctx, input, key) {
  const amount = Math.trunc(Number(input.amountCents));
  if (!Number.isSafeInteger(amount) || amount <= 0) refuse("The refund must be above zero.");
  const reason = String(input.reason || "").trim();
  if (reason.length < 3) refuse("Give a reason for the refund.");
  const payment = await lockRow(ctx.tx, "Payment", input.paymentId);
  if (!payment || payment.status !== "succeeded") refuse("Payment not found.");
  const pending = await ctx.tx.refund.aggregate({ where: { paymentId: payment.id, status: "pending" }, _sum: { amountCents: true } });
  const room = payment.amountCents - payment.refundedCents - (pending._sum.amountCents || 0);
  if (amount > room) refuse(`At most ${(room / 100).toFixed(2)} can be refunded on this payment.`);
  const refund = await ctx.tx.refund.create({ data: { paymentId: payment.id, sessionId: payment.session, amountCents: amount, reason, status: "pending", claimId: input.claimId || null, serviceRequestId: input.serviceRequestId || null, createdById: ctx.actorId, idempotencyKeyHash: hashKey(`refund:${key}`) } });
  if (payment.method !== "card") {
    await finishRefund(ctx, refund.id, { ok: true, providerRefundId: null });
  }
  await ctx.audit({ eventType: "refund.created", aggregateType: "Refund", aggregateId: refund.id, after: { paymentId: payment.id, amountCents: amount, method: payment.method }, reason });
  return ctx.tx.refund.findUnique({ where: { id: refund.id } });
}
async function finishRefund(ctx, refundId, outcome) {
  const refund = await lockRow(ctx.tx, "Refund", refundId);
  if (!refund || refund.status !== "pending") return;
  if (!outcome.ok) {
    await compareAndSet(ctx.tx, "refund", refundId, "pending", { status: "failed", failureMessage: outcome.failureMessage || "The provider refused the refund." });
    return;
  }
  await compareAndSet(ctx.tx, "refund", refundId, "pending", { status: "succeeded", providerRefundId: outcome.providerRefundId });
  const payment = await lockRow(ctx.tx, "Payment", refund.payment);
  await ctx.tx.payment.update({ where: { id: payment.id }, data: { refundedCents: payment.refundedCents + refund.amountCents } });
  if (payment.session) {
    const s = await lockRow(ctx.tx, "PaymentSession", payment.session);
    const refunded = s.refundedCents + refund.amountCents;
    await ctx.tx.paymentSession.update({ where: { id: s.id }, data: { refundedCents: refunded, status: refunded >= s.capturedCents ? "refunded" : "partially_refunded" } });
  }
  if (payment.invoice && !refund.claim) {
    const invoice = await lockRow(ctx.tx, "Invoice", payment.invoice);
    await ctx.tx.invoice.update({ where: { id: invoice.id }, data: { refundedCents: invoice.refundedCents + refund.amountCents } });
  }
}
async function runProviderRefund(context, refundId) {
  const prisma = context.sudo().prisma;
  const refund = await prisma.refund.findUnique({ where: { id: refundId }, include: { session: { include: { provider: true } } } });
  if (!refund || refund.status !== "pending" || !refund.session?.providerPaymentId) return refund;
  const { adapter } = await paymentAdapter(refund.session.provider.code);
  let outcome;
  try {
    const result = await adapter.refundPaymentFunction({ provider: { code: refund.session.provider.code }, paymentId: refund.session.providerPaymentId, amount: refund.amountCents, idempotencyKey: `recycling-refund-${refund.id}` });
    outcome = { ok: result.status === "refunded" || result.status === "pending", providerRefundId: result.id || null, failureMessage: result.failureMessage };
  } catch (error) {
    outcome = { ok: false, providerRefundId: null, failureMessage: error instanceof Error ? error.message : String(error) };
  }
  await runCommand(context.sudo(), { name: "finishRefund", input: { refundId }, idempotencyKey: `finish:${refundId}` }, async (ctx) => {
    await finishRefund(ctx, refundId, outcome);
    return { id: refundId };
  });
  return prisma.refund.findUnique({ where: { id: refundId } });
}
async function buildSettlementTx(ctx, input) {
  const { tx } = ctx;
  const account = await tx.account.findUnique({ where: { id: input.accountId } });
  if (!account) refuse("Account not found.");
  const start = new Date(input.periodStart);
  const end = new Date(input.periodEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) refuse("The period is not valid.");
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "recycling-settlement", account.id);
  const tickets = await tx.scaleTicket.findMany({ where: { accountId: account.id, paymentMode: "on_account", status: "completed", settlementId: null, completedAt: { gte: start, lt: end } } });
  const charges = await tx.accountCharge.findMany({ where: { accountId: account.id, status: "open", settlementId: null, OR: [{ serviceDate: null }, { serviceDate: { lt: end } }] } });
  const donations = account.isNonprofit ? await tx.donation.findMany({ where: { accountId: account.id, status: "credited", settlementId: null, kind: "payout_donation" } }) : [];
  if (!tickets.length && !charges.length && !donations.length) refuse("Nothing is due for this account in that period.");
  const ticketTotal = tickets.reduce((s, t) => s + t.totalCents, 0);
  const chargeTotal = charges.reduce((s, c) => s + c.amountCents, 0);
  const donationTotal = donations.reduce((s, d) => s + d.amountCents, 0);
  const number = await ctx.sequence("business", "settlement");
  const settlement = await tx.settlement.create({
    data: { accountId: account.id, number, status: "draft", periodStart: start, periodEnd: end, ticketTotalCents: ticketTotal, chargeTotalCents: chargeTotal, donationTotalCents: donationTotal, netCents: ticketTotal - chargeTotal + donationTotal }
  });
  for (const t of tickets) if ((await tx.scaleTicket.updateMany({ where: { id: t.id, settlementId: null, status: "completed" }, data: { settlementId: settlement.id } })).count !== 1) refuse("A ticket joined another settlement. Try again.");
  for (const c of charges) if ((await tx.accountCharge.updateMany({ where: { id: c.id, settlementId: null, status: "open" }, data: { settlementId: settlement.id } })).count !== 1) refuse("A charge joined another settlement. Try again.");
  for (const d of donations) if ((await tx.donation.updateMany({ where: { id: d.id, settlementId: null, status: "credited" }, data: { settlementId: settlement.id } })).count !== 1) refuse("A donation joined another settlement. Try again.");
  await ctx.audit({ eventType: "settlement.built", aggregateType: "Settlement", aggregateId: settlement.id, after: { tickets: tickets.length, charges: charges.length, donations: donations.length, netCents: settlement.netCents } });
  return settlement;
}
async function approveSettlementTx(ctx, input) {
  const { tx, now } = ctx;
  const s = await lockRow(tx, "Settlement", input.settlementId);
  if (!s) refuse("Settlement not found.");
  const account = await tx.account.findUnique({ where: { id: s.account } });
  const data = { status: "approved", approvedById: ctx.actorId, approvedAt: now };
  if (s.netCents > 0) {
    const payout = await tx.payout.create({ data: { settlementId: s.id, accountId: s.account, amountCents: s.netCents, status: "ready", allowedMethods: ["check", "transfer"] } });
    data.payoutId = payout.id;
  } else if (s.netCents < 0) {
    const number = await ctx.sequence("business", "invoice");
    const invoice = await tx.invoice.create({ data: { number, accountId: s.account, kind: "settlement_balance", status: "open", subtotalCents: -s.netCents, taxCents: 0, totalCents: -s.netCents, settlementId: s.id, dueOn: new Date(now.getTime() + Number(account?.netDays ?? 30) * 864e5), lines: { create: [{ description: `Settlement ${s.number} balance`, amountCents: -s.netCents, kind: "adjustment" }] } } });
    data.invoiceId = invoice.id;
  }
  await compareAndSet(tx, "settlement", s.id, "draft", data, "Only a draft settlement can be approved.");
  await tx.accountCharge.updateMany({ where: { settlementId: s.id, status: "open" }, data: { status: "settled" } });
  if (s.netCents === 0) await markSettlementPaid(ctx, s.id);
  await ctx.audit({ eventType: "settlement.approved", aggregateType: "Settlement", aggregateId: s.id, after: { netCents: s.netCents, payoutId: data.payoutId, invoiceId: data.invoiceId } });
  return tx.settlement.findUnique({ where: { id: s.id } });
}
async function markSettlementPaid(ctx, settlementId) {
  const won = await ctx.tx.settlement.updateMany({ where: { id: settlementId, status: "approved" }, data: { status: "paid", paidAt: ctx.now } });
  if (won.count !== 1) return;
  await ctx.tx.donation.updateMany({ where: { settlementId, status: "credited" }, data: { status: "disbursed" } });
  const tickets = await ctx.tx.scaleTicket.findMany({ where: { settlementId }, select: { id: true } });
  for (const t of tickets) await maybeSettleTicket(ctx.tx, t.id, ctx.now);
  await ctx.audit({ eventType: "settlement.paid", aggregateType: "Settlement", aggregateId: settlementId });
}
async function settleIfPaid(ctx, settlementId) {
  const s = await ctx.tx.settlement.findUnique({ where: { id: settlementId }, include: { payout: true, invoice: true } });
  if (!s || s.status !== "approved") return;
  if (s.payout && s.payout.status === "paid" || s.invoice && s.invoice.status === "paid") await markSettlementPaid(ctx, settlementId);
}
async function voidSettlementTx(ctx, input) {
  const reason = String(input.reason || "").trim();
  if (reason.length < 3) refuse("Give a reason.");
  const s = await lockRow(ctx.tx, "Settlement", input.settlementId);
  if (!s) refuse("Settlement not found.");
  if (s.status === "approved") {
    const payout = s.payout ? await ctx.tx.payout.findUnique({ where: { id: s.payout } }) : null;
    const invoice = s.invoice ? await ctx.tx.invoice.findUnique({ where: { id: s.invoice } }) : null;
    if (payout?.status === "paid" || invoice && invoice.paidCents > 0) refuse("Money moved on this settlement; it cannot be voided.");
    if (payout) await compareAndSet(ctx.tx, "payout", payout.id, ["ready", "held", "pending"], { status: "cancelled", cancelReason: `Settlement voided: ${reason}` });
    if (invoice) await compareAndSet(ctx.tx, "invoice", invoice.id, "open", { status: "void", voidReason: `Settlement voided: ${reason}` });
    await ctx.tx.accountCharge.updateMany({ where: { settlementId: s.id, status: "settled" }, data: { status: "open" } });
  }
  await compareAndSet(ctx.tx, "settlement", s.id, ["draft", "approved"], { status: "void", voidReason: reason }, "A paid settlement cannot be voided.");
  await ctx.tx.scaleTicket.updateMany({ where: { settlementId: s.id }, data: { settlementId: null } });
  await ctx.tx.accountCharge.updateMany({ where: { settlementId: s.id }, data: { settlementId: null } });
  await ctx.tx.donation.updateMany({ where: { settlementId: s.id }, data: { settlementId: null } });
  await ctx.audit({ eventType: "settlement.voided", aggregateType: "Settlement", aggregateId: s.id, reason });
  return ctx.tx.settlement.findUnique({ where: { id: s.id } });
}
var moneyTypeDefs = `
  type CardCheckout { paymentSessionId: ID!, url: String }
`;
var moneyMutationDefs = `
  openDrawerSession(drawerId: ID!, openingFloatCents: Int!, idempotencyKey: String): CashDrawerSession
  moveDrawerCash(sessionId: ID!, kind: String!, amountCents: Int!, note: String, idempotencyKey: String!): CashDrawerSession
  countDrawer(sessionId: ID!, countedCents: Int!, idempotencyKey: String): CashDrawerSession
  recountDrawer(sessionId: ID!): CashDrawerSession
  approveDrawerClose(sessionId: ID!, note: String!, idempotencyKey: String): CashDrawerSession
  payPayout(payoutId: ID!, method: String!, drawerSessionId: ID, checkNumber: String, bankAccountLabel: String, transferReference: String, idempotencyKey: String): Payout
  returnPayout(payoutId: ID!, reason: String!, idempotencyKey: String): Payout
  cancelPayout(payoutId: ID!, reason: String!, idempotencyKey: String): Payout
  recordInvoicePayment(invoiceId: ID!, method: String!, amountCents: Int!, reference: String, drawerSessionId: ID, receivedAt: String, idempotencyKey: String!): Payment
  voidInvoice(invoiceId: ID!, reason: String!, idempotencyKey: String): Invoice
  invoiceAccountCharges(accountId: ID!, netDays: Int, idempotencyKey: String): Invoice
  payInvoiceByCard(invoiceId: ID!, returnPath: String, idempotencyKey: String!): CardCheckout
  reconcilePaymentSession(paymentSessionId: ID!): PaymentSession
  refundPayment(paymentId: ID!, amountCents: Int!, reason: String!, idempotencyKey: String!): Refund
  buildSettlement(accountId: ID!, periodStart: String!, periodEnd: String!, idempotencyKey: String): Settlement
  approveSettlement(settlementId: ID!, idempotencyKey: String): Settlement
  voidSettlement(settlementId: ID!, reason: String!, idempotencyKey: String): Settlement
`;
var moneyQueryDefs = `
  payoutQueue(yardId: ID): [Payout!]
`;
async function canSeeInvoice(context, invoice) {
  const session = context.session;
  if (hasFlag(session, "canManageFinance") || hasFlag(session, "canPaySellers")) return true;
  if (!session?.itemId) return false;
  const prisma = context.sudo().prisma;
  if (invoice.accountId && await prisma.accountContact.findFirst({ where: { accountId: invoice.accountId, userId: session.itemId, status: "active", role: { in: ["owner", "billing", "admin"] } } })) return true;
  if (invoice.sellerId && await prisma.seller.findFirst({ where: { id: invoice.sellerId, userId: session.itemId } })) return true;
  return false;
}
var moneyResolvers = {
  Mutation: {
    openDrawerSession: (_, a, c) => runCommand(c, { name: "openDrawerSession", input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: ["canPaySellers", "canManageCashDrawers"], aggregateType: "CashDrawerSession" }, (ctx) => openDrawerSessionTx(ctx, a)).then((r) => c.db.CashDrawerSession.findOne({ where: { id: r.id } })),
    moveDrawerCash: (_, a, c) => runCommand(c, { name: "moveDrawerCash", input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: ["canPaySellers", "canManageCashDrawers"] }, (ctx) => moveDrawerCashTx(ctx, a, String(cleanKey(a.idempotencyKey)))).then((r) => c.db.CashDrawerSession.findOne({ where: { id: r.id } })),
    countDrawer: (_, a, c) => runCommand(c, { name: "countDrawer", input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: ["canPaySellers", "canManageCashDrawers"] }, (ctx) => countDrawerTx(ctx, a)).then((r) => c.db.CashDrawerSession.findOne({ where: { id: r.id } })),
    recountDrawer: (_, a, c) => runCommand(c, { name: "recountDrawer", input: a, permission: ["canPaySellers", "canManageCashDrawers"] }, (ctx) => recountDrawerTx(ctx, a)).then((r) => c.db.CashDrawerSession.findOne({ where: { id: r.id } })),
    approveDrawerClose: (_, a, c) => runCommand(c, { name: "approveDrawerClose", input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: ["canApproveVariances"] }, (ctx) => approveDrawerCloseTx(ctx, a)).then((r) => c.db.CashDrawerSession.findOne({ where: { id: r.id } })),
    payPayout: (_, a, c) => runCommand(c, { name: "payPayout", input: { ...a, idempotencyKey: void 0 }, idempotencyKey: cleanKey(a.idempotencyKey), permission: "canPaySellers", aggregateType: "Payout" }, (ctx) => payPayoutTx(ctx, a)).then((r) => c.db.Payout.findOne({ where: { id: r.id } })),
    returnPayout: (_, a, c) => runCommand(c, { name: "returnPayout", input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: "canManageFinance" }, (ctx) => returnPayoutTx(ctx, a)).then((r) => c.db.Payout.findOne({ where: { id: r.id } })),
    cancelPayout: (_, a, c) => runCommand(c, { name: "cancelPayout", input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: "canApproveVariances" }, (ctx) => cancelPayoutTx(ctx, a)).then((r) => c.db.Payout.findOne({ where: { id: r.id } })),
    recordInvoicePayment: (_, a, c) => runCommand(c, { name: "recordInvoicePayment", input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: ["canManageFinance", "canPaySellers"] }, (ctx) => recordInvoicePaymentTx(ctx, a, String(cleanKey(a.idempotencyKey)))).then((r) => c.db.Payment.findOne({ where: { id: r.id } })),
    voidInvoice: (_, a, c) => runCommand(c, { name: "voidInvoice", input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: "canManageFinance" }, (ctx) => voidInvoiceTx(ctx, a)).then((r) => c.db.Invoice.findOne({ where: { id: r.id } })),
    invoiceAccountCharges: (_, a, c) => runCommand(c, { name: "invoiceAccountCharges", input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: "canManageFinance" }, (ctx) => invoiceAccountChargesTx(ctx, a)).then((r) => c.db.Invoice.findOne({ where: { id: r.id } })),
    payInvoiceByCard: async (_, a, c) => {
      const invoice = await c.sudo().prisma.invoice.findUnique({ where: { id: a.invoiceId } });
      if (!invoice || !await canSeeInvoice(c, invoice)) throw new CommandError("Invoice not found.", "NOT_FOUND");
      const created = await runCommand(c, { name: "payInvoiceByCard", input: { invoiceId: a.invoiceId }, idempotencyKey: cleanKey(a.idempotencyKey), requireSignIn: true }, (ctx) => createCardSessionTx(ctx, { invoiceId: a.invoiceId }, String(cleanKey(a.idempotencyKey))));
      const returnPath = typeof a.returnPath === "string" && a.returnPath.startsWith("/") && !a.returnPath.startsWith("//") ? a.returnPath : `/account/invoices/${a.invoiceId}`;
      const checkout = await startProviderCheckout(c.sudo().prisma, created.session.id, { description: created.description, payerEmail: created.payerEmail, returnPath });
      return { paymentSessionId: checkout.sessionId, url: checkout.url };
    },
    reconcilePaymentSession: async (_, a, c) => {
      const session = await c.sudo().prisma.paymentSession.findUnique({ where: { id: a.paymentSessionId } });
      if (!session) throw new CommandError("Payment not found.", "NOT_FOUND");
      const staff = hasFlag(c.session, "canManageFinance");
      if (!staff && session.payerId !== c.session?.itemId) throw new CommandError("Payment not found.", "NOT_FOUND");
      const result = await reconcileCardSession(c, a.paymentSessionId);
      return staff ? c.db.PaymentSession.findOne({ where: { id: result.id } }) : { id: result.id, status: result.status, amountCents: result.amountCents };
    },
    refundPayment: async (_, a, c) => {
      const r = await runCommand(c, { name: "refundPayment", input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: "canManageFinance" }, (ctx) => reserveRefundTx(ctx, a, String(cleanKey(a.idempotencyKey))));
      if (r.status === "pending") await runProviderRefund(c, r.id);
      return c.db.Refund.findOne({ where: { id: r.id } });
    },
    buildSettlement: (_, a, c) => runCommand(c, { name: "buildSettlement", input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: "canManageFinance" }, (ctx) => buildSettlementTx(ctx, a)).then((r) => c.db.Settlement.findOne({ where: { id: r.id } })),
    approveSettlement: (_, a, c) => runCommand(c, { name: "approveSettlement", input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: "canManageFinance" }, (ctx) => approveSettlementTx(ctx, a)).then((r) => c.db.Settlement.findOne({ where: { id: r.id } })),
    voidSettlement: (_, a, c) => runCommand(c, { name: "voidSettlement", input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: "canManageFinance" }, (ctx) => voidSettlementTx(ctx, a)).then((r) => c.db.Settlement.findOne({ where: { id: r.id } }))
  },
  Query: {
    payoutQueue: async (_, { yardId }, c) => {
      if (!hasFlag(c.session, "canPaySellers") && !hasFlag(c.session, "canManageFinance")) throw new CommandError("Staff only.", "FORBIDDEN");
      await refreshDuePayouts(c.sudo().prisma, /* @__PURE__ */ new Date());
      return c.db.Payout.findMany({ where: { status: { in: ["ready", "held"] }, ...yardId ? { ticket: { yard: { id: { equals: yardId } } } } : {} }, orderBy: [{ createdAt: "asc" }] });
    }
  }
};

// features/keystone/commands/index.ts
var commandModules = [
  { typeDefs: ticketTypeDefs, mutationDefs: ticketMutationDefs, queryDefs: ticketQueryDefs, resolvers: ticketResolvers },
  { typeDefs: moneyTypeDefs, mutationDefs: moneyMutationDefs, queryDefs: moneyQueryDefs, resolvers: moneyResolvers }
];

// features/keystone/mutations/index.ts
var graphql4 = String.raw;
function extendGraphqlSchema(baseSchema) {
  const typeDefs = commandModules.map((m) => m.typeDefs || "").join("\n");
  const mutations = commandModules.map((m) => m.mutationDefs || "").join("\n");
  const queries = commandModules.map((m) => m.queryDefs || "").join("\n");
  const resolvers = { Query: { redirectToInit: redirectToInit_default }, Mutation: {} };
  for (const m of commandModules) {
    Object.assign(resolvers.Query, m.resolvers.Query || {});
    Object.assign(resolvers.Mutation, m.resolvers.Mutation || {});
    for (const [type, fields] of Object.entries(m.resolvers)) {
      if (type === "Query" || type === "Mutation") continue;
      resolvers[type] = { ...resolvers[type] || {}, ...fields };
    }
  }
  return (0, import_schema.mergeSchemas)({
    schemas: [baseSchema],
    typeDefs: graphql4`
      ${typeDefs}
      type Query {
        redirectToInit: Boolean
        ${queries}
      }
      type Mutation {
        ${mutations}
      }
    `,
    resolvers
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
