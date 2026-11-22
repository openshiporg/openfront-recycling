/**
 * Onboarding templates (dissertation §11). Real trade names and sensible starting prices; the owner
 * changes prices on the first day. Pure data, no database access.
 */

export type MaterialTemplate = {
  code: string; name: string; category: string; unit: 'lb' | 'net_ton' | 'gross_ton' | 'each' | 'kg' | 'cwt' | 'metric_tonne'; price: string; high?: string;
  direction?: 'pay_seller' | 'charge_customer'; isPublic?: boolean; acceptsFromPublic?: boolean; spec?: string; description?: string; tips?: string; minimumWeight?: string
}
export type CategoryTemplate = { slug: string; name: string; kind: 'ferrous' | 'non_ferrous' | 'electronics' | 'paper' | 'plastic' | 'glass' | 'other'; sortOrder: number }

export const SCRAP_CATEGORIES: CategoryTemplate[] = [
  { slug: 'copper', name: 'Copper', kind: 'non_ferrous', sortOrder: 10 },
  { slug: 'brass', name: 'Brass', kind: 'non_ferrous', sortOrder: 20 },
  { slug: 'aluminum', name: 'Aluminum', kind: 'non_ferrous', sortOrder: 30 },
  { slug: 'stainless', name: 'Stainless Steel', kind: 'non_ferrous', sortOrder: 40 },
  { slug: 'other-non-ferrous', name: 'Other Non-Ferrous', kind: 'non_ferrous', sortOrder: 50 },
  { slug: 'ferrous', name: 'Ferrous (Steel and Iron)', kind: 'ferrous', sortOrder: 60 },
  { slug: 'electronics', name: 'Electronics', kind: 'electronics', sortOrder: 70 },
  { slug: 'fees', name: 'Disposal Fees', kind: 'other', sortOrder: 90 },
]

