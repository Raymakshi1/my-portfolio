import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Animal, Alert, UserRole, AnimalStatus, ButcheryRecord, TransferRequest } from '../types';

interface AppState {
  currentUser: User | null;
  users: User[];
  animals: Animal[];
  alerts: Alert[];
  transferRequests: TransferRequest[];
  butcheryRecords: ButcheryRecord[];
  
  // Auth
  registerUser: (user: Omit<User, 'id' | 'registrationNumber'>) => void;
  login: (phone: string, pass: string) => boolean;
  logout: () => void;

  // Actions
  registerAnimal: (animal: Animal) => void;
  reportStolen: (animalId: string) => void;
  recoverAnimal: (animalId: string) => void;
  markDead: (animalId: string) => void;
  homeSlaughter: (animalId: string) => void;
  
  // Transfer Logic
  initiateTransfer: (animalId: string, toUserId: string) => void;
  acceptTransfer: (requestId: string) => void;
  rejectTransfer: (requestId: string) => void;
  
  // Butchery Specific
  logSlaughter: (record: ButcheryRecord) => void;
  transferToButchery: (animalId: string, fromButcheryId: string, toButcheryId: string, weight: number) => void;

  // Helpers
  findAnimalByHash: (hash: string) => Animal | undefined;
}

const StoreContext = createContext<AppState | undefined>(undefined);

const MOCK_USERS: User[] = [
  { 
    id: 'u1', name: 'John Doe', phoneNumber: '0712345678', password: '123', role: UserRole.FARMER, 
    location: { county: 'Nairobi', district: 'Langata', division: 'Karen', locationName: 'Karen', sublocation: 'Karen Plains', village: 'Miotoni' }, 
    registrationNumber: 'USR-001' 
  }
];

const MOCK_ANIMALS: Animal[] = [
  { 
    id: 'a1', serialNumber: 'COW-2023-001', species: 'Cattle', ownerId: 'u1', status: AnimalStatus.ACTIVE, 
    description: 'Black and white Holstein with a star on forehead.',
    registeredDate: '2023-01-15', transferHistory: [], biometricHash: 'BIO-MOCK-1',
    photos: {
        front: 'https://picsum.photos/300/200',
        left: 'https://picsum.photos/300/201',
        right: 'https://picsum.photos/300/202'
    }
  }
];

// Helper to load from LocalStorage safely with Migration Logic
const loadState = <T,>(key: string, fallback: T): T => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return fallback;
    
    const parsed = JSON.parse(stored);

    // MIGRATION FIX: Ensure animals have the 'photos' object structure
    if (key === 'animals' && Array.isArray(parsed)) {
      return parsed.map((a: any) => {
        if (!a.photos) {
          // Convert old format to new format
          return {
            ...a,
            photos: {
              left: a.photoUrl || 'https://picsum.photos/200',
              right: 'https://picsum.photos/200',
              front: 'https://picsum.photos/200'
            },
            // Remove old field if you want, or keep for safety
            photoUrl: undefined 
          };
        }
        return a;
      }) as unknown as T;
    }

    return parsed;
  } catch (e) {
    console.error(`Failed to load ${key}`, e);
    return fallback;
  }
};

