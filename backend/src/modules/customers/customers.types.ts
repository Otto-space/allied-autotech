export interface CustomerVehicleProjection {
  nickname: string | null;
  isDefault: boolean;
  vehicleModelId: string | null;
  vehicleModel: {
    id: string;
    makeId: string;
    name: string;
    yearFrom: number;
    yearTo: number;
    isActive: boolean;
    make: { id: string; name: string; isActive: boolean };
  } | null;
  trim: string | null;
  engineCode: string | null;
  market: string | null;
  brakeSystem: string | null;
  brakeDiameterMm: string | null;
  bodyType: string | null;
  transmission: string | null;
  generation: string | null;
  chassisCode: string | null;
  id: string;
  make: string;
  model: string;
  year: number;
  registrationNumber: string | null;
  vin: string | null;
  color: string | null;
  mileageKm: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerVehiclePage {
  vehicles: readonly CustomerVehicleProjection[];
  nextCursor?: string;
}
