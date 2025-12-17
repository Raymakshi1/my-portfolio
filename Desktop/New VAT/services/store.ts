import React, { createContext, useContext, useState } from 'react';
import { User, Animal, Alert, UserRole, AnimalStatus, ButcheryRecord } from '../types';

interface AppState {
  currentUser: User | null;
  users: User[];
  animals: Animal[];
  alerts: Alert[];
  butcheryRecords: ButcheryRecord[];
  login: (phone: string, pass: string) => Promise<boolean>;
  registerUser: (user: Omit<User, 'id' | 'registrationNumber'>) => Promise<void>;
  logout: () => void;
  registerAnimal: (animal: Animal) => void;
  reportStolen: (animalId: string) => void;
  markDead: (animalId: string) => void;
  homeSlaughter: (animalId: string) => void;
  initiateTransfer: (animalId: string, toUserId: string) => void;
  confirmTransfer: (animalId: string) => void;
  logSlaughter: (record: ButcheryRecord) => void;
  transferToButchery: (animalId: string, fromButcheryId: string, toButcheryId: string, weight: number) => void;
}

const StoreContext = createContext<AppState | undefined>(undefined);

const MOCK_USERS: User[] = [
  { 
    id: 'u1', name: 'John Doe', phoneNumber: '0712345678', password: '123', role: UserRole.FARMER, 
    location: { county: 'Nairobi', district: 'Langata', division: 'Karen', locationName: 'Karen', sublocation: 'Karen Plains', village: 'Miotoni' }, 
    registrationNumber: 'USR-001' 
  },
  { 
    id: 'u2', name: 'City Market Butchery', phoneNumber: '0722222222', password: '123', role: UserRole.BUTCHERY, 
    location: { county: 'Kiambu', district: 'Limuru', division: 'Tigoni', locationName: 'Tigoni', sublocation: 'Tigoni A', village: 'Market Center' }, 
    registrationNumber: 'BUT-101' 
  },
  { 
    id: 'u5', name: 'Upcountry Meats', phoneNumber: '0755555555', password: '123', role: UserRole.BUTCHERY, 
    location: { county: 'Kiambu', district: 'Limuru', division: 'Tigoni', locationName: 'Tigoni', sublocation: 'Tigoni B', village: 'Farm Side' }, 
    registrationNumber: 'BUT-102' 
  },
  { 
    id: 'u3', name: 'Officer Baraza', phoneNumber: '0733333333', password: '123', role: UserRole.AUTHORITY, 
    location: { county: 'Nairobi', district: 'Starehe', division: 'Central', locationName: 'CBD', sublocation: 'CBD', village: 'Police HQ' }, 
    registrationNumber: 'GOV-999' 
  },
];

