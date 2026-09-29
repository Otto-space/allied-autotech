# Route coverage

Every existing page inherits the local Quicksand interface font and brand tokens. Public pages and catalogue details use the public system; authenticated routes inherit DashboardShell and the compact operational system, including their nested detail components. No route-level transaction handler was replaced. The new Help article route is included below. This is source coverage, not a claim that every possible backend state has been exercised live.

| Route                                             | Applied system                                          | Main composition                               |
| ------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------- |
| `/about`                                          | Public editorial/detail system                          | EquipmentGallery                               |
| `/admin/[resource]`                               | Operational dashboard + shared detail/form/table system | AdminResourcePanel                             |
| `/admin/audit`                                    | Operational dashboard + shared detail/form/table system | AuditLog                                       |
| `/admin/booking-capacity`                         | Operational dashboard + shared detail/form/table system | BookingCapacity                                |
| `/admin/booking-slots`                            | Operational dashboard + shared detail/form/table system | StaffBookingSlots                              |
| `/admin/bookings/[bookingId]`                     | Operational dashboard + shared detail/form/table system | StaffBookingDetail                             |
| `/admin/bookings`                                 | Operational dashboard + shared detail/form/table system | StaffBookings                                  |
| `/admin/complaint-policy`                         | Operational dashboard + shared detail/form/table system | OperationalPolicy                              |
| `/admin/delivery-policy`                          | Operational dashboard + shared detail/form/table system | DeliveryPolicy                                 |
| `/admin/dispute-policy`                           | Operational dashboard + shared detail/form/table system | OperationalPolicy                              |
| `/admin/finance-policy`                           | Operational dashboard + shared detail/form/table system | FinancePolicy                                  |
| `/admin/inspections`                              | Operational dashboard + shared detail/form/table system | StaffInspections                               |
| `/admin/inventory/[inventoryId]`                  | Operational dashboard + shared detail/form/table system | StaffInventoryDetail                           |
| `/admin/inventory`                                | Operational dashboard + shared detail/form/table system | StaffInventory                                 |
| `/admin/invoices/[invoiceId]`                     | Operational dashboard + shared detail/form/table system | StaffInvoiceDetail, FinanceAccess              |
| `/admin/invoices`                                 | Operational dashboard + shared detail/form/table system | StaffInvoices, FinanceAccess                   |
| `/admin/notifications`                            | Operational dashboard + shared detail/form/table system | NotificationsPanel                             |
| `/admin/orders/[orderId]/aftercare`               | Operational dashboard + shared detail/form/table system | OrderAftercare                                 |
| `/admin/orders/[orderId]`                         | Operational dashboard + shared detail/form/table system | StaffOrderDetail                               |
| `/admin/orders`                                   | Operational dashboard + shared detail/form/table system | StaffOrders                                    |
| `/admin`                                          | Operational dashboard + shared detail/form/table system | AdminOverview                                  |
| `/admin/payment-disputes`                         | Operational dashboard + shared detail/form/table system | PaymentDisputes                                |
| `/admin/payment-disputes/work`                    | Operational dashboard + shared detail/form/table system | DisputeWorkQueue                               |
| `/admin/payment-exceptions`                       | Operational dashboard + shared detail/form/table system | PaymentAnomalies                               |
| `/admin/payments`                                 | Operational dashboard + shared detail/form/table system | StaffPayments, FinanceAccess                   |
| `/admin/privacy`                                  | Operational dashboard + shared detail/form/table system | PrivacyRequests                                |
| `/admin/processing-jobs`                          | Operational dashboard + shared detail/form/table system | OperationalJobs                                |
| `/admin/promotions/[promotionId]`                 | Operational dashboard + shared detail/form/table system | PromotionDetail                                |
| `/admin/promotions/new`                           | Operational dashboard + shared detail/form/table system | PromotionCreate                                |
| `/admin/promotions`                               | Operational dashboard + shared detail/form/table system | PromotionList                                  |
| `/admin/refund-timing`                            | Operational dashboard + shared detail/form/table system | RefundTimingPolicy                             |
| `/admin/refunds`                                  | Operational dashboard + shared detail/form/table system | StaffRefunds                                   |
| `/admin/retention-policy`                         | Operational dashboard + shared detail/form/table system | OperationalPolicy                              |
| `/admin/reviews`                                  | Operational dashboard + shared detail/form/table system | StaffReviews                                   |
| `/admin/security`                                 | Operational dashboard + shared detail/form/table system | SecurityPanel                                  |
| `/admin/staff/[staffUserId]`                      | Operational dashboard + shared detail/form/table system | StaffAccountDetail                             |
| `/admin/staff/invite`                             | Operational dashboard + shared detail/form/table system | StaffInvitationForm                            |
| `/admin/staff`                                    | Operational dashboard + shared detail/form/table system | StaffDirectory                                 |
| `/admin/support/[kind]/[supportId]`               | Operational dashboard + shared detail/form/table system | SupportThread                                  |
| `/admin/support`                                  | Operational dashboard + shared detail/form/table system | SupportPanel                                   |
| `/admin/vehicle-sales/[transactionId]`            | Operational dashboard + shared detail/form/table system | StaffVehicleSaleDetail                         |
| `/admin/vehicle-sales`                            | Operational dashboard + shared detail/form/table system | StaffVehicleSales                              |
| `/admin/vehicles/[vehicleId]`                     | Operational dashboard + shared detail/form/table system | StaffVehicleDetail                             |
| `/admin/vehicles/new`                             | Operational dashboard + shared detail/form/table system | NewVehicleRecord                               |
| `/admin/vehicles`                                 | Operational dashboard + shared detail/form/table system | StaffVehicles                                  |
| `/contact`                                        | Public editorial/detail system                          | PublicEnquiryForm, EditorialBanner             |
| `/dashboard/bookings/[bookingId]`                 | Customer dashboard + shared detail/form/table system    | BookingDetail                                  |
| `/dashboard/bookings`                             | Customer dashboard + shared detail/form/table system    | BookingsPanel                                  |
| `/dashboard/cart`                                 | Customer dashboard + shared detail/form/table system    | CartPanel                                      |
| `/dashboard/inspections`                          | Customer dashboard + shared detail/form/table system    | InspectionHistory                              |
| `/dashboard/invoices/[invoiceId]`                 | Customer dashboard + shared detail/form/table system    | InvoiceDetail                                  |
| `/dashboard/invoices`                             | Customer dashboard + shared detail/form/table system    | InvoicesPanel                                  |
| `/dashboard/notifications`                        | Customer dashboard + shared detail/form/table system    | NotificationsPanel                             |
| `/dashboard/orders/[orderId]/aftercare`           | Customer dashboard + shared detail/form/table system    | OrderAftercare                                 |
| `/dashboard/orders/[orderId]`                     | Customer dashboard + shared detail/form/table system    | OrderDetail                                    |
| `/dashboard/orders`                               | Customer dashboard + shared detail/form/table system    | OrdersPanel                                    |
| `/dashboard`                                      | Customer dashboard + shared detail/form/table system    | DashboardOverview                              |
| `/dashboard/payments/[paymentId]`                 | Customer dashboard + shared detail/form/table system    | PaymentDetail                                  |
| `/dashboard/payments`                             | Customer dashboard + shared detail/form/table system    | PaymentsPanel                                  |
| `/dashboard/privacy`                              | Customer dashboard + shared detail/form/table system    | PrivacyRequests                                |
| `/dashboard/profile`                              | Customer dashboard + shared detail/form/table system    | ProfilePanel                                   |
| `/dashboard/reviews`                              | Customer dashboard + shared detail/form/table system    | ReviewsPanel                                   |
| `/dashboard/saved`                                | Customer dashboard + shared detail/form/table system    | SavedItems                                     |
| `/dashboard/security`                             | Customer dashboard + shared detail/form/table system    | SecurityPanel                                  |
| `/dashboard/support/[kind]/[supportId]`           | Customer dashboard + shared detail/form/table system    | SupportThread                                  |
| `/dashboard/support`                              | Customer dashboard + shared detail/form/table system    | SupportPanel                                   |
| `/dashboard/vehicle-transactions/[transactionId]` | Customer dashboard + shared detail/form/table system    | VehicleTransactionDetail                       |
| `/dashboard/vehicle-transactions`                 | Customer dashboard + shared detail/form/table system    | VehicleTransactions                            |
| `/dashboard/vehicles`                             | Customer dashboard + shared detail/form/table system    | CustomerVehicles                               |
| `/forgot-password`                                | Compact authentication system                           | AuthShell, EmailActionForm                     |
| `/help/[slug]`                                    | Public editorial/detail system                          | Route composition                              |
| `/help`                                           | Public editorial/detail system                          | ContactInvitation, HelpCentre                  |
| `/login`                                          | Compact authentication system                           | AuthShell, LoginForm                           |
| `/mfa`                                            | Compact authentication system                           | AuthShell, MfaForm                             |
| `/`                                               | Public editorial/detail system                          | PublicHome                                     |
| `/parts/[productId]`                              | Public editorial/detail system                          | MediaGallery, ProductActions                   |
| `/parts`                                          | Public editorial/detail system                          | PartsCatalogue                                 |
| `/payments/complete`                              | Public editorial/detail system                          | PaymentComplete                                |
| `/register`                                       | Compact authentication system                           | AuthShell, RegisterForm                        |
| `/reset-password`                                 | Compact authentication system                           | AuthShell, EmailActionForm                     |
| `/reviews`                                        | Public editorial/detail system                          | PublicReviews                                  |
| `/services/[serviceId]`                           | Public editorial/detail system                          | ServiceDetail                                  |
| `/services`                                       | Public editorial/detail system                          | ServiceList                                    |
| `/staff/accept-invitation`                        | Public editorial/detail system                          | AuthShell, AcceptStaffInvitation               |
| `/vehicles/[listingId]`                           | Public editorial/detail system                          | MediaGallery, VehicleActions                   |
| `/vehicles`                                       | Public editorial/detail system                          | VehicleCatalogue                               |
| `/verify-email`                                   | Compact authentication system                           | AuthShell, EmailActionForm, ResendVerification |
