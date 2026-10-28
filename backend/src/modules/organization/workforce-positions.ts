// Job positions are business titles, not responsibility templates or grants.
// Adding a task-specific duty must never create a new position automatically.
export const workforcePositions = {
  CEO_MD: { label: "CEO / Managing Director", department: "Strategy" },
  OPERATIONS: { label: "Operations Supervisor", department: "Strategy" },
  CUSTOMER_SERVICE: { label: "Customer Service Officer", department: "Customer Service" },
  SALES_SUPERVISOR: { label: "Sales Supervisor", department: "Sales" },
  SALES_CASHIER: { label: "Sales Representative / Cashier", department: "Sales" },
  ACCOUNTANT: { label: "Accountant", department: "Accounts" },
  WORKSHOP_LEAD: { label: "Workshop / Quality Service Lead", department: "Services" },
  ELECTRICAL_TECHNICIAN: {
    label: "Electrical / Diagnostics Technician",
    department: "Services",
  },
  MECHANICAL_TECHNICIAN: { label: "Mechanical Technician", department: "Services" },
} as const;