export const SCRAP_MATERIALS: MaterialTemplate[] = [
  { code: 'CU-BB', name: 'Bare Bright Copper', category: 'copper', unit: 'lb', price: '4.10', spec: 'ISRI Barley', description: 'Clean, unalloyed, uncoated copper wire, 16 gauge or thicker, stripped of all insulation.', tips: 'Strip all insulation. No tarnish, solder, paint or plating.' },
  { code: 'CU-1', name: '#1 Copper Tubing', category: 'copper', unit: 'lb', price: '3.85', spec: 'ISRI Berry / Clove', description: 'Clean copper pipe and bus bar with no fittings, solder or paint.', tips: 'Cut off brass fittings and solder joints.' },
  { code: 'CU-2', name: '#2 Copper', category: 'copper', unit: 'lb', price: '3.55', spec: 'ISRI Birch / Cliff', description: 'Copper pipe and wire with solder, paint, coating or light corrosion.' },
  { code: 'CU-ICW-H', name: 'Insulated Copper Wire (High Recovery)', category: 'copper', unit: 'lb', price: '2.20', description: 'THHN and building wire, about 70 percent copper or more.', tips: 'No plugs or attachments.' },
  { code: 'CU-ICW-M', name: 'Insulated Copper Wire (Medium Recovery)', category: 'copper', unit: 'lb', price: '1.40', description: 'Romex and heavy cable, about 50 to 70 percent copper.' },
  { code: 'CU-ICW-L', name: 'Insulated Copper Wire (Low Recovery)', category: 'copper', unit: 'lb', price: '0.60', description: 'Extension cords, Christmas lights and data cable.' },
  { code: 'CU-RAD', name: 'Copper Radiators', category: 'copper', unit: 'lb', price: '2.45', description: 'Copper-brass automotive radiators, drained.', tips: 'Drain all fluid. Remove plastic tanks and steel brackets for the best price.' },
  { code: 'BR-Y', name: 'Yellow Brass', category: 'brass', unit: 'lb', price: '2.55', spec: 'ISRI Honey', description: 'Plumbing fittings, valves, keys and shell casings with no iron.' },
  { code: 'BR-R', name: 'Red Brass', category: 'brass', unit: 'lb', price: '2.95', spec: 'ISRI Ebony', description: 'Water meters, gate valves and bronze castings.' },
  { code: 'BR-RAD', name: 'Brass Radiators', category: 'brass', unit: 'lb', price: '2.40', spec: 'ISRI Ocean', description: 'Clean brass-tank radiators, drained.' },
  { code: 'AL-UBC', name: 'Aluminum Cans (UBC)', category: 'aluminum', unit: 'lb', price: '0.55', spec: 'ISRI Talap', description: 'Used beverage cans, empty and dry.', tips: 'Empty and dry. Bagged loose is fine; no food or trash in the bag.' },
  { code: 'AL-SHT', name: 'Aluminum Sheet', category: 'aluminum', unit: 'lb', price: '0.50', spec: 'ISRI Taint/Tabor', description: 'Siding, gutters and clean sheet with no attachments.' },
  { code: 'AL-CST', name: 'Cast Aluminum', category: 'aluminum', unit: 'lb', price: '0.45', spec: 'ISRI Tense', description: 'Clean cast parts: transmission cases, lawnmower decks, intake manifolds.' },
  { code: 'AL-6063', name: 'Aluminum Extrusion 6063', category: 'aluminum', unit: 'lb', price: '0.80', spec: 'ISRI Tread', description: 'Clean window and door frames, no glass, rubber or steel screws.' },
  { code: 'AL-RIM', name: 'Aluminum Rims', category: 'aluminum', unit: 'lb', price: '0.95', spec: 'ISRI Troma', description: 'Clean car and truck wheels, tires and weights removed.', tips: 'Remove tires, valve stems and wheel weights.' },
  { code: 'AL-ACR', name: 'Aluminum-Copper Radiators', category: 'aluminum', unit: 'lb', price: '1.75', spec: 'ISRI Talk', description: 'AC coils with aluminum fins on copper tube, no steel frame.' },
  { code: 'AL-TRN', name: 'Aluminum Turnings', category: 'aluminum', unit: 'lb', price: '0.25', spec: 'ISRI Teens', description: 'Clean, dry machining turnings.' },
  { code: 'AL-EC', name: 'Aluminum Wire (EC)', category: 'aluminum', unit: 'lb', price: '1.05', description: 'Bare electrical conductor aluminum wire.' },
  { code: 'SS-304', name: 'Stainless Steel 304', category: 'stainless', unit: 'lb', price: '0.55', description: 'Non-magnetic 18-8 stainless: sinks, food equipment, clean solids.', tips: 'A magnet should not stick.' },
  { code: 'SS-316', name: 'Stainless Steel 316', category: 'stainless', unit: 'lb', price: '0.80', description: 'Molybdenum stainless, tested at the scale.' },
  { code: 'PB', name: 'Lead', category: 'other-non-ferrous', unit: 'lb', price: '0.65', description: 'Soft lead, wheel weights and lead sheet.' },
  { code: 'PB-BAT', name: 'Lead-acid Batteries', category: 'other-non-ferrous', unit: 'lb', price: '0.18', description: 'Car, truck and industrial batteries, whole and not leaking.', tips: 'Keep upright. Cracked or leaking batteries must be in a sealed tub.' },
  { code: 'MTR', name: 'Electric Motors', category: 'other-non-ferrous', unit: 'lb', price: '0.32', description: 'Copper-wound motors, starters and alternators.' },
  { code: 'SEAL', name: 'Sealed Units', category: 'other-non-ferrous', unit: 'lb', price: '0.22', description: 'Refrigeration compressors, refrigerant recovered.' },
  { code: 'XFMR', name: 'Transformers', category: 'other-non-ferrous', unit: 'lb', price: '0.15', description: 'Small dry transformers and ballasts (no oil-filled units).' },
  { code: 'CAT', name: 'Catalytic Converters', category: 'other-non-ferrous', unit: 'each', price: '45.00', high: '350.00', isPublic: false, description: 'Priced one by one by make and model. Proof of ownership required.', tips: 'Bring the vehicle title or a repair invoice.' },
  { code: 'CARB', name: 'Carbide', category: 'other-non-ferrous', unit: 'lb', price: '4.50', description: 'Tungsten carbide inserts, drills and end mills.' },
  { code: 'ZN', name: 'Zinc Die Cast', category: 'other-non-ferrous', unit: 'lb', price: '0.45', spec: 'ISRI Saves', description: 'Faucets, door handles and carburetors.' },
  { code: 'FE-HMS1', name: 'HMS #1', category: 'ferrous', unit: 'net_ton', price: '210.00', description: 'Heavy melting steel 1/4 inch and thicker, cut to 5 ft by 2 ft.' },
  { code: 'FE-HMS2', name: 'HMS #2', category: 'ferrous', unit: 'net_ton', price: '190.00', description: 'Heavy melting steel under 1/4 inch, some coating allowed.' },
  { code: 'FE-PS', name: 'Plate and Structural', category: 'ferrous', unit: 'net_ton', price: '230.00', description: 'Plate, beams and channel, cut to size.' },
  { code: 'FE-CI', name: 'Cast Iron', category: 'ferrous', unit: 'net_ton', price: '220.00', description: 'Engine blocks (drained), radiators, bathtubs and pipe.' },
  { code: 'FE-SHR', name: 'Light Iron (Shred)', category: 'ferrous', unit: 'net_ton', price: '165.00', description: 'Sheet steel, grills, bikes and mixed light steel.' },
  { code: 'FE-UNP', name: 'Unprepared Steel', category: 'ferrous', unit: 'net_ton', price: '150.00', description: 'Oversize steel that needs cutting.' },
  { code: 'FE-APP', name: 'Appliances', category: 'ferrous', unit: 'net_ton', price: '140.00', description: 'Washers, dryers, water heaters and stoves. Freon units carry a fee.' },
  { code: 'FE-AUTO', name: 'Auto Bodies', category: 'ferrous', unit: 'net_ton', price: '160.00', description: 'Complete cars with title. Fluids drained, tires and battery may be removed.', tips: 'Bring the title in your name.' },
  { code: 'FE-ROT', name: 'Rotors and Drums', category: 'ferrous', unit: 'net_ton', price: '240.00', description: 'Brake rotors and drums, no hubs.' },
  { code: 'EL-PC', name: 'Computers', category: 'electronics', unit: 'lb', price: '0.20', description: 'Desktop towers and servers, whole.' },
  { code: 'EL-PCB', name: 'Circuit Boards', category: 'electronics', unit: 'lb', price: '1.50', description: 'Motherboards and low-grade boards, sorted.' },
  { code: 'EL-WIRE', name: 'Mixed Wire', category: 'electronics', unit: 'lb', price: '0.85', description: 'Mixed power cords and harness wire with plugs.' },
  { code: 'FEE-TIRE', name: 'Tires', category: 'fees', unit: 'each', price: '5.00', direction: 'charge_customer', description: 'Passenger and light truck tires, on or off the rim.' },
  { code: 'FEE-FRN', name: 'Freon Appliances', category: 'fees', unit: 'each', price: '25.00', direction: 'charge_customer', description: 'Refrigerators, freezers, dehumidifiers and AC units with refrigerant.' },
  { code: 'FEE-CRT', name: 'CRT Televisions', category: 'fees', unit: 'each', price: '20.00', direction: 'charge_customer', description: 'Tube televisions and monitors.' },
  { code: 'FEE-PROP', name: 'Propane Tanks', category: 'fees', unit: 'each', price: '5.00', direction: 'charge_customer', description: 'Empty propane cylinders, valve open.' },
]

