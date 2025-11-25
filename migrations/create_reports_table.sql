-- Create reports table for storing generated reports
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('weekly', 'monthly', 'forecast')),
  format TEXT NOT NULL CHECK (format IN ('pdf', 'slideshow')),
  forecast_days INTEGER,
  date_range TEXT NOT NULL,
  report_data JSONB NOT NULL,
  report_content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- Optional: reports can expire after a certain time
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_reports_project_id ON reports(project_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

-- Enable RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow public access to reports (for client sharing via shareable links)
-- Report IDs are UUIDs and hard to guess, providing reasonable security
CREATE POLICY "Public can view reports"
  ON reports FOR SELECT
  USING (true);

-- Users can view reports for projects they have access to (redundant but explicit)
CREATE POLICY "Users can view reports for accessible projects"
  ON reports FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    )
    OR project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Users can create reports for projects they have access to
CREATE POLICY "Users can create reports for accessible projects"
  ON reports FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects 
      WHERE owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    )
    OR project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Users can delete their own reports
CREATE POLICY "Users can delete their own reports"
  ON reports FOR DELETE
  USING (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

