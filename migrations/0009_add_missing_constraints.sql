DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'purchase_orders_capex_request_id_fk'
  ) THEN
    ALTER TABLE purchase_orders
      ADD CONSTRAINT purchase_orders_capex_request_id_fk
      FOREIGN KEY (capex_request_id) REFERENCES capex_requests(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'assets_capex_request_id_fk'
  ) THEN
    ALTER TABLE assets
      ADD CONSTRAINT assets_capex_request_id_fk
      FOREIGN KEY (capex_request_id) REFERENCES capex_requests(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'assets_purchase_price_check'
  ) THEN
    ALTER TABLE assets ADD CONSTRAINT assets_purchase_price_check CHECK (purchase_price IS NULL OR purchase_price >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'assets_current_value_check'
  ) THEN
    ALTER TABLE assets ADD CONSTRAINT assets_current_value_check CHECK (current_value IS NULL OR current_value >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'assets_depreciation_rate_check'
  ) THEN
    ALTER TABLE assets ADD CONSTRAINT assets_depreciation_rate_check CHECK (depreciation_rate IS NULL OR depreciation_rate >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'assets_useful_life_years_check'
  ) THEN
    ALTER TABLE assets ADD CONSTRAINT assets_useful_life_years_check CHECK (useful_life_years IS NULL OR useful_life_years >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'purchase_orders_subtotal_check'
  ) THEN
    ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_subtotal_check CHECK (subtotal IS NULL OR subtotal >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'purchase_orders_total_check'
  ) THEN
    ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_total_check CHECK (total IS NULL OR total >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_purchase_orders_capex_request_id'
  ) THEN
    CREATE INDEX idx_purchase_orders_capex_request_id ON purchase_orders(capex_request_id) WHERE capex_request_id IS NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_assets_capex_request_id'
  ) THEN
    CREATE INDEX idx_assets_capex_request_id ON assets(capex_request_id) WHERE capex_request_id IS NOT NULL;
  END IF;
END $$;
