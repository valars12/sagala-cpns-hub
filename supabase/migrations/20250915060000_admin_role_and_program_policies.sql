-- Add extra fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS nickname TEXT,
  ADD COLUMN IF NOT EXISTS province TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT;

-- Allow admins to manage programs
-- SELECT all programs for admins
CREATE POLICY IF NOT EXISTS "Admins can select all programs"
ON public.programs FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.user_id = auth.uid() AND p.role = 'admin'
));

-- INSERT programs for admins
CREATE POLICY IF NOT EXISTS "Admins can insert programs"
ON public.programs FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.user_id = auth.uid() AND p.role = 'admin'
));

-- UPDATE programs for admins
CREATE POLICY IF NOT EXISTS "Admins can update programs"
ON public.programs FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.user_id = auth.uid() AND p.role = 'admin'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.user_id = auth.uid() AND p.role = 'admin'
));

-- DELETE programs for admins
CREATE POLICY IF NOT EXISTS "Admins can delete programs"
ON public.programs FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.user_id = auth.uid() AND p.role = 'admin'
));

