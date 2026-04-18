-- Add approval columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_requested_at TIMESTAMPTZ;

-- Allow admins to view all profiles
CREATE POLICY "Admins view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update any profile (for approval)
CREATE POLICY "Admins update any profile"
ON public.profiles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Update handle_new_user to auto-approve the first user (admin)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE 
  user_count INT; 
  assigned_role public.app_role;
  is_first BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  is_first := user_count = 0;
  
  INSERT INTO public.profiles (user_id, email, username, approved)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    is_first
  );
  
  IF is_first THEN 
    assigned_role := 'admin'; 
  ELSE 
    assigned_role := 'user'; 
  END IF;
  
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$function$;

-- Mark all existing users as approved (so they don't lose access)
UPDATE public.profiles SET approved = true WHERE approved = false;