/** Community recycling centre: the scrap list plus these, and the business is a nonprofit. */
export const COMMUNITY_CATEGORIES: CategoryTemplate[] = [
  { slug: 'paper', name: 'Paper and Cardboard', kind: 'paper', sortOrder: 80 },
  { slug: 'plastic', name: 'Plastics', kind: 'plastic', sortOrder: 82 },
  { slug: 'glass', name: 'Glass', kind: 'glass', sortOrder: 84 },
]
export const COMMUNITY_MATERIALS: MaterialTemplate[] = [
  { code: 'OCC', name: 'Cardboard (OCC)', category: 'paper', unit: 'lb', price: '0.02', description: 'Flattened corrugated boxes, dry.' },
  { code: 'MXP', name: 'Mixed Paper', category: 'paper', unit: 'lb', price: '0.00', description: 'Office paper, mail and magazines.' },
  { code: 'PET', name: 'PET Bottles (#1)', category: 'plastic', unit: 'lb', price: '0.05', description: 'Clear water and soda bottles, caps on.' },
  { code: 'HDPE', name: 'HDPE (#2)', category: 'plastic', unit: 'lb', price: '0.08', description: 'Milk jugs and detergent bottles.' },
  { code: 'GLS', name: 'Glass Containers', category: 'glass', unit: 'lb', price: '0.00', description: 'Clear, brown and green bottles and jars.' },
  { code: 'FEE-MAT', name: 'Mattresses', category: 'fees', unit: 'each', price: '15.00', direction: 'charge_customer', description: 'Mattresses and box springs, dry.' },
  { code: 'FE-MIX', name: 'Scrap Metal (Mixed)', category: 'ferrous', unit: 'lb', price: '0.03', description: 'Household metal, sorted at the centre.' },
]

export type RulesTemplate = {
  template: 'general' | 'ohio' | 'florida' | 'custom'; name: string; region: string
  profile: Record<string, unknown>
  restrictions: Array<{ material?: string; category?: string; label: string; kind: 'prohibited' | 'proof_of_ownership' | 'commercial_only' | 'payment_rule'; requiredDocuments?: string[]; forbidCash?: boolean; allowedMethods?: string[]; paymentHoldDays?: number; materialHoldDays?: number; mailCheckOnly?: boolean; publicNote?: string }>
}

