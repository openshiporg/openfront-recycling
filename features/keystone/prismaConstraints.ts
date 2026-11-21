/**
 * Compound uniques and indexes Keystone cannot express on a field (dissertation §5.13, §6),
 * appended to the generated Prisma schema (openfront-bank / openfront-convenience pattern).
 * Partial unique indexes, CHECK constraints and append-only triggers live in raw SQL in the
 * init migration's tail (migrations/*_init_recycling/migration.sql).
 */
export const COMPOUND_CONSTRAINTS: Record<string, string[]> = {
  Sequence: ['@@unique([scopeKey, kind], map: "Sequence_scope_kind_key")'],
  ScaleTicket: [
    '@@unique([yard, direction, number], map: "ScaleTicket_yard_direction_number_key")',
    '@@index([status, yard], map: "ScaleTicket_status_yard_idx")',
  ],
  AccountContact: ['@@unique([account, user], map: "AccountContact_account_user_key")'],
  PriceEntry: ['@@index([priceList, material, effectiveFrom], map: "PriceEntry_list_material_effective_idx")'],
  InventoryBalance: ['@@unique([yard, material], map: "InventoryBalance_yard_material_key")'],
  InventoryUnit: ['@@unique([yard, tagNumber], map: "InventoryUnit_yard_tag_key")'],
  ComplianceReport: ['@@unique([yard, reportDate], map: "ComplianceReport_yard_date_key")'],
  Payout: [
    '@@unique([bankAccountLabel, checkNumber], map: "Payout_bank_check_key")',
    '@@index([status, releaseAt], map: "Payout_status_release_idx")',
  ],
  Invoice: ['@@unique([number], map: "Invoice_number_key")'],
  Settlement: ['@@unique([number], map: "Settlement_number_key")'],
  SalesOrder: ['@@unique([number], map: "SalesOrder_number_key")'],
  Shipment: ['@@unique([number], map: "Shipment_number_key")'],
  ServiceRequest: ['@@unique([number], map: "ServiceRequest_number_key")'],
  DispatchJob: ['@@unique([number], map: "DispatchJob_number_key")'],
}

export function addDatabaseConstraints(schema: string): string {
  for (const [modelName, directives] of Object.entries(COMPOUND_CONSTRAINTS)) {
    const pattern = new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`)
    const model = schema.match(pattern)?.[0]
    if (!model) throw new Error(`Generated Prisma schema is missing ${modelName}`)
    // Prisma names relation scalar fields <field>Id; directives above use relation field names.
    const resolved = directives.map((directive) =>
      directive.replace(/\[([^\]]+)\]/, (_m, fields: string) =>
        `[${fields.split(',').map((f) => f.trim()).map((f) => {
          const bare = f.replace(/\(.*\)$/, '')
          return new RegExp(`\\n\\s*${bare}Id\\s`).test(model) ? f.replace(bare, `${bare}Id`) : f
        }).join(', ')}]`
      )
    )
    const missing = resolved.filter((directive) => !model.includes(directive))
    if (!missing.length) continue
    schema = schema.replace(model, model.replace(/\n\}$/, `\n${missing.map((directive) => `  ${directive}`).join('\n')}\n}`))
  }
  return schema
}
