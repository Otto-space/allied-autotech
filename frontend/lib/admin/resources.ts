export type AdminField = {
  name: string;
  label: string;
  type?:
    "text" | "textarea" | "number" | "money" | "select" | "boolean" | "email" | "tel";
  required?: boolean;
  nullable?: boolean;
  max?: number;
  min?: number;
  options?: string[];
  source?: string;
  readPath?: string;
  default?: string;
};
export type AdminResource = {
  title: string;
  singular: string;
  path: string;
  description: string;
  versioned?: boolean;
  fields: AdminField[];
};
const name: AdminField = { name: "name", label: "Name", required: true, max: 120 };
const slug: AdminField = { name: "slug", label: "URL name", required: true, max: 120 };
const active: AdminField = {
  name: "isActive",
  label: "Active",
  type: "boolean",
  default: "true",
};
export const adminResources: Record<string, AdminResource> = {
  branches: {
    title: "Branches",
    singular: "branch",
    path: "/admin/branches",
    description: "Manage workshop locations and their public contact details.",
    fields: [
      { name: "code", label: "Branch code", required: true, max: 20 },
      name,
      { name: "address", label: "Street address", required: true, max: 250 },
      { name: "city", label: "City", required: true, max: 100 },
      { name: "state", label: "State", required: true, max: 100 },
      {
        name: "country",
        label: "Country",
        type: "select",
        options: ["Nigeria"],
        default: "Nigeria",
      },
      {
        name: "timezone",
        label: "Appointment timezone",
        default: "Africa/Lagos",
        required: true,
        max: 64,
      },
      {
        name: "phone",
        label: "Public phone number",
        type: "tel",
        nullable: true,
        max: 32,
      },
      { name: "email", label: "Public email", type: "email", nullable: true, max: 254 },
      active,
    ],
  },
  categories: {
    title: "Part categories",
    singular: "category",
    path: "/admin/catalog/categories",
    description:
      "Organise the parts catalogue with clear category names and descriptions.",
    fields: [
      name,
      slug,
      {
        name: "description",
        label: "Description",
        type: "textarea",
        nullable: true,
        max: 2000,
      },
      active,
    ],
  },
  services: {
    title: "Services",
    singular: "service",
    path: "/admin/services",
    description: "Maintain published services, pricing and appointment durations.",
    versioned: true,
    fields: [
      { ...name, max: 160 },
      slug,
      { name: "shortDescription", label: "Short description", nullable: true, max: 500 },
      {
        name: "description",
        label: "Full description",
        type: "textarea",
        nullable: true,
        max: 10000,
      },
      {
        name: "pricingType",
        label: "Pricing",
        type: "select",
        required: true,
        options: ["FIXED", "QUOTE_REQUIRED"],
      },
      { name: "priceKobo", label: "Service price (NGN)", type: "money", nullable: true },
      {
        name: "durationMinutes",
        label: "Duration in minutes",
        type: "number",
        min: 15,
        max: 1440,
        required: true,
      },
      active,
    ],
  },
  products: {
    title: "Parts catalogue",
    singular: "part",
    path: "/admin/catalog/products",
    description: "Manage product details, pricing and catalogue visibility.",
    fields: [
      { ...name, max: 180 },
      slug,
      { name: "sku", label: "SKU", required: true, max: 80 },
      {
        name: "categoryId",
        label: "Category",
        type: "select",
        source: "/admin/catalog/categories",
        readPath: "category.id",
        required: true,
      },
      { name: "brand", label: "Brand", nullable: true, max: 100 },
      {
        name: "manufacturerPartNumber",
        label: "Manufacturer part number",
        nullable: true,
        max: 120,
      },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        nullable: true,
        max: 10000,
      },
      { name: "priceKobo", label: "Selling price (NGN)", type: "money", required: true },
      {
        name: "compareAtPriceKobo",
        label: "Comparison price (NGN, optional)",
        type: "money",
        nullable: true,
      },
      { name: "featured", label: "Featured", type: "boolean", default: "false" },
      active,
    ],
  },
};
