# Render pe deploy karna (TVF DX)

Do services: **Backend API** (Express) aur **Frontend** (Next.js). DB = **Supabase** (pehle se setup).

---

## Step-by-step (Blueprint — sabse simple)

### 1. GitHub pe code push

- Repo: `aggregatorcore/TeamDx` (ya jo use karte ho) — code push karke latest ensure karo.

### 2. Render Dashboard

1. [dashboard.render.com](https://dashboard.render.com) → login.
2. **New +** → **Blueprint**.
3. GitHub repo connect karo (agar pehle se nahi) → repo select karo → **Connect**.
4. Branch: `main`, Blueprint file: `render.yaml` (auto detect).
5. **Apply** → Render **tvf-dx-api** aur **tvf-dx-web** dono services bana dega.

### 3. Backend (tvf-dx-api) — Environment Variables

Service **tvf-dx-api** → **Environment** → ye add/update karo:

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | koi strong random string (e.g. 32+ chars) |
| `JWT_EXPIRES_IN` | `7d` |
| `SUPABASE_URL` | `https://itmvgyerueofawyvwkrn.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **service_role** (secret) |
| `DATABASE_URL` | Supabase → Database → **Session** (port 5432) connection string. Password me `@`/`#` ho to URL-encode: `@`→`%40`, `#`→`%23` |
| `FRONTEND_URL` | Pehle `https://tvf-dx-web.onrender.com` daal do (frontend deploy ke baad confirm karo) |

Save → **Manual Deploy** (ya auto deploy wait karo).

### 4. Frontend (tvf-dx-web) — Environment Variables

Service **tvf-dx-web** → **Environment** → ye add karo:

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_API_URL` | Backend ka URL, e.g. `https://tvf-dx-api.onrender.com` |

Save → **Manual Deploy**.

### 5. URLs fix karo

- Backend URL note karo: `https://tvf-dx-api.onrender.com`.
- Frontend URL note karo: `https://tvf-dx-web.onrender.com`.
- **tvf-dx-api** me `FRONTEND_URL` = `https://tvf-dx-web.onrender.com` (exact) set karo → Save → Redeploy.
- **tvf-dx-web** me `NEXT_PUBLIC_API_URL` = `https://tvf-dx-api.onrender.com` set karo → Save → Redeploy.

### 6. Test

- Admin panel: `https://tvf-dx-web.onrender.com` (login: admin@example.com / apna password).
- Mobile app me production API: `NEXT_PUBLIC_API_URL` / backend URL use karo (app config me ya build-time).

---

## Option 1: Blueprint se (detail)

1. **GitHub pe code push karo** (repo public ya Render se connected).
2. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
3. Repo select karo, branch `main` (ya jo use karte ho).
4. Render `render.yaml` read karega — **tvf-dx-api** aur **tvf-dx-web** dono create ho jayenge.
5. **Environment variables** set karo (dono services ke liye):

   **tvf-dx-api (Backend):**
   - `SUPABASE_URL` = `https://itmvgyerueofawyvwkrn.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = (Supabase → Project Settings → API → service_role key)
   - `DATABASE_URL` = (Supabase → Database → Connection string, optional agar Prisma/seed use karna ho)
   - `JWT_SECRET` = koi strong random string
   - `FRONTEND_URL` = `https://tvf-dx-web.onrender.com` (frontend service ka URL, deploy ke baad milta hai)

   **tvf-dx-web (Frontend):**
   - `NEXT_PUBLIC_API_URL` = `https://tvf-dx-api.onrender.com` (backend service ka URL)

6. Pehle **tvf-dx-api** deploy hone do, phir **tvf-dx-web** me `NEXT_PUBLIC_API_URL` = backend URL set karo aur redeploy.
7. Frontend me `FRONTEND_URL` = frontend ka actual URL (e.g. `https://tvf-dx-web.onrender.com`) backend ke env me daal do taaki CORS sahi rahe.

---

## Option 2: Manual — do alag Web Services

### Service 1: Backend (API)

1. **New** → **Web Service**.
2. Repo connect karke same repo select karo.
3. Settings:
   - **Name:** `tvf-dx-api`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm run start:server`
   - **Instance type:** Free (ya paid)
4. **Environment** me add karo:
   - `NODE_ENV` = `production`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`
   - `JWT_EXPIRES_IN` = `7d`
   - `FRONTEND_URL` = (frontend ka URL, jaise `https://tvf-dx-web.onrender.com`)
   - `DATABASE_URL` (optional)
5. **Create Web Service** → deploy.

Deploy ke baad backend URL milega, jaise: `https://tvf-dx-api.onrender.com`

---

### Service 2: Frontend (Next.js)

1. **New** → **Web Service** (phir se same repo).
2. Settings:
   - **Name:** `tvf-dx-web`
   - **Runtime:** Node
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Instance type:** Free (ya paid)
3. **Environment** me add karo:
   - `NODE_ENV` = `production`
   - `NEXT_PUBLIC_API_URL` = `https://tvf-dx-api.onrender.com` (jo backend URL mila)
4. **Create Web Service** → deploy.

Frontend URL: `https://tvf-dx-web.onrender.com`

---

## CORS

Backend me `FRONTEND_URL` exactly wahi hona chahiye jahan frontend chal raha hai, e.g.:

- Local: `http://localhost:3000`
- Render: `https://tvf-dx-web.onrender.com`

Agar domain change karo to backend env me `FRONTEND_URL` update karke redeploy karo.

---

## Free tier note

Render free tier pe services thodi der inactivity ke baad sleep ho jati hain; pehla request slow ho sakta hai (cold start).
