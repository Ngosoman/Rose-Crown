# Client Decisions

The implementation keeps unresolved business policy conservative. Confirm these items before production:

- What cancellation window applies after approval? Who can cancel, and what refund/deposit rules apply?
- Which payment provider, currencies, deposit timing, tax/fee rules, and refund workflow should be implemented? No payment is currently collected or verified.
- Should manual bookings always be confirmed immediately, or should a staff member be able to save a pending request? Current manual booking is confirmed immediately.
- Are any cleaning-turnaround blocks required after checkout? Current cleaning blocks are manual; checkout does not silently create one.
- Are extension nights charged at the current seasonal/base rate, a negotiated rate, or with a fixed fee? Current approval reprices all nights at existing active rates and applies no fee.
- Which property staff should receive checkout/booking messages? Current recipients are all assigned property members.
- What overdue interval and reminder offsets should each property use? Defaults are 120/30 minutes and 60-minute overdue intervals but fields are configurable.
- Which email, SMS, and WhatsApp providers/accounts should be used? Only a Resend email adapter exists; credentials are not configured.
- What jurisdiction-specific privacy, terms, cancellation, accessibility, and contact language should replace the launch-warning copy?
- Which reports, revenue definitions, occupancy calculation, property creation roles, and retention/deletion policy are required?
