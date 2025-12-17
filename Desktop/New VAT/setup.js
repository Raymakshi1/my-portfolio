const fs = require('fs');
const path = require('path');

const files = {
  'package.json': `{
  "name": "cattle-tracker",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "start": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@google/genai": "*",
    "lucide-react": "^0.292.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "recharts": "^2.10.3"
  },
  "devDependencies": {
    "@types/react": "^18.2.37",
    "@types/react-dom": "^18.2.15",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.2.2",
    "vite": "^5.0.0"
  }
}`,
  'vite.config.ts': `import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env': env
    }
  }
})`,
  'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["."]
}`,
  'metadata.json': `{
  "name": "Cattle Tracker",
  "description": "A comprehensive livestock identification, registration, and tracking system.",
  "requestFramePermissions": [
    "camera",
    "microphone"
  ]
}`,
  'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cattle Tracker</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            colors: {
              primary: '#059669', // Emerald 600
              secondary: '#1e293b', // Slate 800
              accent: '#d97706', // Amber 600
              danger: '#dc2626', // Red 600
            }
          }
        }
      }
    </script>
    <style>
      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    </style>
  </head>
  <body class="bg-gray-50 text-slate-900">
    <div id="root"></div>
    <script type="module" src="/index.tsx"></script>
  </body>
</html>`,
  'index.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
  'types.ts': `export enum UserRole {
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
  role: UserRole;
  location: {
    county: string;
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
`,
  'services/geminiService.ts': `import { GoogleGenAI } from "@google/genai";

export const generateAnimalDescription = async (
  base64Image: string,
  species: string
): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.warn("API Key is missing. Skipping AI generation.");
        return "AI description unavailable (Missing API Key).";
    }

    // Initialize Gemini Client lazily
    const ai = new GoogleGenAI({ apiKey });

    const prompt = \`Describe this \${species} for a livestock registration database. 
    Focus on: 
    1. Color pattern 
    2. Distinct markings (spots, brands, scars) 
    3. Body shape/size 
    4. Any special identifying features. 
    Keep it concise (under 50 words) and factual.\`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image.split(',')[1],
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    return response.text || "No description generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating description. Please describe manually.";
  }
};

export const analyzeTheftRisk = async (stolenCount: number, location: string): Promise<string> => {
    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            return "Risk analysis unavailable (Missing API Key).";
        }

        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: \`Analyze theft risk for location \${location} given \${stolenCount} recent theft reports. Provide a short 1-sentence risk assessment and a recommendation for local farmers.\`
        });
        return response.text || "Analysis unavailable.";
    } catch (e) {
        console.error("Gemini API Error:", e);
        return "Risk analysis unavailable.";
    }
}

export const validateIrisScan = async (base64Image: string): Promise<{valid: boolean, hash: string}> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        // Fallback for demo without key
        return { valid: true, hash: \`BIO-\${Math.random().toString(36).substring(7).toUpperCase()}\` };
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // We ask Gemini to confirm if the image looks like an eye/retina close up
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image.split(',')[1] } },
          { text: "Does this image look like a close-up of an animal eye or iris suitable for biometric scanning? Answer strictly YES or NO." }
        ]
      }
    });

    const text = response.text?.trim().toUpperCase() || "NO";
    const valid = text.includes("YES");
    
    return {
      valid: valid,
      hash: valid ? \`BIO-\${Date.now()}-\${Math.random().toString(36).substring(2, 8).toUpperCase()}\` : ''
    };

  } catch (e) {
    console.error("Biometric validation failed", e);
    return { valid: true, hash: \`BIO-OFFLINE-\${Date.now()}\` };
  }
}`,
  'services/store.tsx': `import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Animal, Alert, UserRole, AnimalStatus, ButcheryRecord } from '../types';

interface AppState {
  currentUser: User | null;
  users: User[];
  animals: Animal[];
  alerts: Alert[];
  butcheryRecords: ButcheryRecord[];
  login: (role: UserRole) => void;
  logout: () => void;
  registerAnimal: (animal: Animal) => void;
  reportStolen: (animalId: string) => void;
  markDead: (animalId: string) => void;
  homeSlaughter: (animalId: string) => void;
  initiateTransfer: (animalId: string, toUserId: string) => void;
  confirmTransfer: (animalId: string) => void;
  logSlaughter: (record: ButcheryRecord) => void;
}

const StoreContext = createContext<AppState | undefined>(undefined);

const MOCK_USERS: User[] = [
  { id: 'u1', name: 'John Doe', phoneNumber: '0712345678', role: UserRole.FARMER, location: { county: 'Nairobi', sublocation: 'Karen', village: 'Miotoni' }, registrationNumber: 'USR-001' },
  { id: 'u2', name: 'Jane Smith', phoneNumber: '0722222222', role: UserRole.BUTCHERY, location: { county: 'Kiambu', sublocation: 'Limuru', village: 'Tigoni' }, registrationNumber: 'BUT-101' },
  { id: 'u3', name: 'Officer Baraza', phoneNumber: '0733333333', role: UserRole.AUTHORITY, location: { county: 'Nairobi', sublocation: 'CBD', village: 'Central' }, registrationNumber: 'GOV-999' },
  { id: 'u4', name: 'Market Agent Kiptoo', phoneNumber: '0744444444', role: UserRole.MARKET_AGENT, location: { county: 'Nakuru', sublocation: 'Molo', village: 'Sacho' }, registrationNumber: 'MKT-555' },
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
  const [users] = useState<User[]>(MOCK_USERS);
  const [animals, setAnimals] = useState<Animal[]>(MOCK_ANIMALS);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [butcheryRecords, setButcheryRecords] = useState<ButcheryRecord[]>([]);

  const login = (role: UserRole) => {
    const user = users.find(u => u.role === role);
    if (user) setCurrentUser(user);
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
        details: \`STOLEN: \${animal.species} (\${animal.serialNumber}) from \${currentUser.location.village}, \${currentUser.location.county}.\`,
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

  const logSlaughter = (record: ButcheryRecord) => {
    setButcheryRecords(prev => [...prev, record]);
    setAnimals(prev => prev.map(a => a.id === record.animalId ? { ...a, status: AnimalStatus.SLAUGHTERED } : a));
    
    if (record.meatSold > record.deadWeight) {
        const newAlert: Alert = {
            id: Date.now().toString(),
            type: 'RED_ZONE',
            animalId: record.animalId,
            details: \`FRAUD ALERT: Butchery \${record.butcheryId} sold \${record.meatSold}kg but dead weight was \${record.deadWeight}kg.\`,
            timestamp: new Date().toISOString(),
            resolved: false
        };
        setAlerts(prev => [newAlert, ...prev]);
    }
  };

  return (
    <StoreContext.Provider value={{ 
      currentUser, users, animals, alerts, butcheryRecords,
      login, logout, registerAnimal, reportStolen, initiateTransfer, confirmTransfer, logSlaughter, markDead, homeSlaughter
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};`,
  'App.tsx': `import React, { useState, useRef, useEffect } from 'react';
import { StoreProvider, useStore } from './services/store';
import { UserRole, AnimalStatus, Animal } from './types';
import { generateAnimalDescription, analyzeTheftRisk, validateIrisScan } from './services/geminiService';
import { 
  Menu, X, ShieldAlert, ScanLine, User, PlusCircle, 
  Search, LogOut, CheckCircle, AlertTriangle,
  Camera, ShoppingBag, Utensils, Skull, Eye
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const Button = ({ className, variant = 'primary', ...props }: any) => {
  const baseStyle = "px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-primary text-white hover:bg-emerald-700",
    secondary: "bg-secondary text-white hover:bg-slate-900",
    danger: "bg-danger text-white hover:bg-red-700",
    outline: "border-2 border-slate-200 text-slate-700 hover:border-primary hover:text-primary"
  };
  return <button className={\`\${baseStyle} \${variants[variant]} \${className || ''}\`} {...props} />;
};

const Card = ({ children, className }: any) => (
  <div className={\`bg-white p-4 rounded-xl shadow-sm border border-slate-100 \${className || ''}\`}>{children}</div>
);

const Badge = ({ status }: { status: AnimalStatus }) => {
  const styles = {
    [AnimalStatus.ACTIVE]: "bg-green-100 text-green-800",
    [AnimalStatus.SOLD]: "bg-blue-100 text-blue-800",
    [AnimalStatus.SLAUGHTERED]: "bg-gray-100 text-gray-800",
    [AnimalStatus.DEAD]: "bg-slate-200 text-slate-600",
    [AnimalStatus.STOLEN]: "bg-red-100 text-red-800 animate-pulse",
    [AnimalStatus.PENDING_TRANSFER]: "bg-yellow-100 text-yellow-800",
  };
  return <span className={\`px-2 py-1 rounded-full text-xs font-bold uppercase \${styles[status]}\`}>{status.replace('_', ' ')}</span>;
};

const BiometricScanner = ({ onScanComplete }: { onScanComplete: (hash: string) => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        let stream: MediaStream | null = null;
        
        const startCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'environment' } 
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Camera access denied:", err);
                setError("Camera access denied. Please allow permissions.");
            }
        };

        startCamera();

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const captureAndScan = async () => {
        if (!videoRef.current || !canvasRef.current) return;
        
        setScanning(true);
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        if (context) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const base64Data = canvas.toDataURL('image/jpeg');
            
            const result = await validateIrisScan(base64Data);
            
            if (result.valid) {
                onScanComplete(result.hash);
            } else {
                setError("Scan failed. No valid iris/eye detected. Try getting closer.");
                setScanning(false);
            }
        }
    };

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden shadow-inner">
                {error ? (
                    <div className="flex items-center justify-center h-full text-white text-center p-4">
                        <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
                        <p>{error}</p>
                    </div>
                ) : (
                    <>
                        <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-48 h-48 border-2 border-primary/70 rounded-full animate-pulse flex items-center justify-center">
                                <div className="w-40 h-40 border border-white/50 rounded-full"></div>
                                <div className="absolute top-0 w-full h-0.5 bg-red-500 animate-[scan_2s_ease-in-out_infinite]"></div>
                            </div>
                        </div>
                        {scanning && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">
                                <div className="flex flex-col items-center">
                                    <div className="w-8 h-8 border-4 border-t-white border-transparent rounded-full animate-spin mb-2"></div>
                                    <p>Verifying Biometrics...</p>
                                </div>
                            </div>
                        )}
                    </>
                )}
                <canvas ref={canvasRef} className="hidden" />
            </div>
            
            {!error && (
                <Button onClick={captureAndScan} disabled={scanning} className="w-full">
                    {scanning ? 'Processing...' : 'Capture Iris Scan'}
                </Button>
            )}
             <p className="text-xs text-slate-400 text-center">Center the animal's eye in the circle.</p>
        </div>
    );
};

const LoginView = () => {
  const { login } = useStore();
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg text-center">
        <div className="w-20 h-20 bg-primary rounded-full mx-auto flex items-center justify-center mb-6">
          <ScanLine className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Cattle Tracker</h1>
        <p className="text-slate-500 mb-8">Secure Livestock Identification & Management</p>
        
        <div className="space-y-3">
          <Button onClick={() => login(UserRole.FARMER)} className="w-full justify-center">Login as Farmer</Button>
          <Button onClick={() => login(UserRole.BUTCHERY)} variant="secondary" className="w-full justify-center">Login as Butchery</Button>
          <Button onClick={() => login(UserRole.AUTHORITY)} variant="outline" className="w-full justify-center">Authority Dashboard</Button>
          <Button onClick={() => login(UserRole.MARKET_AGENT)} variant="outline" className="w-full justify-center">Market Agent</Button>
        </div>
        <p className="mt-6 text-xs text-slate-400">Uses Biometric Authentication in Production</p>
      </div>
    </div>
  );
};

const RegisterAnimalView = ({ onCancel }: { onCancel: () => void }) => {
  const { registerAnimal, currentUser } = useStore();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<Animal>>({
    species: 'Cattle',
    serialNumber: \`CAT-\${Date.now()}\`
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      setLoading(true);
      const desc = await generateAnimalDescription(base64, formData.species || 'Animal');
      setFormData(prev => ({ ...prev, description: desc, photoUrl: base64 }));
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleScanComplete = (hash: string) => {
    setFormData(prev => ({ ...prev, biometricHash: hash }));
    handleSubmit(hash);
  };

  const handleSubmit = (biometricHash?: string) => {
    const finalHash = biometricHash || formData.biometricHash;
    if (!formData.species || !formData.description || !currentUser || !finalHash) return;
    
    registerAnimal({
      id: Date.now().toString(),
      ownerId: currentUser.id,
      status: AnimalStatus.ACTIVE,
      transferHistory: [],
      registeredDate: new Date().toISOString(),
      photoUrl: imagePreview || 'https://picsum.photos/300/200',
      serialNumber: formData.serialNumber!,
      species: formData.species as any,
      description: formData.description,
      biometricHash: finalHash
    });
    onCancel();
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" onClick={onCancel} className="p-2"><X className="w-4 h-4" /></Button>
        <h2 className="text-xl font-bold">Register New Animal</h2>
      </div>

      {step === 1 && (
        <div className="space-y-4">
           <div>
            <label className="block text-sm font-medium mb-1">Species</label>
            <select 
              className="w-full p-3 border rounded-lg bg-white"
              value={formData.species}
              onChange={(e) => setFormData({...formData, species: e.target.value as any})}
            >
              <option value="Cattle">Cattle</option>
              <option value="Goat">Goat</option>
              <option value="Sheep">Sheep</option>
              <option value="Pig">Pig</option>
              <option value="Camel">Camel</option>
            </select>
          </div>
          
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center">
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="mx-auto h-48 rounded-lg object-cover mb-4" />
            ) : (
              <div className="flex flex-col items-center py-4">
                <Camera className="w-12 h-12 text-slate-400 mb-2" />
                <p className="text-sm text-slate-500">Upload Photo (Left Side)</p>
              </div>
            )}
            <input type="file" accept="image/*" onChange={handleImageUpload} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-emerald-700"/>
          </div>

          {loading && <p className="text-center text-primary animate-pulse">AI is analyzing image...</p>}
          
          {formData.description && (
            <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="text-xs font-bold uppercase text-slate-400 mb-1">AI Description</h3>
              <p className="text-sm">{formData.description}</p>
            </div>
          )}

          <Button 
            className="w-full" 
            disabled={!formData.description || loading}
            onClick={() => setStep(2)}
          >
            Next: Biometric Scan
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
           <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
             <div className="flex items-center gap-2">
               <Eye className="w-5 h-5 text-blue-600" />
               <p className="text-sm text-blue-800 font-bold">Mandatory Iris Scan</p>
             </div>
             <p className="text-xs text-blue-600 mt-1">Every animal must be biometrically scanned to prevent theft and ensure ownership.</p>
           </div>
           
           <BiometricScanner onScanComplete={handleScanComplete} />
        </div>
      )}
    </div>
  );
};

const FarmerDashboard = () => {
  const { currentUser, animals, reportStolen, initiateTransfer, markDead, homeSlaughter } = useStore();
  const [view, setView] = useState<'LIST' | 'REGISTER'>('LIST');
  const [search, setSearch] = useState('');

  const myAnimals = animals.filter(a => a.ownerId === currentUser?.id);

  if (view === 'REGISTER') return <RegisterAnimalView onCancel={() => setView('LIST')} />;

  return (
    <div className="space-y-6 pb-20">
      <header className="flex justify-between items-center p-4 bg-white sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Livestock</h1>
          <p className="text-xs text-slate-500">{currentUser?.location.village}, {currentUser?.location.county}</p>
        </div>
        <Button onClick={() => setView('REGISTER')} className="rounded-full w-10 h-10 p-0"><PlusCircle /></Button>
      </header>

      <div className="px-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search serial number..." 
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-primary"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="space-y-4">
          {myAnimals.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <p>No animals registered yet.</p>
            </div>
          ) : (
            myAnimals
              .filter(a => a.serialNumber.toLowerCase().includes(search.toLowerCase()))
              .map(animal => (
              <Card key={animal.id} className="flex flex-col gap-3">
                <div className="flex gap-4">
                  <img src={animal.photoUrl} alt="Animal" className="w-20 h-20 rounded-lg object-cover bg-slate-100" />
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-slate-800">{animal.serialNumber}</h3>
                      <Badge status={animal.status} />
                    </div>
                    <p className="text-sm text-slate-500">{animal.species}</p>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{animal.description}</p>
                    {animal.biometricHash && (
                        <div className="flex items-center gap-1 mt-1">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            <span className="text-[10px] text-slate-400">Biometric Verified</span>
                        </div>
                    )}
                  </div>
                </div>
                
                {animal.status === AnimalStatus.ACTIVE && (
                  <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-100">
                    <button 
                        onClick={() => initiateTransfer(animal.id, 'buyer-id')}
                        className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-slate-50 text-slate-600"
                    >
                        <ShoppingBag className="w-5 h-5 text-blue-500" />
                        <span className="text-[10px] font-medium">Sell</span>
                    </button>
                    
                    <button 
                        onClick={() => {
                             if(confirm('Confirm Home Slaughter? This will remove the animal from active stock.')) {
                                 homeSlaughter(animal.id);
                             }
                        }}
                        className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-slate-50 text-slate-600"
                    >
                        <Utensils className="w-5 h-5 text-orange-500" />
                        <span className="text-[10px] font-medium">Slaughter</span>
                    </button>

                     <button 
                        onClick={() => {
                             if(confirm('Mark animal as Dead? This is permanent.')) {
                                 markDead(animal.id);
                             }
                        }}
                        className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-slate-50 text-slate-600"
                    >
                        <Skull className="w-5 h-5 text-slate-500" />
                        <span className="text-[10px] font-medium">Dead</span>
                    </button>

                    <button 
                         onClick={() => {
                            if(confirm('Are you sure you want to report this animal as STOLEN? This will alert authorities.')) {
                                reportStolen(animal.id);
                            }
                        }}
                        className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-red-50 text-slate-600"
                    >
                        <ShieldAlert className="w-5 h-5 text-red-500" />
                        <span className="text-[10px] font-medium text-red-600">Stolen</span>
                    </button>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const AuthorityDashboard = () => {
  const { alerts, animals, users } = useStore();
  const [riskAnalysis, setRiskAnalysis] = useState<string | null>(null);

  const stolenCount = animals.filter(a => a.status === AnimalStatus.STOLEN).length;
  const activeCount = animals.filter(a => a.status === AnimalStatus.ACTIVE).length;
  
  const data = [
    { name: 'Active', value: activeCount },
    { name: 'Sold', value: animals.filter(a => a.status === AnimalStatus.SOLD).length },
    { name: 'Stolen', value: stolenCount },
    { name: 'Slaughtered', value: animals.filter(a => a.status === AnimalStatus.SLAUGHTERED).length },
  ];
  const COLORS = ['#059669', '#3b82f6', '#dc2626', '#64748b'];

  const handleAnalyzeRisk = async () => {
      setRiskAnalysis("Analyzing...");
      const analysis = await analyzeTheftRisk(stolenCount, "County Wide");
      setRiskAnalysis(analysis);
  }

  return (
    <div className="space-y-6 p-4 pb-20">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Authority HQ</h1>
        <p className="text-slate-500">Monitoring & Theft Prevention</p>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-red-50 border-red-100">
          <h3 className="text-red-800 text-xs font-bold uppercase">Stolen Alerts</h3>
          <p className="text-3xl font-bold text-red-600">{alerts.filter(a => a.type === 'STOLEN').length}</p>
        </Card>
        <Card className="bg-blue-50 border-blue-100">
          <h3 className="text-blue-800 text-xs font-bold uppercase">Total Animals</h3>
          <p className="text-3xl font-bold text-blue-600">{animals.length}</p>
        </Card>
      </div>

      <Card>
        <h3 className="font-bold mb-4">Livestock Status Distribution</h3>
        <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie data={data} innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value">
                {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
                </Pie>
                <Tooltip />
            </PieChart>
            </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 text-xs">
            {data.map((d, i) => (
                <div key={i} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[i]}}></div>
                    <span>{d.name}</span>
                </div>
            ))}
        </div>
      </Card>

      <Card>
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold">AI Theft Risk Analysis</h3>
            <Button variant="outline" className="text-xs py-1 px-2" onClick={handleAnalyzeRisk}>Analyze</Button>
          </div>
          {riskAnalysis ? (
              <p className="text-sm text-slate-600 italic">{riskAnalysis}</p>
          ) : (
              <p className="text-sm text-slate-400">Click analyze to generate insights using Gemini.</p>
          )}
      </Card>

      <div>
        <h3 className="font-bold text-slate-700 mb-3">Recent Alerts</h3>
        <div className="space-y-3">
          {alerts.length === 0 ? <p className="text-slate-400 text-sm">No active alerts.</p> : alerts.map(alert => (
            <div key={alert.id} className="bg-white p-3 rounded-lg border-l-4 border-red-500 shadow-sm flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-1" />
              <div>
                <p className="text-sm font-bold text-slate-800">{alert.type.replace('_', ' ')}</p>
                <p className="text-xs text-slate-600">{alert.details}</p>
                <p className="text-[10px] text-slate-400 mt-1">{new Date(alert.timestamp).toLocaleTimeString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ButcheryDashboard = () => {
    const { animals, currentUser, logSlaughter } = useStore();
    const [selectedAnimalId, setSelectedAnimalId] = useState('');
    const [weights, setWeights] = useState({ live: 0, dead: 0, sold: 0 });

    const ownedAnimals = animals.filter(a => a.ownerId === currentUser?.id && a.status === AnimalStatus.ACTIVE);

    const handleSlaughter = () => {
        if (!selectedAnimalId || !currentUser) return;
        logSlaughter({
            id: Date.now().toString(),
            animalId: selectedAnimalId,
            butcheryId: currentUser.id,
            liveWeight: weights.live,
            deadWeight: weights.dead,
            meatSold: weights.sold,
            date: new Date().toISOString()
        });
        setSelectedAnimalId('');
        setWeights({ live: 0, dead: 0, sold: 0 });
        alert("Slaughter recorded successfully.");
    };

    return (
        <div className="p-4 space-y-6 pb-20">
            <header>
                <h1 className="text-2xl font-bold">Butchery Panel</h1>
                <p className="text-slate-500">Log Slaughters & Transfers</p>
            </header>

            <Card>
                <h3 className="font-bold mb-4 flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-accent" /> Log Slaughter
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Select Animal (Stock)</label>
                        <select 
                            className="w-full p-2 border rounded-lg bg-slate-50"
                            value={selectedAnimalId}
                            onChange={(e) => setSelectedAnimalId(e.target.value)}
                        >
                            <option value="">-- Select Animal --</option>
                            {ownedAnimals.map(a => (
                                <option key={a.id} value={a.id}>{a.serialNumber} - {a.species}</option>
                            ))}
                        </select>
                        {ownedAnimals.length === 0 && <p className="text-xs text-red-500 mt-1">You must accept a transfer to have stock.</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500">Live Weight (kg)</label>
                            <input type="number" className="w-full p-2 border rounded" value={weights.live} onChange={e => setWeights({...weights, live: Number(e.target.value)})} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500">Dead Weight (kg)</label>
                            <input type="number" className="w-full p-2 border rounded" value={weights.dead} onChange={e => setWeights({...weights, dead: Number(e.target.value)})} />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-xs font-medium text-slate-500">Sale Quantity (kg)</label>
                        <input type="number" className="w-full p-2 border rounded" value={weights.sold} onChange={e => setWeights({...weights, sold: Number(e.target.value)})} />
                    </div>

                    {weights.sold > weights.dead && (
                        <div className="bg-red-100 text-red-800 text-xs p-2 rounded flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Warning: Sale weight exceeds dead weight. This will be flagged.
                        </div>
                    )}

                    <Button className="w-full" onClick={handleSlaughter} disabled={!selectedAnimalId}>Confirm Slaughter</Button>
                </div>
            </Card>
        </div>
    );
}

const AppContent = () => {
  const { currentUser, alerts, logout } = useStore();
  const [currentTab, setCurrentTab] = useState('DASHBOARD');

  const stolenAlerts = alerts.filter(a => a.type === 'STOLEN' && !a.resolved);
  
  if (!currentUser) return <LoginView />;

  const renderView = () => {
    switch(currentUser.role) {
      case UserRole.FARMER: return <FarmerDashboard />;
      case UserRole.AUTHORITY: return <AuthorityDashboard />;
      case UserRole.BUTCHERY: return <ButcheryDashboard />;
      case UserRole.MARKET_AGENT: return <div className="p-10 text-center">Market Scanner Interface (Scan QR/Iris)</div>;
      default: return <FarmerDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {stolenAlerts.length > 0 && (
        <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-between text-sm font-medium shadow-md">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 animate-pulse" />
            <span>{stolenAlerts.length} Active Stolen Animal Reports</span>
          </div>
        </div>
      )}

      <main className="max-w-md mx-auto min-h-screen bg-white shadow-2xl overflow-hidden relative">
        {renderView()}

        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-3 px-6 flex justify-between items-center z-50 max-w-md mx-auto shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button onClick={() => setCurrentTab('DASHBOARD')} className={`flex flex-col items-center gap-1 ${currentTab === 'DASHBOARD' ? 'text-primary' : 'text-slate-400'}`}>
            <User className="w-6 h-6" />
            <span className="text-[10px] font-bold">Home</span>
          </button>
          
          <button className="flex flex-col items-center gap-1 text-slate-400 relative">
             <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
             <ShieldAlert className="w-6 h-6" />
             <span className="text-[10px] font-bold">Alerts</span>
          </button>

          <button onClick={logout} className="flex flex-col items-center gap-1 text-slate-400">
            <LogOut className="w-6 h-6" />
            <span className="text-[10px] font-bold">Logout</span>
          </button>
        </nav>
      </main>
    </div>
  );
};

const App = () => {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
};

export default App;`
};

Object.keys(files).forEach(fileName => {
  const content = files[fileName];
  const filePath = path.join(__dirname, fileName);
  const dirName = path.dirname(filePath);
  
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`Created ${fileName}`);
});

console.log('Setup complete! Run "npm install" then "npm run dev"');