const safeSetItem = (key: string, value: any) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error(`Failed to save ${key} to localStorage (likely quota exceeded):`, e);
        // Optionally alert the user here, but we generally just fail silently in console for now
        // to prevent crashing the React tree.
    }
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize state from LocalStorage or Fallback
  const [currentUser, setCurrentUser] = useState<User | null>(() => loadState('currentUser', null));
  const [users, setUsers] = useState<User[]>(() => loadState('users', MOCK_USERS));
  const [animals, setAnimals] = useState<Animal[]>(() => loadState('animals', MOCK_ANIMALS));
  const [alerts, setAlerts] = useState<Alert[]>(() => loadState('alerts', []));
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>(() => loadState('transferRequests', []));
  const [butcheryRecords, setButcheryRecords] = useState<ButcheryRecord[]>(() => loadState('butcheryRecords', []));

  // Persist State safely
  useEffect(() => safeSetItem('currentUser', currentUser), [currentUser]);
  useEffect(() => safeSetItem('users', users), [users]);
  useEffect(() => safeSetItem('animals', animals), [animals]);
  useEffect(() => safeSetItem('alerts', alerts), [alerts]);
  useEffect(() => safeSetItem('transferRequests', transferRequests), [transferRequests]);
  useEffect(() => safeSetItem('butcheryRecords', butcheryRecords), [butcheryRecords]);

  // Auth Functions
  const registerUser = (userData: Omit<User, 'id' | 'registrationNumber'>) => {
    const newUser: User = {
      ...userData,
      id: `u${Date.now()}`,
      registrationNumber: userData.role === UserRole.BUTCHERY 
        ? `BUT-${Math.floor(1000 + Math.random() * 9000)}`
        : `USR-${Math.floor(1000 + Math.random() * 9000)}`
    };
    setUsers(prev => [...prev, newUser]);
  };

  const login = (phone: string, pass: string): boolean => {
    const user = users.find(u => u.phoneNumber === phone && u.password === pass);
    if (user) {
      setCurrentUser(user);
      return true;
    }
    return false;
  };

  const logout = () => setCurrentUser(null);

  // Animal Functions
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
        details: `STOLEN: ${animal.species} (${animal.serialNumber}) from ${currentUser.location.village}`,
        targetCounty: currentUser.location.county,
        timestamp: new Date().toISOString(),
        resolved: false
      };
      setAlerts(prev => [newAlert, ...prev]);
    }
  };

  const recoverAnimal = (animalId: string) => {
    // 1. Return animal to ACTIVE status
    setAnimals(prev => prev.map(a => a.id === animalId ? { ...a, status: AnimalStatus.ACTIVE } : a));
    
    // 2. Mark any STOLEN alerts for this animal as resolved
    setAlerts(prev => prev.map(a => (a.animalId === animalId && a.type === 'STOLEN') ? { ...a, resolved: true } : a));
  };

  const markDead = (animalId: string) => {
    setAnimals(prev => prev.map(a => a.id === animalId ? { ...a, status: AnimalStatus.DEAD } : a));
  };

  const homeSlaughter = (animalId: string) => {
    setAnimals(prev => prev.map(a => a.id === animalId ? { ...a, status: AnimalStatus.SLAUGHTERED } : a));
  };

  // Transfer Functions
  const initiateTransfer = (animalId: string, toUserId: string) => {
    if (!currentUser) return;
    const newRequest: TransferRequest = {
      id: `tr-${Date.now()}`,
      animalId,
      fromUserId: currentUser.id,
      toUserId,
      status: 'PENDING',
      timestamp: new Date().toISOString()
    };
    setTransferRequests(prev => [...prev, newRequest]);
    setAnimals(prev => prev.map(a => a.id === animalId ? { ...a, status: AnimalStatus.PENDING_TRANSFER } : a));
  };

  const acceptTransfer = (requestId: string) => {
    const request = transferRequests.find(r => r.id === requestId);
    if (!request) return;

    setAnimals(prev => prev.map(a => {
      if (a.id !== request.animalId) return a;
      return {
        ...a,
        ownerId: request.toUserId,
        status: AnimalStatus.SOLD,
        transferHistory: [...a.transferHistory, {
          date: new Date().toISOString(),
          fromUserId: request.fromUserId,
          toUserId: request.toUserId,
          type: 'SALE'
        }]
      };
    }));

    setTransferRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'ACCEPTED' } : r));
  };

  const rejectTransfer = (requestId: string) => {
    const request = transferRequests.find(r => r.id === requestId);
    if (!request) return;

    setAnimals(prev => prev.map(a => a.id === request.animalId ? { ...a, status: AnimalStatus.ACTIVE } : a));
    setTransferRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'REJECTED' } : r));
  };

  const transferToButchery = (animalId: string, fromButcheryId: string, toButcheryId: string, weight: number) => {
      // Butchery to Butchery logic
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
        details: `FRAUD: Butchery ${record.butcheryId} sold ${record.meatSold}kg (Dead Weight: ${record.deadWeight}kg)`,
        targetCounty: 'ALL', // Authorities see all
        timestamp: new Date().toISOString(),
        resolved: false
      };
      setAlerts(prev => [newAlert, ...prev]);
    }
  };

  const findAnimalByHash = (hash: string) => {
    return animals.find(a => a.biometricHash === hash || a.id === 'a1'); // Mock ID included for demo
  };

  return (
    <StoreContext.Provider value={{ 
      currentUser, users, animals, alerts, butcheryRecords, transferRequests,
      registerUser, login, logout,
      registerAnimal, reportStolen, recoverAnimal, markDead, homeSlaughter,
      initiateTransfer, acceptTransfer, rejectTransfer,
      logSlaughter, transferToButchery,
      findAnimalByHash
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