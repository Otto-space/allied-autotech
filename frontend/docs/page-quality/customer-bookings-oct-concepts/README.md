# Customer bookings concepts

Fresh [desktop](desktop.webp) and [mobile/states](mobile-states.webp) concepts were generated after the four baseline captures and before production edits.

The implementation uses the real Allied logo and current dashboard shell. Generated alternate logos, Shell branding, slogan, booking-search field, overflow menus and extra arrows are excluded: they do not match the approved brand or supported actions. Header actions remain Book a service and Refresh on mobile as well as desktop. Preserve the desktop heading/subtitle verbatim, existing permitted navigation, real statuses and actual record dates. The ink guidance strip follows the mobile concept and precedes the toolbar consistently. No fake metrics or dates enter production.

Design tokens: ink #01121A, red #E60301, white and cool grey; Quicksand 30/27px h1, 18px guidance/state headings, 15px service title and 13px body. Controls at least 44px, inputs/selects 48px, neutral state badges, 8px outer radius, light row dividers and no cell boxes. Desktop uses a compact five-column table; below 1100px it becomes labeled records with a single detail action. Scope styling to the customer bookings list.

Hierarchy: semantic breadcrumb; page heading and two actions; compact ink guidance; Booking status and Rows per page controls with reset; honest current-page count; results, loading, empty or retry state; Previous/current-page/Next and first-page recovery; time-zone note and Contact support. No API-supported customer search/sort/global totals exist, so none are invented. Customer URL status/limit/cursor and bounded UI-only cursor trail survive reload and browser navigation. Detail links keep existing actions on the detail route.
