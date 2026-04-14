# Admin Account Bootstrap (Supabase)

Use the same Register/Login pages for both students and admins.

- New signups are created as `student` by default (`user_profiles.role = 'student'`).
- Admin accounts are promoted manually in Supabase.

## Bootstrap Steps

1. Register the account in the app using the normal Register page.
2. Open Supabase SQL Editor and promote role:

```sql
update public.user_profiles
set role = 'admin'
where email = '<email>';
```

3. Verify promotion:

```sql
select id, email, role
from public.user_profiles
where email = '<email>';
```

## Behavior

- `admin` users log in through the normal login page and are redirected to `/admin/users`.
- `student` users continue normal flow:
  - no profiling yet -> `/profiling`
  - profiling complete -> app destination (dashboard/intended route)
