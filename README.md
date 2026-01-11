
# Tailwind Firebase ERP Admin (Simple)

## Features
- Free Tailwind-based admin layout
- Firebase Authentication (single auth project)
- Company selection
- Redirect to separate ERP systems (each can be its own Firebase project)

## Setup
```bash
npm install
npm run dev
```

### Firebase
- Create **1 Firebase project** for authentication
- Enable Email/Password auth
- Put config into `src/firebase.js`

### ERP
- Each company ERP can be its **own Firebase project**
- Update `erpUrl` in `App.jsx`

This is intentionally minimal & easy to extend.
