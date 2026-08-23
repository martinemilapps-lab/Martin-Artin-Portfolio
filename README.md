# Martin Emil Arteen Portfolio — Exhibition & Control Architecture

An immersive, high-end interactive fashion and creative campaign portfolio built with React 19, Vite, and a secure serverless backend.

## Security Architecture

- **Server-Side Authorization Boundary**: All database writes, administrative mutations, and session lifecycle operations are strictly authorized server-side (`api/`).
- **Zero Client-Side DB Credentials**: The browser never connects directly to Turso and holds no database tokens or connection strings.
- **HttpOnly Cookie Sessions**: Authentication utilizes signed, encrypted session identifiers stored in `HttpOnly`, `SameSite=Lax`, `Secure` cookies.
- **Multi-Layer Validation**: Strict server-side schema validation, HTTPS URL enforcement, SVG executable script stripping, and 10MB payload size limits.
- **Audit Logging**: Comprehensive security audit trail recording authentication attempts, campaign changes, and administrative actions.
- **Strict Security Headers & CSP**: Content Security Policy, HSTS, X-Content-Type-Options, and frame restrictions configured via `vercel.json`.

## Tech Stack

- **Frontend**: React 19, Vanilla CSS (Swiss Light Mode Design System), Canvas Particles, Lucide Icons.
- **Backend / API**: Vercel Serverless Functions (`api/`), Node.js Web Crypto & PBKDF2.
- **Database**: Turso Edge LibSQL with server-side parameterized queries and atomic batch transactions.

## Setup & Environment Variables

Copy `.env.example` to `.env` and configure the server-only variables:

```bash
# Server-side database configuration
TURSO_DATABASE_URL=https://your-database-name.turso.io
TURSO_AUTH_TOKEN=your_turso_auth_token

# Administrator bootstrap credentials
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_secure_admin_password

# Session signing secret
SESSION_SECRET=your_high_entropy_session_secret
```

## Development & Build

```bash
# Install dependencies
npm install

# Start local dev server (includes local serverless API middleware)
npm run dev

# Run automated tests
npm test

# Run linter
npm run lint

# Build production bundle
npm run build
```
