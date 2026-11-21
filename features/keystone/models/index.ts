import { User, Role } from './people'
import { BusinessSettings, Yard, YardClosure, Scale, Sequence } from './business'
import { MaterialCategory, Material, PriceList, PriceEntry } from './catalog'
import { Seller, IdentityDocument, Vehicle, Account, AccountContact, AccountApplication, AccountDocument, ServiceSite } from './parties'
import { Visit, ScaleTicket, TicketLine, WeighEvent, TicketAttachment } from './tickets'
import {
  Payout, CashDrawer, CashDrawerSession, CashDrawerEvent, AccountCharge, Settlement, Invoice, InvoiceLine, Claim,
  PaymentProvider, PaymentSession, Payment, Refund, PaymentWebhookEvent,
} from './money'
import { InventoryBalance, InventoryMovement, InventoryUnit, ProcessingRun, YardTransfer, Listing, Offer, SalesOrder, SalesOrderLine, Shipment } from './inventory'
import { ContainerType, Container, ServiceRequest, Truck, DispatchJob, DonationCampaign, Donation } from './dispatch'
import { RulesProfile, MaterialRestriction, HoldTag, DoNotBuyEntry, TheftAlert, ComplianceReport, AuditEvent, CommandReceipt } from './compliance'
import { OAuthApp } from './OAuthApp'
import { OAuthToken } from './OAuthToken'

/** The 63 lists of dissertation §6, plus the starter's MCP OAuth lists. */
export const models = {
  // §6.1
  User, Role,
  // §6.2
  BusinessSettings, Yard, YardClosure, Scale, Sequence,
  // §6.3
  MaterialCategory, Material, PriceList, PriceEntry,
  // §6.4
  Seller, IdentityDocument, Vehicle, Account, AccountContact, AccountApplication, AccountDocument, ServiceSite,
  // §6.5
  Visit, ScaleTicket, TicketLine, WeighEvent, TicketAttachment,
  // §6.6
  Payout, CashDrawer, CashDrawerSession, CashDrawerEvent, AccountCharge, Settlement,
  // §6.7
  InventoryBalance, InventoryMovement, InventoryUnit, ProcessingRun, YardTransfer,
  // §6.8
  Listing, Offer, SalesOrder, SalesOrderLine, Shipment, Invoice, InvoiceLine, Claim,
  // §6.9
  PaymentProvider, PaymentSession, Payment, Refund, PaymentWebhookEvent,
  // §6.10
  ContainerType, Container, ServiceRequest, Truck, DispatchJob,
  // §6.11
  DonationCampaign, Donation,
  // §6.12
  RulesProfile, MaterialRestriction, HoldTag, DoNotBuyEntry, TheftAlert, ComplianceReport, AuditEvent, CommandReceipt,
  // MCP OAuth (starter)
  OAuthApp, OAuthToken,
}

export const DOMAIN_LIST_COUNT = Object.keys(models).length - 2

export default models
