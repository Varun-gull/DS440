-- Restore accounts whose profile was previously missing. Existing profiles,
-- applications, XP, and wallet balances are never overwritten. Normal profile
-- defaults and the profile insert trigger provide the standard welcome credit.
insert into public.profiles (id, full_name, email)
select
  u.id,
  left(coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), split_part(u.email, '@', 1)), 120),
  u.email
from auth.users u
where u.email is not null
  and not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;
