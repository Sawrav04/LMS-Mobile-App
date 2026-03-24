# LMS Mobile - Logistics Management System

Native mobile app built with Expo (React Native) for the Blockchain-Powered Logistics Management System.

## Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli` or use `npx expo`)
- Expo Go app on your phone (for development testing)
- The backend server running (see `../app/`)

## Getting Started

### 1. Install dependencies

```bash
cd lms-mobile
npm install
```

### 2. Start the backend server

In a separate terminal:

```bash
cd ..
npm start
```

The API server runs on `http://localhost:3001`.

### 3. Configure API URL

Edit `lib/constants.ts` and set `API_BASE_URL` to your machine's LAN IP if testing on a physical device:

```ts
// For physical device, replace with your machine's IP
const DEV_API_HOST = "192.168.x.x";
```

### 4. Start the Expo dev server

```bash
npx expo start
```

Scan the QR code with Expo Go (Android) or Camera app (iOS).

## Project Structure

```
lms-mobile/
├── app/                     # Expo Router screens
│   ├── (auth)/              # Login & Signup
│   ├── (tabs)/              # Role-based tab screens
│   └── shipment/[id].tsx    # Shipment detail
├── components/              # Reusable UI components
├── hooks/                   # Data fetching hooks
├── lib/                     # API client, auth, constants
└── assets/                  # Icons & splash screen
```

## Features

- **Role-based dashboards**: Shipper, Carrier, Manager
- **Login/Signup** with secure credential storage
- **Shipment management**: Create, track, search, filter
- **QR code scanning** for carriers (native camera)
- **Carrier approval** workflow for managers
- **Analytics** with charts (pie + bar)
- **Blockchain explorer** showing chain health and blocks
- **Auto-refresh** every 5 seconds for real-time sync
- **Settings** with profile info and logout

## Roles

| Role     | Tabs                                                            |
| -------- | --------------------------------------------------------------- |
| Shipper  | Overview, My Shipments, Create Shipment, Analytics, Blockchain, Settings |
| Carrier  | Overview, Available Shipments, Scan QR, Analytics, Blockchain, Settings  |
| Manager  | Overview, Shipments, Carriers, Approvals, Analytics, Blockchain, Settings |

## Test Accounts

Use the same accounts as the web app:

- **Shipper**: `shipper@test.com` / `shipper123`
- **Carrier**: `carrier@test.com` / `carrier123`
- **Manager**: `manager@test.com` / `manager123`

(Create test users via the web app first at `http://localhost:3001`)

## Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure
eas build:configure

# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios
```

## Tech Stack

- Expo SDK 55 (React Native)
- Expo Router (file-based navigation)
- expo-camera (QR scanning)
- expo-secure-store (auth persistence)
- react-native-chart-kit (analytics charts)
- @expo/vector-icons (Ionicons)
