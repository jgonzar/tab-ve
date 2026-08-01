# Yummy Track App

## Overview
Yummy Track App is a mobile-first, offline-capable web application designed to track local rides in Venezuela. It enables a designated group of users to log rides, monitor pending payments, and view real-time USD to VES (Bolívares) conversions based on the official BCV rate.

## Core Features
* **Ride Tracking:** Log start destinations, multi-stop routes, wait times, and total costs in USD.
* **Currency Conversion:** Automated fetching of the BCV exchange rate to display totals in both USD and VES.
* **Payment Management:** Track pending rides, view total pending amounts, and mark rides as paid to move them to a history log.
* **User Access:** Simplified, passwordless user selection persisted via local storage.
* **Offline Functionality:** Optimistic UI updates with local data caching during network drops, syncing once reconnected.

## Technical Stack
* **Frontend:** SvelteKit (Optimized for mobile/Safari, dark-mode default)
* **Database:** Supabase (PostgreSQL) or Turso (SQLite)
* **Hosting:** Vercel

## Application Structure
* **Navigation:** Top bar with application title and active user indicator; side menu for core routing.
* **Home Dashboard:** Displays summary metrics (pending rides, pending amounts) and actionable pending ride cards.
* **History:** Log of all settled and paid rides.
