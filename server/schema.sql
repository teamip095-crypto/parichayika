-- ==============================================================================
-- PARICHAYIKA 2026 - PRODUCTION POSTGRESQL SCHEMA (SUPABASE COMPATIBLE)
-- ==============================================================================

-- 1. Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Super Admins & RBAC
CREATE TABLE IF NOT EXISTS super_admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(150),
  email VARCHAR(255),
  mobile VARCHAR(50),
  role VARCHAR(50) DEFAULT 'SUPER_ADMIN',
  password_hash TEXT NOT NULL,
  recovery_email VARCHAR(255),
  recovery_whatsapp VARCHAR(50),
  reset_token TEXT,
  reset_token_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Districts
CREATE TABLE IF NOT EXISTS districts (
  id SERIAL PRIMARY KEY,
  name_en VARCHAR(150) NOT NULL,
  name_hi VARCHAR(150) NOT NULL,
  is_enabled SMALLINT DEFAULT 1
);

-- 4. Sangathans
CREATE TABLE IF NOT EXISTS sangathans (
  id SERIAL PRIMARY KEY,
  district_id INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  name_en VARCHAR(200) NOT NULL,
  name_hi VARCHAR(200) NOT NULL,
  is_enabled SMALLINT DEFAULT 1
);

-- 5. Magazines
CREATE TABLE IF NOT EXISTS magazines (
  id SERIAL PRIMARY KEY,
  name_en VARCHAR(150) NOT NULL,
  name_hi VARCHAR(150) NOT NULL,
  is_enabled SMALLINT DEFAULT 1
);

-- 6. Editions
CREATE TABLE IF NOT EXISTS editions (
  id SERIAL PRIMARY KEY,
  magazine_id INTEGER NOT NULL REFERENCES magazines(id) ON DELETE CASCADE,
  name_en VARCHAR(150) NOT NULL,
  name_hi VARCHAR(150) NOT NULL,
  is_enabled SMALLINT DEFAULT 1
);

-- 7. Advertisement Types
CREATE TABLE IF NOT EXISTS advertisement_types (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_hi VARCHAR(100) NOT NULL,
  is_enabled SMALLINT DEFAULT 1
);

-- 8. Advertisement Sizes
CREATE TABLE IF NOT EXISTS advertisement_sizes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name_en VARCHAR(150) NOT NULL,
  name_hi VARCHAR(150) NOT NULL,
  width NUMERIC(6, 2) NOT NULL,
  height NUMERIC(6, 2) NOT NULL,
  unit VARCHAR(20) DEFAULT 'inch',
  rows INTEGER DEFAULT 1,
  cols INTEGER DEFAULT 1,
  is_enabled SMALLINT DEFAULT 1
);

-- 9. Pricings Matrix
CREATE TABLE IF NOT EXISTS pricings (
  id SERIAL PRIMARY KEY,
  district_id INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  sangathan_id INTEGER NOT NULL REFERENCES sangathans(id) ON DELETE CASCADE,
  magazine_id INTEGER NOT NULL REFERENCES magazines(id) ON DELETE CASCADE,
  edition_id INTEGER NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  adv_type_code VARCHAR(50) NOT NULL,
  adv_size_code VARCHAR(50) NOT NULL,
  price NUMERIC(10, 2) NOT NULL
);

