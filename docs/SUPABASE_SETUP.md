# Database Supabase pe shift karna

## 1. Supabase project banao

1. [Supabase](https://supabase.com) pe sign in karo.
2. New project banao (organization select karo, name + password set karo).
3. Project ready hone tak wait karo.

## 2. Connection string lo

1. Project → **Settings** → **Database**.
2. **Connection string** me **URI** choose karo.
3. **Session mode** ya **Transaction** (port **6543**) use karo — Prisma ke saath better.
4. Password placeholders `[YOUR-PASSWORD]` ko apne database password se replace karo.

Example (Session mode):

```
postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

Direct (migrations ke liye, port 5432):

```
postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

## 3. `.env` update karo

`.env` me `DATABASE_URL` ko Supabase connection string se replace karo:

```env
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
```

**Note:** URL me `supabase` word hona chahiye — isse app automatically SSL use karega.

## 4. Migrations chalao

```bash
npm run db:generate:postgres
npx prisma migrate deploy
# ya pehli baar: npx prisma migrate dev
```

## 5. Seed (optional)

```bash
npm run db:seed
npm run db:seed:wrong-number
npm run db:seed:system-tags
```

## 6. Server / app chalao

```bash
npm run server
npm run dev
```

---

**SSL:** Code me already Supabase ke liye SSL enable hai jab `DATABASE_URL` me `supabase` aata hai (`server/src/lib/prisma.ts` aur seed scripts).

**Pooler vs direct:** App ke liye **pooler** URL (port 6543) use karo. Migrations ke liye direct URL (5432) bhi chal sakta hai.