const OWNERSHIP = 'I am the owner of the material I am selling, or I have the owner\'s permission to sell it, and it is not stolen.'
const CAT_RULE = { material: 'CAT', label: 'Catalytic converters', kind: 'proof_of_ownership' as const, requiredDocuments: ['vehicle_title'], forbidCash: true, allowedMethods: ['check', 'transfer'], paymentHoldDays: 3, publicNote: 'Bring the title of the vehicle it came from, or a repair shop invoice. Paid by check.' }
const AUTO_RULE = { material: 'FE-AUTO', label: 'Vehicles', kind: 'proof_of_ownership' as const, requiredDocuments: ['vehicle_title'], publicNote: 'Bring the title in your name.' }

/** Starting points by state. The owner checks them against local law (§4.6). */
export const RULES_TEMPLATES: Record<RulesTemplate['template'], RulesTemplate> = {
  general: {
    template: 'general', name: 'Standard rules', region: '',
    profile: { requireGovernmentId: true, requireIdPhoto: true, requireSellerPhoto: false, requireMaterialPhoto: false, requireVehiclePlate: true, requireSignature: true, requireThumbprint: false, minimumSellerAge: 18, cashRounding: 'none', defaultPaymentHoldDays: 0, defaultMaterialHoldDays: 0, allowEarlyRelease: false, retentionDays: 730, dailyReport: false, ownershipStatement: OWNERSHIP },
    restrictions: [CAT_RULE, AUTO_RULE],
  },
  ohio: {
    template: 'ohio', name: 'Ohio rules', region: 'OH',
    profile: { requireGovernmentId: true, requireIdPhoto: true, requireSellerPhoto: true, requireMaterialPhoto: true, requireVehiclePlate: true, requireSignature: true, requireThumbprint: false, minimumSellerAge: 18, cashRounding: 'none', defaultPaymentHoldDays: 0, defaultMaterialHoldDays: 0, allowEarlyRelease: false, retentionDays: 1095, dailyReport: true, reportDueTime: '17:00', ownershipStatement: OWNERSHIP },
    restrictions: [CAT_RULE, AUTO_RULE, { material: 'PB-BAT', label: 'Batteries', kind: 'payment_rule', publicNote: 'Whole batteries only.' }],
  },
  florida: {
    template: 'florida', name: 'Florida rules', region: 'FL',
    profile: { requireGovernmentId: true, requireIdPhoto: true, requireSellerPhoto: true, requireMaterialPhoto: true, requireVehiclePlate: true, requireSignature: true, requireThumbprint: true, minimumSellerAge: 18, cashRounding: 'none', defaultPaymentHoldDays: 0, defaultMaterialHoldDays: 0, allowEarlyRelease: false, retentionDays: 1095, dailyReport: true, reportDueTime: '17:00', ownershipStatement: OWNERSHIP },
    restrictions: [
      CAT_RULE, AUTO_RULE,
      { category: 'copper', label: 'Restricted regulated metals (copper)', kind: 'payment_rule', forbidCash: true, allowedMethods: ['check', 'transfer'], paymentHoldDays: 3, publicNote: 'Copper is paid by check or bank transfer, three days after the sale.' },
      { category: 'brass', label: 'Restricted regulated metals (brass)', kind: 'payment_rule', forbidCash: true, allowedMethods: ['check', 'transfer'], paymentHoldDays: 3, publicNote: 'Brass is paid by check or bank transfer, three days after the sale.' },
    ],
  },
  custom: {
    template: 'custom', name: 'Our rules', region: '',
    profile: { requireGovernmentId: true, requireIdPhoto: true, requireSellerPhoto: false, requireMaterialPhoto: false, requireVehiclePlate: true, requireSignature: true, requireThumbprint: false, minimumSellerAge: 18, cashRounding: 'none', defaultPaymentHoldDays: 0, defaultMaterialHoldDays: 0, allowEarlyRelease: false, retentionDays: 730, dailyReport: false, ownershipStatement: OWNERSHIP },
    restrictions: [CAT_RULE],
  },
}

