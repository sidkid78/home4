-- ==============================================================================
-- HOMEase Supabase Row-Level Security (RLS) Policies
-- ==============================================================================

-- Enable RLS on all relevant tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_audit ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- A. Property & Capture Privacy
-- ------------------------------------------------------------------------------
-- Policy: Owners can manage their own properties
CREATE POLICY "Users can manage own properties" ON properties
  FOR ALL USING (auth.uid() = (owner_id)::uuid);

-- Policy: Owners can view captures for their properties
CREATE POLICY "Users can view own captures" ON captures
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties 
      WHERE properties.id = captures.property_id 
      AND properties.owner_id = (auth.uid())::text
    )
  );

-- ------------------------------------------------------------------------------
-- B. Lead & Report Access (The "Paywall" Logic)
-- ------------------------------------------------------------------------------
-- Policy: Contractors can view available leads (Limited Info)
-- Status 'AVAILABLE' allows browsing without revealing PII
CREATE POLICY "Contractors can view available leads" ON leads
  FOR SELECT USING (status = 'AVAILABLE');

-- Policy: Contractors can only view full Report if they bought the lead
-- This ensures contractors only access PII and detailed risk assessments after Stripe payment
CREATE POLICY "Contractors can view purchased reports" ON reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leads 
      WHERE leads.report_id = reports.id 
      AND leads.contractor_id = (auth.uid())::text
    )
  );

-- ------------------------------------------------------------------------------
-- C. Data Integrity & Audit (Administrative "Human-in-the-loop" access)
-- ------------------------------------------------------------------------------
-- Policy: Admins have full access to assessments for QA and overrides
CREATE POLICY "Admins full access to assessments" ON assessments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = (auth.uid())::text 
      AND users.role = 'ADMIN'
    )
  );

-- Policy: Admins have full access to audit logs
CREATE POLICY "Admins full access to audit" ON access_audit
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = (auth.uid())::text 
      AND users.role = 'ADMIN'
    )
  );

-- System Policy: AccessAudit inserts are permitted for internal logging
CREATE POLICY "System can insert audit logs" ON access_audit
  FOR INSERT WITH CHECK (true);
