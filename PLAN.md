# Connect Everything to Supabase

## Overview
Replace all local-only storage with Supabase as the real backend — authentication, users, restaurants, reviews, friends, and chats will all live in Supabase so data works across devices.

---

## Step 1: Create Tables in Supabase
You'll need to run SQL in the **Supabase Dashboard → SQL Editor** to create these tables. I'll provide the exact SQL after you approve this plan.

**Tables to create:**
- **profiles** — user profiles (synced from Supabase Auth)
- **restaurants** — all restaurant listings
- **reviews** — user reviews for restaurants
- **friend_requests** — pending/accepted/rejected friend requests
- **friends** — accepted friend connections
- **conversations** — chat conversations between users
- **messages** — individual chat messages

---

## Step 2: Set Up Supabase in the App
- Install the Supabase client library
- Create a Supabase client using your project URL and anon key
- You'll need to paste your **anon key** as an environment variable

---

## Step 3: Real Authentication
- Login and signup will use **Supabase Auth** (email + password)
- On signup, a profile is automatically created in the profiles table
- Session persists across app restarts
- Logout properly signs out of Supabase

---

## Step 4: Sync All Data to Supabase

**Users & Profiles**
- User profiles stored in Supabase instead of AsyncStorage
- All users discoverable across devices in the Find People tab

**Restaurants & Reviews**
- Restaurants and reviews stored in Supabase
- Any user can see all restaurants from any device
- Mock restaurants seeded on first load

**Friends**
- Friend requests and friendships stored in Supabase
- Send/accept/reject/cancel requests work across devices in real-time

**Chats**
- Conversations and messages stored in Supabase
- Messages persist and are visible from any device

---

## What Stays the Same
- All existing screens, design, and navigation remain unchanged
- The app looks and works exactly the same — just backed by real data
- Notification toasts still appear for friend requests and messages
