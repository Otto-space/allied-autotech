export interface CustomerVehicleProjection {
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
