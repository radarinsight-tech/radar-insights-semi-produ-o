

# Authentication for Radar Insight

## Overview

Add email/password authentication so only logged-in users can access the dashboard. Prepare a `company_id` structure for multi-user/company support. The existing evaluations flow remains untouched.

## Database Changes

1. **Create `companies` table** -- stores company info (id, name, created_at)
2. **Create `profiles` table** -- links `auth.users` to a company (id referencing auth.users, company_id, full_name, created_at). Auto-create profile on signup via a trigger.
3. **Add `user_id` and `company_id` columns to `evaluations`** -- nullable for backward compatibility with existing rows. New inserts will populate these from the logged-in user.
4. **Update RLS on `evaluations`** -- authenticated users can read/insert evaluations belonging to their company (or legacy rows with null company_id).
5. **Add RLS on `profiles` and `companies`** -- users can read their own profile and their company.

## Frontend Changes

1. **`src/pages/Auth.tsx`** -- Login and signup form (email + password). Clean, professional design matching the app. Includes a tab to toggle between login and register.
2. **`src/components/ProtectedRoute.tsx`** -- Wrapper that checks auth state via `onAuthStateChange` + `getSession`. Redirects to `/auth` if not logged in.
3. **`src/App.tsx`** -- Add `/auth` route. Wrap `Index` route with `ProtectedRoute`.
4. **`src/pages/Index.tsx`** -- Add logout button in the header. Pass `user.id` and profile's `company_id` when inserting evaluations. Filter history by `company_id`.

## Technical Details

- Auth state managed via `supabase.auth.onAuthStateChange` set up before `getSession` (per best practices).
- Signup does NOT auto-confirm email -- users must verify before signing in.
- Profile auto-created via a database trigger (`handle_new_user`).
- Company is created on first signup; future users can be invited to the same company.
- Existing evaluation rows (with null user_id/company_id) remain accessible during a transition period.

