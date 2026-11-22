-- A weigh event stays on its ticket forever. When an open ticket's line is removed, the only change
-- allowed is clearing the event's link to that line (the FK's ON DELETE SET NULL).
DROP TRIGGER "WeighEvent_append_only" ON "WeighEvent";
CREATE OR REPLACE FUNCTION recycling_weigh_event_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."line" IS NOT NULL AND NEW."line" IS NULL
     AND (to_jsonb(NEW) - 'line' - 'updatedAt') = (to_jsonb(OLD) - 'line' - 'updatedAt') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Weigh events are append-only.' USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "WeighEvent_append_only" BEFORE UPDATE OR DELETE ON "WeighEvent" FOR EACH ROW EXECUTE FUNCTION recycling_weigh_event_guard();

-- Same for inventory movements: a movement keeps its ticket; only a removed line's link may clear.
DROP TRIGGER "InventoryMovement_append_only" ON "InventoryMovement";
CREATE OR REPLACE FUNCTION recycling_movement_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - 'ticketLine' - 'updatedAt') = (to_jsonb(OLD) - 'ticketLine' - 'updatedAt')
     AND OLD."ticketLine" IS NOT NULL AND NEW."ticketLine" IS NULL THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Inventory movements are append-only.' USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "InventoryMovement_append_only" BEFORE UPDATE OR DELETE ON "InventoryMovement" FOR EACH ROW EXECUTE FUNCTION recycling_movement_guard();
