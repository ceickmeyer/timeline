// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Database schema - run this in your Supabase SQL editor:
/*
CREATE TABLE predictions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  prediction_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_session VARCHAR(255) UNIQUE -- to track if user already submitted
);

-- Add RLS policies
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read predictions
CREATE POLICY "Anyone can view predictions" ON predictions
  FOR SELECT USING (true);

-- Allow anyone to insert predictions
CREATE POLICY "Anyone can insert predictions" ON predictions
  FOR INSERT WITH CHECK (true);
*/