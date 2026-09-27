# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

Residents of Chateau Real Executive Village (CREVHAI — Chateau Real Executive Village Homeowners Association Inc.), Buenavista III, General Trias, Cavite.

- **Homeowners (primary):** pay monthly dues, reserve facilities, borrow amenities, vote in HOA elections, file reports, and manage the tenants on their lot.
- **Tenants (secondary):** added by their homeowner; get the community features but not payments, voting or tenant management.
- **HOA admins/officers** work in the separate web app (`chateau-project/`), not in this mobile app.

## Product Purpose

The residents' companion to the HOA's web admin system: one place to see what the HOA owes them information about (announcements, calendar, balance) and to do what they owe the HOA (dues, reservations, reports, votes) without visiting the office.

## Operating Context

- **Payments:** GCash via the HOA's QR code; the resident uploads a screenshot and the transaction reference number, then an admin verifies it ("Pending" until then). Advance payments of up to 12 months. Downloadable Statement of Account PDF that mirrors the web app's.
- **Reservations:** facilities by time slot (the covered court: ₱150 first hour, +₱50 per extra hour, paid by GCash) and quantity-based amenity items (chairs, tents) with condition photos at pick-up and return; admins approve and verify returns.
- **Registration:** homeowners self-register in four steps (account, personal, lot, move-in clearance documents) and stay pending until admin approval plus a mandatory orientation with the HOA Treasurer or President. One homeowner per lot.
- **Community:** announcements (with emergency pinning) and an HOA calendar, maintenance/incident reports with photo or video, HOA elections, a map of every lot and landmark with Mapbox directions, push notifications (Android only).
- Backend is Supabase, shared with the web app; row-level security scopes the data.

## Capabilities and Constraints

- Flutter; Android is the design target. iOS, web and macOS builds exist but are not designed for.
- There is no read/unread state for notifications anywhere yet; don't design unread badges until a backend field exists.
- Terms in use: Homeowner, Tenant, Lot (e.g. "Blk 52 Lot 4"), Move-In Clearance, Statement of Account, Proof of Payment, Reference Number.

## Brand Commitments

- Name: Chateau Real (HOA: CREVHAI). Logo at `assets/logo.png` — yellow (#F4DD03) wordmark on deep green.
- Brand green #006837 is shared with the web app.

## Evidence on Hand

- Real lot and street data for the subdivision (`lib/signup_page.dart`, `lib/map_page.dart`) and landmark coordinates.
- Photo of the village entrance: `assets/chateau.png`.
- No testimonials, usage numbers or resident research exist; don't fabricate them.

## Product Principles

1. Every money or approval step shows its state plainly (Unpaid, Pending verification, Approved) — residents must never wonder whether the HOA received something.
2. The admin is always in the loop: the app submits and informs, the web app decides. Don't imply instant approval.
3. Homeowner-first: tenants see a subset, never a broken version of the homeowner screens.
4. Native Android behavior over custom chrome.
