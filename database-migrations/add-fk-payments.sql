DO $body$
DECLARE
BEGIN
  -- payments → invoices (for invoices(payments(...)) joins)
  BEGIN
    ALTER TABLE public.payments ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL NOT VALID;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  -- payments → orders
  BEGIN
    ALTER TABLE public.payments ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL NOT VALID;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  -- payments → clients
  BEGIN
    ALTER TABLE public.payments ADD CONSTRAINT payments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL NOT VALID;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  -- purchases → warehouses (used in PurchasesPage)
  BEGIN
    ALTER TABLE public.purchases ADD CONSTRAINT purchases_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL NOT VALID;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  -- purchase_items → purchases
  BEGIN
    ALTER TABLE public.purchase_items ADD CONSTRAINT purchase_items_purchase_id_fkey2 FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE CASCADE NOT VALID;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  -- orders → warehouses
  BEGIN
    ALTER TABLE public.orders ADD CONSTRAINT orders_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL NOT VALID;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  -- invoices → warehouses
  BEGIN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL NOT VALID;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  -- invoices → cash_sessions
  BEGIN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_cash_session_id_fkey FOREIGN KEY (cash_session_id) REFERENCES public.cash_sessions(id) ON DELETE SET NULL NOT VALID;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$body$;

SELECT conname, conrelid::regclass AS tbl
FROM pg_constraint
WHERE contype = 'f'
  AND conrelid::regclass::text IN ('payments','purchases','orders','invoices','purchase_items')
ORDER BY tbl, conname;
