# @tvf/shared-auth

Shared authentication utilities, TypeScript types, and storage for TVF applications.

## Installation

This package is used internally within the TVF monorepo. Install dependencies:

```bash
npm install
```

## Usage

### Types

```typescript
import { RoleName, JWTPayload, User, Role } from "@tvf/shared-auth";
```

### Backend Utilities

```typescript
import { 
  hashPassword, 
  verifyPassword, 
  generateToken, 
  verifyToken,
  extractTokenFromHeader 
} from "@tvf/shared-auth";

// Hash password
const hashed = await hashPassword("password123");

// Verify password
const isValid = await verifyPassword("password123", hashed);

// Generate JWT token
const token = generateToken(
  { userId: "123", email: "user@example.com", role: "ADMIN", roleId: "role-123" },
  process.env.JWT_SECRET!,
  "7d"
);

// Verify JWT token
const payload = verifyToken(token, process.env.JWT_SECRET!);

// Extract token from header
const token = extractTokenFromHeader(req.headers.authorization);
```

### Frontend Storage

```typescript
import { tabStorage } from "@tvf/shared-auth";

// Store token
tabStorage.setItem("token", "jwt-token-here");

// Get token
const token = tabStorage.getItem("token");

// Remove token
tabStorage.removeItem("token");

// Clear all
tabStorage.clear();
```

## Development

Build the package:

```bash
npm run build
```

Watch for changes:

```bash
npm run watch
```