-- 10. Advertisements (Master Ad Table)
CREATE TABLE IF NOT EXISTS advertisements (
  id SERIAL PRIMARY KEY,
  ad_number VARCHAR(100) UNIQUE NOT NULL,
  type_code VARCHAR(50) NOT NULL,
  district_hi VARCHAR(150) NOT NULL,
  sangathan_hi VARCHAR(200) NOT NULL,
  magazine_hi VARCHAR(150) NOT NULL,
  edition_hi VARCHAR(150) NOT NULL,
  size_code VARCHAR(50) NOT NULL,
  size_hi VARCHAR(150) NOT NULL,
  customer_name VARCHAR(200) NOT NULL,
  customer_mobile1 VARCHAR(50) NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  payment_status VARCHAR(50) DEFAULT 'PENDING',
  production_status VARCHAR(50) DEFAULT 'Pending',
  uploaded_jpg_url TEXT,
  design_link TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. Matrimony Profiles (Biodata Ads)
CREATE TABLE IF NOT EXISTS matrimony_profiles (
  id SERIAL PRIMARY KEY,
  ad_id INTEGER UNIQUE NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  dob VARCHAR(50),
  height VARCHAR(50),
  blood_group VARCHAR(20),
  gotra VARCHAR(100),
  education TEXT,
  occupation TEXT,
  father_name VARCHAR(200),
  father_occupation TEXT,
  mother_name VARCHAR(200),
  mobile1 VARCHAR(50),
  mobile2 VARCHAR(50),
  whatsapp VARCHAR(50),
  current_address TEXT,
  permanent_address TEXT,
  photo_url TEXT,
  biodata_url TEXT,
  extra_fields_json TEXT
);

-- 12. Business Advertisements
CREATE TABLE IF NOT EXISTS business_advertisements (
  id SERIAL PRIMARY KEY,
  ad_id INTEGER UNIQUE NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
  business_name VARCHAR(255) DEFAULT '',
  owner_name VARCHAR(200) DEFAULT '',
  category VARCHAR(150),
  business_desc TEXT,
  products_services TEXT,
  special_offer TEXT,
  key_features TEXT,
  mobile1 VARCHAR(50),
  mobile2 VARCHAR(50),
  whatsapp VARCHAR(50),
  email VARCHAR(150),
  business_address TEXT,
  other_address TEXT,
  logo_url TEXT,
  photo_url TEXT,
  ready_ad_url TEXT,
  ad_maker_design_json TEXT,
  extra_fields_json TEXT
);

-- 13. File Uploads Registry
CREATE TABLE IF NOT EXISTS uploads (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  filepath TEXT NOT NULL,
  url TEXT NOT NULL,
  mimetype VARCHAR(100) NOT NULL,
  size BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 14. Cart Items (Client Sessions)
CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(100) NOT NULL,
  ad_type VARCHAR(50) NOT NULL,
  data_json TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 15. Orders
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(100) UNIQUE NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  payment_status VARCHAR(50) DEFAULT 'PENDING',
  payment_ref VARCHAR(100),
  payment_date VARCHAR(100),
  payment_screenshot TEXT,
  rejection_reason TEXT,
  verified_by VARCHAR(100),
  verification_time VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 16. Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(100) NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  ad_number VARCHAR(100) NOT NULL,
  ad_type VARCHAR(50) NOT NULL,
  district_hi VARCHAR(150) NOT NULL,
  sangathan_hi VARCHAR(200) NOT NULL,
  magazine_hi VARCHAR(150) NOT NULL,
  edition_hi VARCHAR(150) NOT NULL,
  size_hi VARCHAR(150) NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  customer_name VARCHAR(200) NOT NULL,
  customer_mobile VARCHAR(50) NOT NULL,
  production_status VARCHAR(50) DEFAULT 'Pending',
  uploaded_jpg_url TEXT,
  design_link TEXT,
  matrimony_details_json TEXT,
  business_details_json TEXT
);

-- 17. Publications
CREATE TABLE IF NOT EXISTS publications (
  id SERIAL PRIMARY KEY,
  district_id INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  sangathan_id INTEGER NOT NULL REFERENCES sangathans(id) ON DELETE CASCADE,
  magazine_id INTEGER NOT NULL REFERENCES magazines(id) ON DELETE CASCADE,
  edition_id INTEGER NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  is_enabled SMALLINT DEFAULT 1
);

-- 18. Print Production Jobs
CREATE TABLE IF NOT EXISTS print_jobs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  district_hi VARCHAR(150),
  sangathan_hi VARCHAR(200),
  magazine_hi VARCHAR(150),
  edition_hi VARCHAR(150),
  layout_config_json TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 19. Global System Settings
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL
);

-- 20. WhatsApp & SMS Notifications Log
CREATE TABLE IF NOT EXISTS whatsapp_notifications (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(100) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  customer_name VARCHAR(200) NOT NULL,
  status VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  error_reason TEXT
);

-- 21. Sequential Ad Counters
CREATE TABLE IF NOT EXISTS advertisement_counters (
  counter_date VARCHAR(50) PRIMARY KEY,
  last_seq INTEGER NOT NULL DEFAULT 0
);

-- 22. Admin Rate Configurations
CREATE TABLE IF NOT EXISTS admin_configurations (
  id SERIAL PRIMARY KEY,
  configuration_id VARCHAR(100) UNIQUE NOT NULL,
  district VARCHAR(150) NOT NULL,
  sangathan VARCHAR(200) NOT NULL,
  magazine VARCHAR(150) NOT NULL,
  edition VARCHAR(150) NOT NULL,
  adv_type VARCHAR(50) NOT NULL,
  size_name VARCHAR(150) NOT NULL,
  width NUMERIC(6, 2) NOT NULL,
  height NUMERIC(6, 2) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  layout VARCHAR(100) NOT NULL,
  pricing NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'enabled'
);

-- 23. Dynamic Field Builder
CREATE TABLE IF NOT EXISTS custom_fields (
  id SERIAL PRIMARY KEY,
  form_type VARCHAR(50) NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  field_type VARCHAR(50) NOT NULL,
  required SMALLINT DEFAULT 0,
  placeholder TEXT,
  help_text TEXT,
  default_value TEXT,
  visible SMALLINT DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  select_options TEXT,
  CONSTRAINT uq_form_field UNIQUE(form_type, field_name)
);

-- 24. Audit Logs (Records critical security and administrative actions)
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  actor_id VARCHAR(100),
  actor_email VARCHAR(255),
  details TEXT,
  ip_address VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_ad_number ON advertisements(ad_number);
CREATE INDEX IF NOT EXISTS idx_ad_customer_name ON advertisements(customer_name);
CREATE INDEX IF NOT EXISTS idx_ad_payment_status ON advertisements(payment_status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_order_id ON orders(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_cart_session ON cart_items(session_id);
