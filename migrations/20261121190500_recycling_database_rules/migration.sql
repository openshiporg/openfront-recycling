-- Database-enforced rules (dissertation §5.13 and §7.6) that Prisma's schema cannot express.

-- §7.6 Append-only lists: no UPDATE or DELETE, through any route.
CREATE OR REPLACE FUNCTION recycling_forbid_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Rows in % are append-only and cannot be changed or deleted.', TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PriceEntry_append_only" BEFORE UPDATE OR DELETE ON "PriceEntry" FOR EACH ROW EXECUTE FUNCTION recycling_forbid_change();
CREATE TRIGGER "WeighEvent_append_only" BEFORE UPDATE OR DELETE ON "WeighEvent" FOR EACH ROW EXECUTE FUNCTION recycling_forbid_change();
CREATE TRIGGER "InventoryMovement_append_only" BEFORE UPDATE OR DELETE ON "InventoryMovement" FOR EACH ROW EXECUTE FUNCTION recycling_forbid_change();
CREATE TRIGGER "CashDrawerEvent_append_only" BEFORE UPDATE OR DELETE ON "CashDrawerEvent" FOR EACH ROW EXECUTE FUNCTION recycling_forbid_change();
CREATE TRIGGER "AuditEvent_append_only" BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION recycling_forbid_change();
CREATE TRIGGER "CommandReceipt_append_only" BEFORE UPDATE OR DELETE ON "CommandReceipt" FOR EACH ROW EXECUTE FUNCTION recycling_forbid_change();
CREATE TRIGGER "PaymentWebhookEvent_append_only" BEFORE UPDATE OR DELETE ON "PaymentWebhookEvent" FOR EACH ROW EXECUTE FUNCTION recycling_forbid_change();

-- PriceEntry is append-only, but "closing" a row (setting effectiveTo once) is how a price is retired.
-- Allow exactly that one change and nothing else.
DROP TRIGGER "PriceEntry_append_only" ON "PriceEntry";
CREATE OR REPLACE FUNCTION recycling_price_entry_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Price entries are append-only.' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD."effectiveTo" IS NULL AND NEW."effectiveTo" IS NOT NULL
     AND (to_jsonb(NEW) - 'effectiveTo' - 'updatedAt') = (to_jsonb(OLD) - 'effectiveTo' - 'updatedAt') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Price entries are append-only.' USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "PriceEntry_append_only" BEFORE UPDATE OR DELETE ON "PriceEntry" FOR EACH ROW EXECUTE FUNCTION recycling_price_entry_guard();

-- §4.10 One open session per drawer and one per cashier.
CREATE UNIQUE INDEX "CashDrawerSession_one_open_per_drawer" ON "CashDrawerSession"("drawer") WHERE "status" IN ('open', 'counting');
CREATE UNIQUE INDEX "CashDrawerSession_one_open_per_cashier" ON "CashDrawerSession"("cashier") WHERE "status" IN ('open', 'counting');

-- §5.13 A container is never on two open jobs.
CREATE UNIQUE INDEX "DispatchJob_one_open_drop_per_container" ON "DispatchJob"("dropContainer") WHERE "status" IN ('planned', 'assigned', 'en_route', 'on_site') AND "dropContainer" IS NOT NULL;
CREATE UNIQUE INDEX "DispatchJob_one_open_pick_per_container" ON "DispatchJob"("pickContainer") WHERE "status" IN ('planned', 'assigned', 'en_route', 'on_site') AND "pickContainer" IS NOT NULL;

-- One job per service request; one active visit per ticket; one payout per drawer event.
CREATE UNIQUE INDEX "DispatchJob_one_per_request" ON "DispatchJob"("request") WHERE "request" IS NOT NULL AND "status" <> 'cancelled';
CREATE UNIQUE INDEX "Donation_one_per_ticket" ON "Donation"("ticket") WHERE "ticket" IS NOT NULL AND "status" <> 'cancelled';

-- Money and weight invariants.
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_amount_nonnegative" CHECK ("amountCents" >= 0);
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_refund_bounded" CHECK ("refundedCents" >= 0 AND "refundedCents" <= "capturedCents");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refund_bounded" CHECK ("refundedCents" >= 0 AND "refundedCents" <= "amountCents");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_refund_bounded" CHECK ("refundedCents" >= 0 AND "refundedCents" <= "paidCents");
ALTER TABLE "CashDrawerSession" ADD CONSTRAINT "CashDrawerSession_expected_nonnegative" CHECK ("expectedCents" >= 0);
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_weights_nonnegative" CHECK ("onHandWeight" >= 0 AND "reservedWeight" >= 0 AND "heldWeight" >= 0);
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_available_nonnegative" CHECK ("availableWeight" >= 0);
ALTER TABLE "ScaleTicket" ADD CONSTRAINT "ScaleTicket_donate_percent" CHECK ("donatePercent" BETWEEN 0 AND 100);
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_donate_percent" CHECK ("donatePercent" BETWEEN 0 AND 100);
