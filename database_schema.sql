-- Create the messages table
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id TEXT,
  sender_name TEXT,
  sender_number TEXT,
  message_text TEXT,
  message_type TEXT,
  from_me BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public reads (for the dashboard)
-- In a production environment, you should restrict this to authenticated users only.
CREATE POLICY "Allow public read access to messages"
  ON messages
  FOR SELECT
  USING (true);

-- Create policy to allow service role to insert messages (handled by Next.js webhook)
CREATE POLICY "Allow service role to insert messages"
  ON messages
  FOR INSERT
  WITH CHECK (true);

-- Enable Realtime for the messages table
-- Note: You also need to make sure publication 'supabase_realtime' is enabled for this table.
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Create the instances table
CREATE TABLE instances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_name TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'created',
  qrcode TEXT,
  instance_api_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) for instances
ALTER TABLE instances ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for dashboard display)
CREATE POLICY "Allow public read access to instances"
  ON instances
  FOR SELECT
  USING (true);

-- Allow service role to modify instances
CREATE POLICY "Allow service role to insert instances"
  ON instances
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow service role to update instances"
  ON instances
  FOR UPDATE
  USING (true);

-- Add instances to the Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE instances;
