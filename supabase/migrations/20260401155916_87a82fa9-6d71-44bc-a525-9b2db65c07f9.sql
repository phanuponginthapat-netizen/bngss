-- Add 'alumni' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'alumni';