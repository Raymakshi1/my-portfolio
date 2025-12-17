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
  password?: string;
  role: UserRole;
  location: {
    county: string;
    district: string;
    division: string;
    locationName: string;
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
  description: string;
  photoUrl: string;
  biometricHash?: string;
  registeredDate: string;
  transferHistory: TransferRecord[];
}

export interface TransferRecord {
  date: string;
  fromUserId: string;
  toUserId: string;
  type: 'SALE' | 'INHERITANCE' | 'BUTCHERY_TRANSFER';
  weight?: number;
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