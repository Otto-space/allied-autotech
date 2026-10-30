# Payment reversal guidance — 30 October 2026

Canonical source: backend/src/modules/learning/learning.content.ts, article
no-live-lookup version 3, reviewed 2026-10-30. Eligibility remains public; no live
account lookup, tool permission, guide target or practice write is introduced.
The version participates in existing source hashing/invalidation.

The guidance explains Reversal reported, distinguishes the historical confirmed
amount from proof of a bank refund, and directs the customer to care without paying
again before review. Sources are the payment status/projection and verified provider
observation contract, not generated business policy. Existing feature flags remain
unchanged. Publication and real-role hosted acceptance have not occurred.

Verification: catalogue-learning and allie-role-guidance included in 27 passing
backend unit cases; three browser fixture cases cover detail at 390/1440 and customer
history. The real isolated database tests verify that settled captures remain
unchanged, worker/verification observations deduplicate, customer reads expose only
the review boolean, and wrong-reference reversals cannot affect this payment.
