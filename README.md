# Miru Mushrooms — Operations Dashboard

A daily operations and finance tracker for Miru Mushrooms, covering all six
revenue departments (Tube Sales, Training, Spawn Sales, Fresh Mushrooms,
Cottonseed Hulls, Miru Kitchen), two sites (Mageragere & Nyakabanda), staff
meal tracking, and a daily cash float (opening/closing) system.

## Features

- **Dashboard** — opening/closing float for the selected day, today's
  revenue & expense totals, per-department breakdowns, and a meals-by-site
  callout.
- **Record Entry** — log revenue or expenses, tagged by department, site,
  and (for meals) site + session (Breakfast/Lunch/Dinner). "Other" expenses
  require a description.
- **Ledger** — full transaction history with filters by department, type,
  and site.
- **Staff & Ops** — team roster, all-time P&L per department, meals-by-site
  totals, and all-time expense category breakdown.
- **Float management** — set the opening float for any day (or let it carry
  forward automatically from the previous day's closing balance), and record
  ad-hoc "float top-ups" if cash runs short.

All data is stored in **MongoDB Atlas** (shared across devices and users), the
same way as the companion [Miru Bookings](../miru-booking) app. If the
database is unreachable, the app falls back to per-browser `localStorage` so
it keeps working offline.

## Getting Started (local development)

```bash
npm install
cp .env.local.example .env.local   # then paste your MongoDB connection string
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## MongoDB Atlas Setup

Miru Ops shares the same database setup as Miru Bookings:

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) and create a free account
   (or reuse the project/cluster from Miru Bookings).
2. Create a **Cluster** — the free **M0** tier is enough.
3. **Database Access** → **Add New Database User** with **Read and Write to
   Any Database** (use letters/numbers only in the password to avoid URL
   encoding issues).
4. **Network Access** → **Add IP Address** → your IP for local dev, or
   `0.0.0.0/0` ("Allow Access from Anywhere") for Vercel.
5. **Connect** → **Drivers** → **Node.js**, copy the connection string.

## Environment Variables

Copy `.env.local.example` to `.env.local` and set:

```env
MONGODB_URI=mongodb+srv://youruser:yourpassword@cluster0.xxxxx.mongodb.net/miru-ops?retryWrites=true&w=majority
```

- `.env.local` is git-ignored — never commit real credentials.
- The database name (`miru-ops` above) is created automatically on first
  write. Use a **different database name** from Miru Bookings
  (`miru-bookings`) so the two apps' collections don't mix — they can still
  live on the same cluster.
- Encode special characters in the password: `@` → `%40`, `!` → `%21`,
  `#` → `%23`.

If `MONGODB_URI` is missing or the database is unreachable, the app
automatically falls back to `localStorage` and shows a 🟡 **Offline** badge
in the header instead of 🟢 **Database**.

## Deploying to Vercel

1. Push this project to a GitHub (or GitLab/Bitbucket) repository.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Vercel auto-detects Next.js — no extra configuration is needed.
4. In **Environment Variables**, add `MONGODB_URI` with your connection string.
5. Click **Deploy**.

Every push to your main branch will trigger a new deployment automatically.

### Deploying via CLI

```bash
npm install -g vercel
vercel
```

## API Reference

| Method   | Endpoint                 | Description                                |
| -------- | ------------------------ | ------------------------------------------ |
| `GET`    | `/api/transactions`       | All transactions (revenue/expense/top-ups) |
| `POST`   | `/api/transactions`       | Create a transaction                       |
| `DELETE` | `/api/transactions/:id`   | Delete a transaction by id                  |
| `GET`    | `/api/floats`             | Opening-float overrides, as `{date: amount}` |
| `PUT`    | `/api/floats`             | Set the opening float for a date            |

Transaction fields mirror `lib/types.ts` (`Transaction`): `id`, `kind`
(`revenue` / `expense` / `float_topup`), `date`, `amount`, `note`, plus
optional `dept`, `site`, `category`, `mealSite`, `mealSession`. The client
generates `id` (used as the Mongo `_id`) so local state and the database stay
in sync without remapping.

## Data & Privacy Notes

- Transactions and opening-float overrides are stored in **MongoDB Atlas**,
  shared across devices and browsers for everyone using the deployed app.
- `activeDate` (which day you're currently viewing) is a per-browser UI
  preference only, and is **not** synced to the database.
- A full copy of the state is also cached in `localStorage` (key
  `miru_ops_v5`) as an **offline fallback** — if the database is unreachable,
  reads and writes transparently use this cache instead, and the header shows
  a 🟡 **Offline** badge. Once the database is reachable again, refresh the
  page to resume syncing (entries made while offline are not retroactively
  uploaded).

## Project Structure

```
app/
  layout.tsx       # Root layout
  page.tsx         # Renders the App
  globals.css      # Global styles
  api/
    transactions/route.ts        # GET (list), POST (create)
    transactions/[id]/route.ts   # DELETE by id
    floats/route.ts              # GET (map), PUT (upsert by date)
components/
  App.tsx          # Shell: header, tabs, state wiring, DB hydration & sync
  Dashboard.tsx    # Dashboard tab
  EntryFormPanel.tsx  # Record Entry tab
  Ledger.tsx       # Ledger tab
  StaffOps.tsx     # Staff & Ops tab
  FloatPanel.tsx   # Opening/closing float + top-up controls
  SiteToggle.tsx   # Mageragere / Nyakabanda toggle
  ui.tsx           # Shared Card, Badge, MiniBar, form styles
lib/
  constants.ts     # Departments, sites, categories, employees
  types.ts         # TypeScript types
  store.ts         # Reducer, float math, formatters, id helper
  mongodb.ts       # MongoDB connection singleton
  models/
    Transaction.ts # Mongoose schema for transactions
    Float.ts       # Mongoose schema for opening-float overrides
  api.ts           # Client API calls + localStorage fallback
```
