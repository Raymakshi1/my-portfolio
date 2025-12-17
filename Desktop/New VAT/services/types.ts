export enum UserRole {
  FARMER = 'FARMER',
  BUTCHERY = 'BUTCHERY',
  AUTHORITY = 'AUTHORITY',
  MARKET_AGENT = 'MARKET_AGENT'
}

export enum AnimalStatus {
  ACTIVE = 'ACTIVE',
  SOLD = 'SOLD',
  SLAUGHTERED = 'SLAUGHTERED',
  DEAD = 'DEAD',
  STOLEN = 'STOLEN',
  PENDING_TRANSFER = 'PENDING_TRANSFER'
}

export interface User {
  id: string;
  name: string;
  phoneNumber: string;
  password?: string; // Simple auth
  role: UserRole;
  location: {
    county: string;
    district: string;
    division: string;
    locationName: string; // The administrative "Location"
    sublocation: string;
    village: string;
  };
  registrationNumber: string;
}

export interface Animal {
  id: string;
  serialNumber: string;
  species: 'Cattle' | 'Goat' | 'Sheep' | 'Pig' | 'Camel';
  ownerId: string;
  status: AnimalStatus;
  description: string; // AI Generated
  photos: {
    front: string;
    left: string;
    right: string;
  };
  biometricHash?: string;
  registeredDate: string;
  transferHistory: TransferRecord[];
}

export interface TransferRequest {
  id: string;
  animalId: string;
  fromUserId: string;
  toUserId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  timestamp: string;
}

export interface TransferRecord {
  date: string;
  fromUserId: string;
  toUserId: string;
  type: 'SALE' | 'INHERITANCE' | 'BUTCHERY_TRANSFER';
  weight?: number; // For butchery transfers
}

export interface Alert {
  id: string;
  type: 'STOLEN' | 'RED_ZONE';
  animalId: string;
  details: string;
  targetCounty: string; // Broadcast mainly to county
  timestamp: string;
  resolved: boolean;
}

export interface ButcheryRecord {
  id: string;
  animalId: string;
  butcheryId: string;
  liveWeight: number;
  deadWeight: number;
  meatSold: number;
  date: string;
}