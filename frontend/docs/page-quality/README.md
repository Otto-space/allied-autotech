# Page-by-page quality milestones

This register tracks the September 30 page-by-page override and breadcrumb/password addendum. The earlier redesign handoff does not establish completion of these newer requirements. Each route must pass its own audit, concept, implementation, browser, responsive, accessibility and code-quality gate before the next route begins. Listing and detail routes are separate milestones.

Completed route: `/services/[serviceId]` (Service detail); see the [Service detail report](service-detail.md). Next milestone: Booking form. See the [Product detail report](product-detail.md) and [Vehicle detail report](vehicle-detail.md) for preceding detail milestones, and the [Services](services.md), [Shop](shop.md), [Vehicles](vehicles.md) and [Contact](contact.md) reports for completed listing and Contact gates. Each report states its local verification scope and deployment limitations.

| Order | Surface                                                           | Status under the new brief                             |
| ----- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| 1     | Contact and Customer Care                                         | Complete; live keyed Maps awaits owner configuration   |
| 2     | Vehicles listing and filtering                                    | [Complete; local acceptance passed](vehicles.md)       |
| 3     | Shop listing and filtering                                        | [Complete; local acceptance passed](shop.md)           |
| 4     | Services listing and filtering                                    | [Complete; local acceptance passed](services.md)       |
| 5     | Vehicle detail                                                    | [Complete; local acceptance passed](vehicle-detail.md) |
| 6     | Product detail                                                    | [Complete; local acceptance passed](product-detail.md) |
| 7     | Service detail                                                    | [Complete; local acceptance passed](service-detail.md) |
| 8     | Booking form                                                      | Pending                                                |
| 9     | Quotation form                                                    | Pending                                                |
| 10    | Vehicle inspection and enquiry forms                              | Pending                                                |
| 11    | Checkout forms                                                    | Pending                                                |
| 12    | Login and registration                                            | Pending, each route separately                         |
| 13    | Email verification, MFA, authenticator, security key and recovery | Pending, each route separately                         |
| 14    | Customer dashboard pages                                          | Pending, each route separately                         |
| 15    | Staff dashboard pages                                             | Pending, each route separately                         |
| 16    | Admin dashboard pages                                             | Pending, each route separately                         |
| 17    | Super Admin dashboard pages                                       | Pending, each route separately                         |
| 18    | Help Centre and support forms                                     | Pending, each route separately                         |
| 19    | Remaining public and account pages                                | Pending, each route separately                         |

For workflows sharing a route, record the actual route and separately verify each relevant state. Regression checks of shared components on other routes do not count as redesigning or completing those routes.

Every appropriate page needs a semantic, responsive breadcrumb using readable entity names. Each password input needs its own accessible visibility control and verification of the required security transitions. Contact contains no password field. Forms and filters must use supported backend payloads, clearly visible boundaries, compact responsive layouts and real error/loading/empty/success behavior.

Backend gaps are maintained in [Backend Implementation Gaps](../../../BACKEND_IMPLEMENTATION_GAPS.md). Concurrent backend/media/customer-directory work has its own scope and must be preserved; its presence does not automatically satisfy these page-specific visual gates.

Maps configuration is conditional: without `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, Contact must show the approved address and working external links. A real keyed embed remains unverified until the owner supplies configuration. The approved landmark is **beside Kilimanjaro**.