export const CONTAINER_TYPES = [
  { slug: 'roll-off-20', name: '20 Yard Roll-off', kind: 'roll_off', capacityLabel: '20 yd', dimensions: '22 ft x 8 ft x 4 ft', suitableFor: 'Heavy scrap, demolition steel, cleanouts', deliveryFeeCents: 17500, haulFeeCents: 17500, rentalFeePerDayCents: 500, freeRentalDays: 14, dryRunFeeCents: 9500 },
  { slug: 'roll-off-30', name: '30 Yard Roll-off', kind: 'roll_off', capacityLabel: '30 yd', dimensions: '22 ft x 8 ft x 6 ft', suitableFor: 'Light iron, mixed metal from fabrication shops', deliveryFeeCents: 17500, haulFeeCents: 19500, rentalFeePerDayCents: 500, freeRentalDays: 14, dryRunFeeCents: 9500 },
  { slug: 'roll-off-40', name: '40 Yard Roll-off', kind: 'roll_off', capacityLabel: '40 yd', dimensions: '22 ft x 8 ft x 8 ft', suitableFor: 'Bulky light scrap and appliances', deliveryFeeCents: 17500, haulFeeCents: 21500, rentalFeePerDayCents: 600, freeRentalDays: 14, dryRunFeeCents: 9500 },
  { slug: 'lugger-box', name: 'Lugger Box', kind: 'lugger', capacityLabel: '10 yd', dimensions: '12 ft x 6 ft x 4 ft', suitableFor: 'Turnings, punchings and dense shop scrap', deliveryFeeCents: 12500, haulFeeCents: 12500, rentalFeePerDayCents: 300, freeRentalDays: 30, dryRunFeeCents: 7500 },
  { slug: 'gaylord', name: 'Gaylord Box', kind: 'gaylord', capacityLabel: '48 x 40 in', dimensions: '48 in x 40 in x 36 in', suitableFor: 'Non-ferrous sorting: copper, brass, wire, boards', deliveryFeeCents: 0, haulFeeCents: 4500, rentalFeePerDayCents: 0, freeRentalDays: 90, dryRunFeeCents: 0 },
] as const

/** 12 numbered containers: four 20s, four 30s, two 40s, two luggers. */
export const CONTAINER_FLEET: Array<{ type: string; prefix: string; count: number; tare: string }> = [
  { type: 'roll-off-20', prefix: 'R20', count: 4, tare: '5200' },
  { type: 'roll-off-30', prefix: 'R30', count: 4, tare: '6400' },
  { type: 'roll-off-40', prefix: 'R40', count: 2, tare: '7600' },
  { type: 'lugger-box', prefix: 'LG', count: 2, tare: '2100' },
]

type Flags = Record<string, boolean>
const f = (...names: string[]): Flags => Object.fromEntries(['canAccessDashboard', ...names].map((n) => [n, true]))

/** The 10 staff roles (§3). */
export const STAFF_ROLES: Array<{ name: string; flags: Flags | 'all' }> = [
  { name: 'Owner', flags: 'all' },
  { name: 'Yard manager', flags: f('canManageTickets', 'canGradeTickets', 'canOverridePrices', 'canVoidTickets', 'canPaySellers', 'canManageCashDrawers', 'canApproveVariances', 'canManagePricing', 'canManageMaterials', 'canManageSellers', 'canManageAccounts', 'canManageInventory', 'canManageSales', 'canManageDispatch', 'canManageCompliance', 'canViewReports', 'canSeeOtherPeople', 'canManagePeople') },
  { name: 'Scale operator', flags: f('canManageTickets', 'canManageSellers', 'canSeeOtherPeople') },
  { name: 'Grader', flags: f('canGradeTickets', 'canManageInventory') },
  { name: 'Cashier', flags: f('canPaySellers', 'canManageCashDrawers') },
  { name: 'Buyer / trader', flags: f('canManageAccounts', 'canManagePricing', 'canManageSales', 'canViewReports') },
  { name: 'Dispatcher', flags: f('canManageDispatch') },
  { name: 'Driver', flags: f('canDriveJobs') },
  { name: 'Compliance officer', flags: f('canManageCompliance', 'canManageSellers', 'canViewReports', 'canSeeOtherPeople') },
  { name: 'Accountant', flags: f('canManageFinance', 'canViewReports') },
]

export const WEEKDAY_HOURS = {
  mon: { open: '07:00', close: '16:30' }, tue: { open: '07:00', close: '16:30' }, wed: { open: '07:00', close: '16:30' }, thu: { open: '07:00', close: '16:30' },
  fri: { open: '07:00', close: '16:30' }, sat: { open: '08:00', close: '12:00' }, sun: { closed: true },
}

/** Tier lists are the board plus a premium, as percent of the board price. */
export const TIER_LISTS = [
  { name: 'Standard Commercial', premiumPercent: 3 },
  { name: 'Wholesale Tier A', premiumPercent: 6 },
]
