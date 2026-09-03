-- Challenges revamp migration
-- Run this in the Supabase SQL Editor to clear old challenges and seed the new ones.
-- Challenge definitions are now code-driven; this just seeds the DB rows needed for FK constraints.

-- Clear all existing data
DELETE FROM public.completed_challenges;
DELETE FROM public.challenges;

-- Tiered: Applications Submitted
INSERT INTO public.challenges (id, title, description, xp_reward, target, active) VALUES
  ('00000000-0000-0000-0001-000000000001', 'Applications Submitted', 'Submit your very first application.', 20, 1, true),
  ('00000000-0000-0000-0001-000000000002', 'Applications Submitted', 'Submit 25 applications.', 80, 25, true),
  ('00000000-0000-0000-0001-000000000003', 'Applications Submitted', 'Submit 100 applications.', 200, 100, true),
  ('00000000-0000-0000-0001-000000000004', 'Applications Submitted', 'Submit 250 applications.', 350, 250, true),
  ('00000000-0000-0000-0001-000000000005', 'Applications Submitted', 'Submit 1000 applications.', 500, 1000, true);

-- One-off challenges
INSERT INTO public.challenges (id, title, description, xp_reward, target, active) VALUES
  ('00000000-0000-0000-0002-000000000001', 'Profile Complete', 'Fill out all your profile fields.', 30, 6, true),
  ('00000000-0000-0000-0002-000000000002', 'Resume Uploaded', 'Upload your resume to CareerUp.', 40, 1, true),
  ('00000000-0000-0000-0002-000000000003', 'Calendar Keeper', 'Schedule your first interview.', 25, 1, true),
  ('00000000-0000-0000-0002-000000000004', 'Networker', 'Send your first peer message.', 15, 1, true),
  ('00000000-0000-0000-0002-000000000005', 'Group Joiner', 'Join a career group.', 20, 1, true);
