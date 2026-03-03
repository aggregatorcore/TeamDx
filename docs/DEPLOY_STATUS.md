# TeamDX – Deploy & DB Status (MCP check)

## 1. Supabase DB – OK

- **Connected:** Yes (MCP verified)
- **Database:** `postgres`, user `postgres`
- **Data:** `users`: 1, `roles`: 1, `leads`: 0
- **Conclusion:** DB connected hai, backend Supabase use kar sakta hai.

---

## 2. Render – Current status

| Service        | URL                              | Status     | Deploy result   |
|----------------|----------------------------------|------------|------------------|
| **tvf-dx-api** | https://tvf-dx-api.onrender.com   | Suspended  | update_failed    |
| **tvf-dx-web** | https://tvf-dx-web.onrender.com  | Suspended  | build_failed     |
| **TeamDx**     | https://teamdx.onrender.com      | Running    | (single full-stack) |

### Kya missing / galat hai

1. **tvf-dx-api** aur **tvf-dx-web** dono **suspended** hain – pehle inhe **Resume** karna hoga.
2. **tvf-dx-api:** Last deploy **update_failed** – build ho sakta hai, start/health check fail (e.g. env vars, DATABASE_URL, PORT).
3. **tvf-dx-web:** Last deploy **build_failed** – `npm run build` (Next.js) fail (e.g. missing deps, TypeScript/tailwind error).

---

## 3. Ab kya karna hai (step-by-step)

### Step 1: Services Resume karo

1. [Render Dashboard](https://dashboard.render.com) → TeamDX workspace.
2. **tvf-dx-api** → **Resume** (ya Unsuspend).
3. **tvf-dx-web** → **Resume**.

### Step 2: Backend (tvf-dx-api) env vars check karo

Service **tvf-dx-api** → **Environment** – ye **zaroor** set hona chahiye:

- `NODE_ENV` = `production`
- `SUPABASE_URL` = `https://itmvgyerueofawyvwkrn.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = (Supabase → Project Settings → API → service_role)
- `DATABASE_URL` = (Supabase → Database → Session 5432 URI, password URL-encoded)
- `JWT_SECRET` = strong random string
- `JWT_EXPIRES_IN` = `7d`
- `FRONTEND_URL` = `https://tvf-dx-web.onrender.com`

Save → **Manual Deploy** chala do.

### Step 3: Frontend (tvf-dx-web) env vars check karo

Service **tvf-dx-web** → **Environment**:

- `NODE_ENV` = `production`
- `NEXT_PUBLIC_API_URL` = `https://tvf-dx-api.onrender.com`

Save → **Manual Deploy**.

### Step 4: Build errors fix (agar phir fail ho)

- **tvf-dx-web build_failed:** Dashboard → tvf-dx-web → **Logs** → build wale logs me error dekho (e.g. module not found, TypeScript/tailwind). Jo error aaye woh fix karo.
- **tvf-dx-api update_failed:** Dashboard → tvf-dx-api → **Logs** → runtime/start logs me error dekho (e.g. DATABASE_URL, missing env). Env vars theek karke redeploy.

---

## 4. Quick checklist

- [ ] Supabase DB – connected (done)
- [ ] tvf-dx-api – Resume kiya
- [ ] tvf-dx-api – env vars set (SUPABASE_*, DATABASE_URL, JWT_*, FRONTEND_URL)
- [ ] tvf-dx-api – Manual Deploy → success
- [ ] tvf-dx-web – Resume kiya
- [ ] tvf-dx-web – NEXT_PUBLIC_API_URL = backend URL
- [ ] tvf-dx-web – Manual Deploy → build + deploy success
- [ ] Browser me https://tvf-dx-web.onrender.com open karke login test

---

Render MCP se **unsuspend/resume** nahi ho sakta; wo tumhe Dashboard se karna hoga. Baaki env vars MCP se update kiye ja sakte hain (agar tool ho).
