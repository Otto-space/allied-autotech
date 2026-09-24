export const equipmentGroups = [
  {
    id: "workshop",
    title: "Tyres, alignment & workshop care",
    description:
      "Equipment that supports tyre replacement, balancing, alignment and everyday workshop operations.",
    items: [
      {
        slug: "3d-alignment",
        name: "3D alignment machine",
        description: "Supports precise wheel-alignment checks.",
      },
      {
        slug: "tyre-changer",
        name: "Tyre changer",
        description: "Used to remove and fit tyres to wheels.",
      },
      {
        slug: "wheel-balancer",
        name: "Wheel balancing machine",
        description: "Helps identify and correct wheel imbalance.",
      },
      {
        slug: "air-compressor",
        name: "High-capacity air compressor",
        description: "Supplies compressed air for workshop equipment.",
      },
    ],
  },
  {
    id: "diagnostics",
    title: "Electronic & electrical diagnostics",
    description:
      "Diagnostic tools help our technicians investigate faults. Suitable checks depend on the vehicle and the issue reported.",
    items: [
      {
        slug: "autel-mk808s",
        name: "Autel MK808S diagnostic tablet",
        description: "Supports vehicle-system diagnostic checks.",
      },
      {
        slug: "autel-mk900-bt",
        name: "Autel MK900-BT diagnostic system",
        description: "A tablet and interface for vehicle diagnostics.",
      },
      {
        slug: "xtool-diagnostics",
        name: "XTOOL diagnostic tablet",
        description: "Supports investigation of vehicle-system faults.",
      },
      {
        slug: "diagnostic-meter",
        name: "Electrical diagnostic meter",
        description: "Helps investigate electrical signals and measurements.",
      },
      {
        slug: "thermal-camera",
        name: "Thermal camera",
        description:
          "Shows temperature patterns to help investigate heat-related faults.",
      },
    ],
  },
  {
    id: "engine",
    title: "Engine, cooling & leak checks",
    description:
      "Targeted measurements help us understand the problem before recommending work.",
    items: [
      {
        slug: "cooling-pressure-tester",
        name: "Cooling system pressure tester",
        description: "Helps investigate pressure loss in the cooling system.",
      },
      {
        slug: "compression-tester",
        name: "Cylinder compression tester",
        description: "Measures cylinder compression during engine checks.",
      },
      {
        slug: "injector-tester-cleaner",
        name: "Fuel injector tester & cleaner",
        description: "Supports injector testing and cleaning.",
      },
      {
        slug: "fuel-pressure-tester",
        name: "Fuel pressure tester",
        description: "Checks fuel-system pressure during diagnosis.",
      },
      {
        slug: "mechanic-stethoscope",
        name: "Mechanic’s stethoscope",
        description: "Helps locate the source of mechanical noises.",
      },
      {
        slug: "smoke-leak-detector",
        name: "Smoke leak detector",
        description: "Helps locate leaks in suitable vehicle systems.",
      },
    ],
  },
] as const;

export const coreServices = [
  {
    name: "Tyre change",
    description:
      "Professional tyre replacement to keep your vehicle properly equipped for the road.",
    href: "/services",
  },
  {
    name: "Wheel alignment & balancing",
    description: "Precision care for handling, tyre life and ride comfort.",
    href: "/services",
  },
  {
    name: "Advanced diagnostics",
    description: "Practical expertise and modern tools to investigate vehicle faults.",
    href: "/services",
  },
  {
    name: "Vehicle maintenance",
    description: "Routine servicing and preventive care for dependable everyday driving.",
    href: "/services",
  },
  {
    name: "Genuine parts & products",
    description: "Automotive parts, oils and essentials for reliable vehicle care.",
    href: "/parts",
  },
  {
    name: "Car sales",
    description: "Vehicle sourcing and sales support for your next move.",
    href: "/vehicles",
  },
] as const;
