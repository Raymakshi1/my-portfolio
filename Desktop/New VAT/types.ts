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
  password?: string; // Optional for mock, mandatory for real registration
  role: UserRole;
  location: {
    county: string;
    district?: string;
    division?: string;
    locationName?: string;
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
  photoUrl: string;
  biometricHash?: string; // The unique ID from the iris scan
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
  type: 'SALE' | 'INHERITANCE';
}

export interface Alert {
  id: string;
  type: 'STOLEN' | 'RED_ZONE';
  animalId: string;
  details: string;
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