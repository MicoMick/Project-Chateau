# Chateau Real HOA

The residents and officers of Chateau Real Executive Village (CREVHAI) share one system. Residents use it to pay dues, reserve facilities and take part in the association. Officers use it to verify and approve what residents submit.

## People

**Resident**:
Anyone with an approved account tied to a Lot: either a Homeowner or a Tenant.
_Avoid_: User, member

**Homeowner**:
The single Resident who owns a Lot. They pay Dues, vote in Elections and manage the Lot's Tenants.
_Avoid_: Owner (use only as the stored value), lot owner

**Tenant**:
A Resident added by a Homeowner to their Lot; the Tenant's Lot is always that Homeowner's Lot. A Tenant gets the community features but no Dues, voting or Tenant management.
_Avoid_: Renter, family member

**Admin**:
An HOA officer who works in the web app, verifying Payments, approving Reservations and Registrations, and publishing Announcements.
_Avoid_: Officer (except when naming a specific office such as Treasurer or President)

## Property

**Lot**:
One parcel in the village, named by block and lot (e.g. "Blk 52 Lot 4"). It has at most one Homeowner.
_Avoid_: House, unit, address

**Landmark**:
A named non-residential place on the village map (gate, clubhouse, court).

## Money

**Dues**:
The monthly amount a Homeowner owes the HOA for their Lot. It can be paid up to 12 months in advance.
_Avoid_: Fees, association fee, bill

**Payment**:
A Homeowner's claim to have paid, made of a Proof of Payment and a Reference Number. It stays Pending until an Admin verifies it.
_Avoid_: Transaction

**Proof of Payment**:
The GCash screenshot attached to a Payment.
_Avoid_: Receipt

**Reference Number**:
The GCash transaction reference the Resident enters with a Payment.

**Pending verification**:
A Payment the Homeowner has submitted and an Admin has not yet verified. It is not part of the Balance.
_Avoid_: Pending (on its own)

**Unconfirmed dues**:
Past Dues back-filled when an Admin approves a new Homeowner. They await the Treasurer's confirmation. They are owed.
_Avoid_: Pending, awaiting confirmation

**Balance**:
What a Homeowner owes: Unpaid, Overdue and Unconfirmed dues. Payments pending verification are shown next to it, not inside it.

**Statement of Account**:
The downloadable document listing a Homeowner's Dues, Payments and Balance. It mirrors the web app's version.
_Avoid_: SOA (in UI copy), invoice

## Bookings

**Reservation**:
A Resident's request to use a Facility for a time slot or to borrow Amenity items. It needs Admin approval.
_Avoid_: Booking

**Reservation status**:
One of Pending, Approved, Approved and paid, Rejected, Cancelled, Return pending or Completed. Pending and Approved Reservations of a Facility block its time slot.

**Facility**:
A place reserved by time slot, such as the covered court (₱150 for the first hour, then ₱50 for each extra hour).
_Avoid_: Venue, Amenity Facility (the stored category name)

**Amenity**:
A lendable item reserved by quantity (chairs, tents). Condition photos are taken at pick-up and at return, and an Admin verifies the return.
_Avoid_: Equipment, facility item

## Community

**Announcement**:
A notice from the HOA to all Residents. An emergency Announcement is pinned to the top.

**Report**:
A maintenance or incident issue a Resident files, with a photo or video.
_Avoid_: Complaint, ticket

**Election**:
An HOA vote with Candidates. Only Homeowners may vote.

## Onboarding

**Registration**:
A Homeowner's self-sign-up in four steps (account, personal, Lot, Move-In Clearance). It stays pending until an Admin approves it and the Homeowner completes Orientation.

**Move-In Clearance**:
The documents a new Homeowner submits during Registration.

**Orientation**:
The mandatory meeting with the HOA Treasurer or President before a Registration is approved.
