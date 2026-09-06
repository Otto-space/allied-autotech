-- Preserve work-order history by allowing only new lines while an order is open.
CREATE OR REPLACE FUNCTION aat_protect_closed_work_order_items()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status "WorkOrderStatus";
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'Work order items are append-only';
  END IF;

  SELECT "status" INTO parent_status
  FROM "WorkOrder"
  WHERE "id" = NEW."workOrderId";

  IF parent_status IN ('COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Closed work order items are immutable';
  END IF;
  RETURN NEW;
END;
$$;
