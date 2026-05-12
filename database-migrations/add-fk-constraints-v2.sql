DO $body$ 
DECLARE
BEGIN
  BEGIN
    ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE NOT VALID;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.stock ADD CONSTRAINT stock_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE NOT VALID;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.stock ADD CONSTRAINT stock_primary_variant_id_fkey FOREIGN KEY (primary_variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE NOT VALID;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL NOT VALID;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL NOT VALID;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.orders ADD CONSTRAINT orders_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL NOT VALID;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.purchases ADD CONSTRAINT purchases_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL NOT VALID;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL NOT VALID;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.order_items ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL NOT VALID;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.purchase_items ADD CONSTRAINT purchase_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL NOT VALID;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$body$;

SELECT 
  conname,
  conrelid::regclass AS table_name
FROM pg_constraint 
WHERE contype = 'f' 
  AND conrelid::regclass::text IN ('invoices','product_variants','stock','orders','purchases','invoice_items','order_items','purchase_items')
ORDER BY conrelid::regclass::text, conname;
