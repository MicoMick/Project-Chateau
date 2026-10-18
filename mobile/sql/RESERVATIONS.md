# Approval-first reservations (3.0.5)

Apply `reservation_approval_first.sql` in Supabase SQL Editor before releasing
mobile 3.0.5 and the accompanying admin app changes. It prevents overlapping approved facility slots (including concurrent approvals),
and prevents residents from approving requests or marking payments paid.

The migration runs in a transaction. If existing approved facility slots overlap,
it fails without changing them. An Admin must review and resolve those conflicts,
then rerun it. Pending overlapping requests are allowed and remain for the Admin
to approve or reject individually. Approving a request holds its slot before payment.

Release both apps together: older mobile builds collect payment before approval
and their new requests will be refused by the new database guard. Existing payment
proofs remain available for Admin review after the request is approved. Items that
are borrowed without a fee retain their existing stock and return workflow.

Check with two resident accounts and one Admin:

1. Request the same facility/date for 07:00–08:00 and 07:00–11:00. Both stay Pending
   without collecting payment. The Admin can view both overlapping requests.
2. Approve either one. Trying to approve the other must fail, even if the first
   resident has not paid. Reject the other request explicitly.
3. On the approved request, submit GCash proof and reference. It stays Approved
   and payment Pending until the Admin accepts proof, then becomes Approved and Paid.
4. Reject proof; the resident can resubmit without losing reservation approval.
5. Try adjacent slots (07:00–08:00 and 08:00–09:00); both may be approved.
6. Try a direct resident update to Approved or Paid; the database must reject it.
