# TutorsLink

A static HTML/CSS/JS website connecting students and tutors worldwide.

## Pages

| Page | File | Description |
|------|------|-------------|
| Home | `index.html` | Hero, Why Us, tutor carousel, feature tiles |
| Find a Tutor | `find-a-tutor.html` | Filterable tutor listing |
| Apply as Tutor | `tutor-application.html` | Multi-section application form |
| About | `about.html` | Mission, how it works, benefits |
| Contact | `contact.html` | Live chat UI + FAQ |
| Policies | `policies.html` | Refund, cancellation, community policies |
| Guides & Help | `guides.html` | Step-by-step guides for students and tutors |

## Project Structure

```
/
├── index.html
├── find-a-tutor.html
├── tutor-application.html
├── about.html
├── contact.html
├── policies.html
├── guides.html
├── assets/
│   ├── css/
│   │   └── tutorslink.css       # Main stylesheet (CSS variables, dark theme)
│   ├── js/
│   │   ├── firebase-config.js   # Firebase project config (REPLACE placeholders)
│   │   ├── firebase-app.js      # Firebase Auth, role-aware UI, Cloud Function wrappers
│   │   ├── carousel.js          # Tutor/feature carousels, tutor modal, demo booking
│   │   └── chat.js              # Support chat widget
│   └── data/
│       ├── tutors.json          # Tutor data
│       └── features.json        # Platform feature data
├── functions/
│   ├── index.js                 # Cloud Functions (submitTutorApplication, etc.)
│   └── package.json
└── docs/
    └── discord-integration.md   # Discord setup and secret rotation guide
```

## Local Development

No build step required. Serve with any static file server:

```bash
# Python
python3 -m http.server 8080

# Node
npx serve .

# VS Code: install "Live Server" extension
```

Open `http://localhost:8080` in your browser.

## Firebase Setup

1. **Create a Firebase project** at https://console.firebase.google.com
2. **Add a web app** and copy the config object
3. **Replace placeholders** in `assets/js/firebase-config.js`
4. **Enable Authentication providers**: Email/Password and Google
5. **Create Firestore database** (start in test mode for development)

### Cloud Functions

```bash
cd functions
npm install
firebase deploy --only functions
```

### Required Firestore Collections

| Collection | Purpose |
|------------|---------|
| `tutorApplications` | Submitted tutor application forms |
| `chatMessages` | Support chat transcripts |
| `demoBookings` | Demo class booking requests |
| `discordEvents` | Incoming Discord webhook events |

## Authentication & Roles

Roles are set as Firebase custom claims via the Admin SDK (in Cloud Functions or Admin console):

| Role | Custom claim | Access |
|------|-------------|--------|
| Guest | _(none)_ | Browse tutors, read-only |
| Student | `student: true` | Book sessions, chat |
| Tutor | `tutor: true` | Manage profile, accept bookings |
| Staff | `staff: true` | Full access |

## Discord Integration

See [`docs/discord-integration.md`](docs/discord-integration.md) for:
- Webhook notification setup
- Bot token rotation
- Discord login (planned custom token flow)

**Never commit Discord tokens, webhook URLs, or any secrets to this repo.**

## Secrets / Security

- `assets/js/firebase-config.js` contains only placeholder values by default.
  Replace them locally or via CI environment variables.
- Cloud Function secrets are loaded via `firebase functions:config:set`.
- See `docs/discord-integration.md` for how to rotate the Discord bot token.
