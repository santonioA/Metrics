# Zeeker metrics

Read-only dashboard that shows how the support team uses Zeeker, built on the
metrics Zeeker stores in Supabase (`public.movements`, `public.cat_met`,
`public.cat_people`).

## Layout

| Path | What |
|---|---|
| `supabase/migrations/` | Dashboard access layer: private `dashboard` schema, views, login/data functions |
| `dashboard/` | Static React app (Vite) deployed to GitHub Pages |
| `.github/workflows/deploy-dashboard.yml` | Builds and deploys `dashboard/` on every push to `main` |

## How access works

- Zeeker keeps writing through `public.zeeker_send`. The dashboard changes nothing about that.
- The dashboard runs entirely in the browser with the **publishable** key, which
  can only call `public.dashboard_login` and `public.dashboard_data`. Both check a
  username and bcrypt-hashed password in `dashboard.dashboard_users` before returning anything.
- The `dashboard` schema isn't exposed by the Supabase API; tables stay locked by RLS.

### Add or change a dashboard user

Run in the Supabase SQL editor (don't save the query, it contains the password):

```sql
-- add
insert into dashboard.dashboard_users (username, display_name, password_hash)
values ('manager', 'Manager Name', extensions.crypt('a-strong-password', extensions.gen_salt('bf', 10)));

-- change password
update dashboard.dashboard_users
set password_hash = extensions.crypt('new-password', extensions.gen_salt('bf', 10))
where username = 'manager';

-- remove
delete from dashboard.dashboard_users where username = 'manager';
```

Usernames are lowercase, 3–40 characters (`a-z 0-9 . _ -`).

## Run locally

```sh
cd dashboard
npm install
npm run dev      # http://localhost:5173
```

## Deploy (GitHub Pages)

1. In the GitHub repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `main` (or run the workflow manually from the Actions tab).
3. The site is published at `https://<user>.github.io/<repo>/`.

On a free GitHub plan Pages requires a public repo. That's fine: the code holds
no secrets, and the data is only returned after a valid login.

## Metric definitions

Explained in the dashboard itself ("How these numbers are calculated"). Minutes
saved per artifact default to Drafts 10, Research 15, Handoffs 10, GHOs 15 and
live in `dashboard/src/config.ts`; viewers can adjust them in the page (saved in
their browser only).
