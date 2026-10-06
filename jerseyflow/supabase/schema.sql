-- 1. ENUM DEFINITIONS
DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'PENDING_PAYMENT',
    'DESIGN_QUEUE',
    'DESIGN_REVISION',
    'DESIGN_APPROVED',
    'PRINTING',
    'HEAT_PRESS',
    'CUTTING',
    'SEWING',
    'QC_PACKING',
    'READY_FOR_DELIVERY',
    'COMPLETED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE priority_level AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. TABEL PROFIL PENGGUNA (ROLE BASED INTERNAL WORKSHOP)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT CHECK (role IN ('OWNER', 'ADMIN', 'DESIGNER', 'OPERATOR_PRINT', 'SEWING_SUPERVISOR', 'QC')) DEFAULT 'ADMIN',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL VENDOR MAKLOON (PENJAHIT / SUBLIM LUAR)
CREATE TABLE IF NOT EXISTS makloon_partners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABEL UTAMA ORDERS
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL, -- Format: JR-YYMMDD-XXXX
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  total_qty INT NOT NULL DEFAULT 1,
  
  -- Bahan & Pola
  fabric_type TEXT NOT NULL DEFAULT 'Milano',
  collar_type TEXT NOT NULL DEFAULT 'O-Neck',
  
  -- Keuangan
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  down_payment NUMERIC(12,2) DEFAULT 0,
  is_paid_off BOOLEAN DEFAULT FALSE,
  
  -- Status & Waktu
  current_status order_status DEFAULT 'DESIGN_QUEUE',
  priority priority_level DEFAULT 'NORMAL',
  deadline_date DATE NOT NULL,
  
  -- Relasi Makloon
  is_makloon BOOLEAN DEFAULT FALSE,
  makloon_partner_id UUID REFERENCES makloon_partners(id) ON DELETE SET NULL,
  
  -- File Design
  mockup_url TEXT,
  print_file_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABEL RINCIAN ROSTER JERSEY (NAMA, NOMOR, UKURAN)
CREATE TABLE IF NOT EXISTS order_roster_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  player_name TEXT,
  back_number TEXT,
  size TEXT NOT NULL,
  sleeve_type TEXT DEFAULT 'SHORT' CHECK (sleeve_type IN ('SHORT', 'LONG')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABEL LOG PRODUKSI & PELACAKAN (STAGE-GATE AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS production_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  stage order_status NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  operator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT
);

-- 7. TRIGGER AUTO UPDATE updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_orders_updated_at ON orders;
CREATE TRIGGER set_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- 8. AKTIFKAN SUPABASE REALTIME REPLICATION
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE production_logs;
