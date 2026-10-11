# Booking creation concept

[01 — Details, review and receipt](01-flow.webp) was generated before implementation of the guided booking states. It extends the approved Service detail design at `/services/[serviceId]#service-request`.

The production UI uses the existing Nippo/Quicksand fonts, real logo in the shared header, approved palette, existing service media and actual backend data. Sample service/branch/vehicle/date/reference values in the concept are illustration only. No duplicated logo is added inside the form. The compact progress labels sit beside their markers to fit the existing panel and narrow screens. An actual UUID is shown as the booking reference because the backend supplies no separate booking number.

The details step preserves the real branch/slot pagination, optional saved vehicle and contact reads, notes and published policy. The review is an inline summary; editing retains the mounted fields. No mutation occurs until the customer confirms. The received state uses the server response and distinguishes a request from a confirmed appointment.

The 7 October updated brief adds restrained panel depth, 320px/375px verification and role-aware booking controls. These are deliberate amendments to the earlier concept: anonymous visitors receive a sign-in action; work accounts receive dashboard/contact links. No payment step, upload, unverified service claim or response-time promise is introduced.
