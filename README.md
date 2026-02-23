# MY DX - Operations & Task Management System

Next.js web application for operations and task management with Flutter Android mobile dialer integration.

## Project Structure

```
├── app/                          # Next.js app directory
│   ├── (dashboard)/             # Dashboard routes
│   ├── (auth)/                  # Authentication routes
│   └── api/                     # API routes
├── components/                  # React components
├── lib/                         # Utilities and services
│   ├── api.ts                  # API client
│   └── services/               # Business logic services
├── server/                      # Express backend
│   ├── src/
│   │   ├── routes/             # API routes
│   │   ├── middleware/         # Auth middleware
│   │   └── index.ts            # Server entry point
├── prisma/                      # Database schema
│   └── schema.prisma           # Prisma schema
├── mobile_app/                  # Flutter Android app
│   └── lib/                    # Flutter app code
└── public/                      # Static assets
```

## Tech Stack

### Web Application
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **PostgreSQL** - Primary database
- **Prisma** - ORM for database access
- **JWT** - Authentication (not Firebase Auth)
- **Express.js** - Backend API server

### Mobile Application
- **Flutter** - Android mobile app
- **Telephony** - Call state detection
- **HTTP** - API communication

### Real-time Communication
- **Socket.IO** - WebSocket for device registration and call state synchronization

## Quick Start

See [QUICK_START.md](./QUICK_START.md) for detailed setup instructions.

### Prerequisites

1. **Node.js** (v18 or v20 LTS)
2. **PostgreSQL** (for database)

### Setup Steps

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Setup Environment Variables:**
   Create `.env` file:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/immigration_db"
   JWT_SECRET="your-secret-key"
   JWT_EXPIRES_IN="7d"
   PORT=5000
   NEXT_PUBLIC_API_URL="http://localhost:5000"
   ```

3. **Setup Database:**
   ```bash
   npm run db:generate
   npm run db:push
   npm run db:seed
   ```

4. **Start Servers:**
   
   **Terminal 1 - Backend:**
   ```bash
   npm run server
   ```
   
   **Terminal 2 - Frontend:**
   ```bash
   npm run dev
   ```

5. **Access Application:**
   - Web App: http://localhost:3000
   - Backend API: http://localhost:5000

## User Roles

- Admin
- Branch Manager
- Team Leader
- Telecaller
- Counselor
- Receptionist
- Filling Officer
- IT Team

## Features

### Core Features
- ✅ JWT Authentication (Email/Password)
- ✅ Role-based Access Control
- ✅ Dashboard with real-time updates
- ✅ Leads Management
- ✅ Clients Management
- ✅ Applications Management
- ✅ Call Logs Tracking
- ✅ Mobile Dialer Integration

### Mobile Integration
- ✅ Android dialer app
- ✅ Real-time call state sync (via Firebase Firestore)
- ✅ WebSocket device registration
- ✅ Call logs synchronization

## Firebase Setup (Call Sync Only)

Firebase Firestore is used ONLY for real-time call synchronization between web and mobile apps.

### Required Collections

1. **devices** - Device bindings (user → device mapping)
2. **callSignals** - Outbound call requests from web to mobile
3. **calls** - Real-time call state updates

### Setup Steps

1. Create Firebase project at https://console.firebase.google.com/
2. Enable Firestore Database
3. Create required indexes (see [FIREBASE_INDEX_FIX.md](./FIREBASE_INDEX_FIX.md))
4. Add Firebase config to `lib/firebase/config.ts`

**Note:** Authentication uses JWT, NOT Firebase Auth.

## Development

### Backend Development
```bash
npm run server        # Start backend server
npm run server:debug  # Start with debugger
```

### Frontend Development
```bash
npm run dev          # Start Next.js dev server
npm run build        # Build for production
npm run start        # Start production server
```

### Database Management
```bash
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema changes
npm run db:migrate   # Run migrations
npm run db:seed      # Seed database
```

## Mobile App

See `mobile_app/` directory for Flutter Android app setup.

## Documentation

- [QUICK_START.md](./QUICK_START.md) - Quick setup guide
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Detailed setup instructions
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [FIREBASE_INDEX_FIX.md](./FIREBASE_INDEX_FIX.md) - Firebase index setup

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running
- Check `DATABASE_URL` in `.env`
- Run `npm run db:push` to sync schema

### Authentication Issues
- Verify JWT_SECRET is set in `.env`
- Check backend server is running on port 5000
- Verify user exists in database

### Firebase Issues
- Verify Firebase project is active
- Check Firestore indexes are created
- See [FIREBASE_INDEX_FIX.md](./FIREBASE_INDEX_FIX.md) for index setup

## License

Private - Internal Use Only