const MOCK_ANIMALS: Animal[] = [
  { 
    id: 'a1', serialNumber: 'COW-2023-001', species: 'Cattle', ownerId: 'u1', status: AnimalStatus.ACTIVE, 
    photoUrl: 'https://picsum.photos/300/200', description: 'Black and white Holstein with a star on forehead.',
    registeredDate: '2023-01-15', transferHistory: [], biometricHash: 'BIO-MOCK-1'
  },
  { 
    id: 'a2', serialNumber: 'GOAT-2023-045', species: 'Goat', ownerId: 'u1', status: AnimalStatus.ACTIVE, 
    photoUrl: 'https://picsum.photos/300/201', description: 'Brown boer goat, large horns.',
    registeredDate: '2023-06-10', transferHistory: [], biometricHash: 'BIO-MOCK-2'
  }
];

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [animals, setAnimals] = useState<Animal[]>(MOCK_ANIMALS);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [butcheryRecords, setButcheryRecords] = useState<ButcheryRecord[]>([]);

  const login = async (phone: string, pass: string): Promise<boolean> => {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 800));
    
    const user = users.find(u => u.phoneNumber === phone && u.password === pass);
    if (user) {
      setCurrentUser(user);
      return true;
    }
    return false;
  };

  const registerUser = async (userData: Omit<User, 'id' | 'registrationNumber'>) => {
    await new Promise(r => setTimeout(r, 1000));
    
    const newUser: User = {
        ...userData,
        id: `u${Date.now()}`,
        registrationNumber: `REG-${Math.floor(Math.random() * 10000)}`
    };
    
    setUsers(prev => [...prev, newUser]);
    setCurrentUser(newUser);
  };

  const logout = () => setCurrentUser(null);

  const registerAnimal = (newAnimal: Animal) => {
    setAnimals(prev => [...prev, newAnimal]);
  };

  const reportStolen = (animalId: string) => {
    setAnimals(prev => prev.map(a => a.id === animalId ? { ...a, status: AnimalStatus.STOLEN } : a));
    const animal = animals.find(a => a.id === animalId);
    if (animal && currentUser) {
      const newAlert: Alert = {
        id: Date.now().toString(),
        type: 'STOLEN',
        animalId,
        details: `STOLEN: ${animal.species} (${animal.serialNumber}) from ${currentUser.location.village}, ${currentUser.location.county}.`,
        timestamp: new Date().toISOString(),
        resolved: false
      };
      setAlerts(prev => [newAlert, ...prev]);
    }
  };

  const markDead = (animalId: string) => {
    setAnimals(prev => prev.map(a => a.id === animalId ? { ...a, status: AnimalStatus.DEAD } : a));
  };

  const homeSlaughter = (animalId: string) => {
    setAnimals(prev => prev.map(a => a.id === animalId ? { ...a, status: AnimalStatus.SLAUGHTERED } : a));
  };

  const initiateTransfer = (animalId: string, toUserId: string) => {
    setAnimals(prev => prev.map(a => a.id === animalId ? { ...a, status: AnimalStatus.PENDING_TRANSFER } : a));
    setTimeout(() => confirmTransfer(animalId, toUserId), 2000); 
  };

  const confirmTransfer = (animalId: string, newOwnerId: string = 'u2') => {
    setAnimals(prev => prev.map(a => {
      if (a.id !== animalId) return a;
      return {
        ...a,
        ownerId: newOwnerId,
        status: AnimalStatus.SOLD,
        transferHistory: [...a.transferHistory, {
          date: new Date().toISOString(),
          fromUserId: a.ownerId,
          toUserId: newOwnerId,
          type: 'SALE'
        }]
      };
    }));
  };

  const transferToButchery = (animalId: string, fromButcheryId: string, toButcheryId: string, weight: number) => {
    setAnimals(prev => prev.map(a => {
      if (a.id !== animalId) return a;
      return {
        ...a,
        ownerId: toButcheryId,
        transferHistory: [...a.transferHistory, {
          date: new Date().toISOString(),
          fromUserId: fromButcheryId,
          toUserId: toButcheryId,
          type: 'BUTCHERY_TRANSFER',
          weight
        }]
      };
    }));
  };

  const logSlaughter = (record: ButcheryRecord) => {
    setButcheryRecords(prev => [...prev, record]);
    setAnimals(prev => prev.map(a => a.id === record.animalId ? { ...a, status: AnimalStatus.SLAUGHTERED } : a));
    
    if (record.meatSold > record.deadWeight) {
        const newAlert: Alert = {
            id: Date.now().toString(),
            type: 'RED_ZONE',
            animalId: record.animalId,
            details: `FRAUD ALERT: Butchery ${record.butcheryId} sold ${record.meatSold}kg but dead weight was ${record.deadWeight}kg.`,
            timestamp: new Date().toISOString(),
            resolved: false
        };
        setAlerts(prev => [newAlert, ...prev]);
    }
  };

  return (
    <StoreContext.Provider value={{ 
      currentUser, users, animals, alerts, butcheryRecords,
      login, registerUser, logout, registerAnimal, reportStolen, initiateTransfer, confirmTransfer, logSlaughter, markDead, homeSlaughter, transferToButchery
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};