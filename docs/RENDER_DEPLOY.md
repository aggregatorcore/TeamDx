# Render pe deploy karna (TVF DX)

Do services: **Backend API** (Express) aur **Frontend** (Next.js).

---

## Option 1: Blueprint se (ek baar me dono)

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
