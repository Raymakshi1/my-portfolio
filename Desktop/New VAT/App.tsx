import React, { useState, useRef, useEffect } from 'react';
import { StoreProvider, useStore } from './services/store';
import { UserRole, AnimalStatus, Animal, User } from './types';
import { generateAnimalDescription, analyzeTheftRisk, validateIrisScan } from './services/geminiService';
import { 
  Menu, X, ShieldAlert, ScanLine, User as UserIcon, PlusCircle, 
  Search, LogOut, CheckCircle, AlertTriangle, 
  Camera, ShoppingBag, Utensils, Skull, Bell, Edit3
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

// --- SHARED COMPONENTS ---

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'outline' }> = ({ className, variant = 'primary', ...props }) => {
  const baseStyle = "px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-primary text-white hover:bg-emerald-700",
    secondary: "bg-secondary text-white hover:bg-slate-900",
    danger: "bg-danger text-white hover:bg-red-700",
    outline: "border-2 border-slate-200 text-slate-700 hover:border-primary hover:text-primary"
  };
  return <button className={`${baseStyle} ${variants[variant]} ${className || ''}`} {...props} />;
};

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`bg-white p-4 rounded-xl shadow-sm border border-slate-100 ${className || ''}`}>{children}</div>
);

const Badge: React.FC<{ status: AnimalStatus }> = ({ status }) => {
  const styles = {
    [AnimalStatus.ACTIVE]: "bg-green-100 text-green-800",
    [AnimalStatus.SOLD]: "bg-blue-100 text-blue-800",
    [AnimalStatus.SLAUGHTERED]: "bg-gray-100 text-gray-800",
    [AnimalStatus.DEAD]: "bg-slate-200 text-slate-600",
    [AnimalStatus.STOLEN]: "bg-red-100 text-red-800 animate-pulse",
    [AnimalStatus.PENDING_TRANSFER]: "bg-yellow-100 text-yellow-800",
  };
  return <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${styles[status]}`}>{status.replace('_', ' ')}</span>;
};

// --- IMAGE UTILS ---
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Max width 600px is sufficient for mobile display and small enough for localStorage
        const MAX_WIDTH = 600; 
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            // Compress to 60% quality JPEG
            resolve(canvas.toDataURL('image/jpeg', 0.6));
        } else {
            resolve(event.target?.result as string);
        }
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
};

// --- ERROR BOUNDARY ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: any) { console.error("Uncaught error:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center text-red-600 h-screen flex flex-col justify-center items-center bg-slate-50">
          <AlertTriangle className="w-12 h-12 mb-4" />
          <h2 className="text-xl font-bold">Something went wrong</h2>
          <p className="text-sm text-slate-600 mt-2 mb-4 max-w-xs mx-auto break-words">{this.state.error?.message}</p>
          <div className="flex gap-2">
            <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="px-4 py-2 bg-slate-800 text-white rounded">Reset Data</button>
            <button onClick={() => window.location.reload()} className="px-4 py-2 border border-slate-800 rounded">Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- BIOMETRIC SCANNER ---
const BiometricScanner: React.FC<{ onScanComplete: (hash: string) => void, mode?: 'REGISTER' | 'IDENTIFY' }> = ({ onScanComplete, mode = 'REGISTER' }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [scanning, setScanning] = useState(false);
    const [simulating, setSimulating] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } } 
                });
                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
            } catch (err) { 
                console.error("Camera error", err); 
                setError("Camera access denied or unavailable.");
            }
        };
        startCamera();
        
        return () => { 
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
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
            // Lower resolution for performance and storage
            canvas.width = 320; 
            canvas.height = 240;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const base64Data = canvas.toDataURL('image/jpeg', 0.6); // Compress heavily for Iris preview
            
            // Artificial delay for UX
            await new Promise(r => setTimeout(r, 1000));
            
            const result = await validateIrisScan(base64Data);
            
            if(result.valid) {
                onScanComplete(result.hash);
            } else {
                setScanning(false);
                alert("Scan failed. Try again.");
            }
        }
    };

    const handleSimulate = () => {
        setSimulating(true);
        setTimeout(() => {
            onScanComplete(`BIO-SIM-${Date.now()}`);
            setSimulating(false);
        }, 1500);
    };

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-6 bg-red-50 rounded-lg text-red-600">
                <AlertTriangle className="w-8 h-8 mb-2" />
                <p>{error}</p>
                <Button onClick={handleSimulate} variant="outline" className="mt-4">Use Simulator Mode</Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none border-2 border-primary/50 rounded-xl">
                    <div className="w-48 h-48 border-2 border-primary rounded-full animate-pulse"></div>
                </div>
                {(scanning || simulating) && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white z-10">
                        <div className="w-8 h-8 border-4 border-t-white border-transparent rounded-full animate-spin mb-2"></div>
                        <p>Verifying Biometrics...</p>
                    </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="flex gap-2 w-full">
                <Button onClick={captureAndScan} disabled={scanning || simulating} className="flex-1">
                    {mode === 'REGISTER' ? 'Scan Iris' : 'Identify'}
                </Button>
                <Button onClick={handleSimulate} variant="outline" disabled={scanning || simulating} className="flex-1">Simulate</Button>
            </div>
        </div>
    );
};

// --- AUTHENTICATION VIEW ---
const AuthView: React.FC = () => {
  const { login, registerUser } = useStore();
  const [isLogin, setIsLogin] = useState(true);
  
  // Registration State
  const [regData, setRegData] = useState({
      name: '', phone: '', password: '',
      county: '', district: '', division: '', locationName: '', sublocation: '', village: '',
      role: UserRole.FARMER
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(isLogin) {
        if(!login(regData.phone, regData.password)) alert("Invalid Credentials");
    } else {
        const values = Object.values(regData);
        if(values.some(v => v === '')) { alert("All fields required"); return; }
        
        registerUser({
            name: regData.name, phoneNumber: regData.phone, password: regData.password, role: regData.role,
            location: {
                county: regData.county, district: regData.district, division: regData.division,
                locationName: regData.locationName, sublocation: regData.sublocation, village: regData.village
            }
        });
        alert("Registered! Please login.");
        setIsLogin(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 pb-20 overflow-y-auto">
        <div className="w-full max-w-md bg-white p-6 rounded-2xl shadow-lg my-10">
            <div className="text-center mb-6">
                <ScanLine className="w-12 h-12 text-primary mx-auto mb-2" />
                <h1 className="text-xl font-bold">Cattle Tracker</h1>
                <p className="text-sm text-slate-500">{isLogin ? "Login to your account" : "Complete Registration"}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
                {!isLogin && <input type="text" placeholder="Full Name" className="w-full p-3 border rounded" value={regData.name} onChange={e=>setRegData({...regData, name: e.target.value})} />}
                <input type="tel" placeholder="Phone Number" className="w-full p-3 border rounded" value={regData.phone} onChange={e=>setRegData({...regData, phone: e.target.value})} />
                <input type="password" placeholder="Password" className="w-full p-3 border rounded" value={regData.password} onChange={e=>setRegData({...regData, password: e.target.value})} />

                {!isLogin && (
                    <div className="space-y-2 pt-2 border-t mt-2">
                        <p className="text-xs font-bold text-slate-500 uppercase">Location Details</p>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="text" placeholder="County" className="p-2 border rounded text-sm" value={regData.county} onChange={e=>setRegData({...regData, county: e.target.value})} />
                            <input type="text" placeholder="District" className="p-2 border rounded text-sm" value={regData.district} onChange={e=>setRegData({...regData, district: e.target.value})} />
                            <input type="text" placeholder="Division" className="p-2 border rounded text-sm" value={regData.division} onChange={e=>setRegData({...regData, division: e.target.value})} />
                            <input type="text" placeholder="Location" className="p-2 border rounded text-sm" value={regData.locationName} onChange={e=>setRegData({...regData, locationName: e.target.value})} />
                            <input type="text" placeholder="Sublocation" className="p-2 border rounded text-sm" value={regData.sublocation} onChange={e=>setRegData({...regData, sublocation: e.target.value})} />
                            <input type="text" placeholder="Village" className="p-2 border rounded text-sm" value={regData.village} onChange={e=>setRegData({...regData, village: e.target.value})} />
                        </div>
                        <select className="w-full p-2 border rounded text-sm" value={regData.role} onChange={e=>setRegData({...regData, role: e.target.value as UserRole})}>
                            <option value={UserRole.FARMER}>Farmer</option>
                            <option value={UserRole.BUTCHERY}>Butchery</option>
                            <option value={UserRole.MARKET_AGENT}>Market Agent</option>
                            <option value={UserRole.AUTHORITY}>Authority</option>
                        </select>
                    </div>
                )}

                <Button type="submit" className="w-full mt-4">{isLogin ? "Login" : "Register"}</Button>
            </form>
            <p className="text-center text-sm text-primary mt-4 cursor-pointer" onClick={()=>setIsLogin(!isLogin)}>
                {isLogin ? "Create an account" : "Back to Login"}
            </p>
        </div>
    </div>
  );
};

// --- ANIMAL REGISTRATION (3 PHOTOS) ---
const RegisterAnimalView: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
    const { registerAnimal, currentUser } = useStore();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<Partial<Animal>>({ species: 'Cattle', serialNumber: `CAT-${Date.now()}` });
    const [photos, setPhotos] = useState({ front: '', left: '', right: '' });

    const handlePhoto = async (side: 'front' | 'left' | 'right', file: File) => {
        setLoading(true);
        try {
            // Automatically compress image to avoid "Image too large" errors and save storage
            const compressedBase64 = await compressImage(file);
            setPhotos(prev => ({...prev, [side]: compressedBase64}));
            
            // Generate description using the compressed image (left side only for demo)
            if(side === 'left') {
                const desc = await generateAnimalDescription(compressedBase64, data.species || 'Animal');
                setData(prev => ({...prev, description: desc}));
            }
        } catch (e) {
            console.error("Image processing error", e);
            alert("Failed to process image. Please try another one.");
        } finally {
            setLoading(false);
        }
    };

    const finalize = (hash: string) => {
        if(!currentUser || !data.species) return;
        registerAnimal({
            id: Date.now().toString(), ownerId: currentUser.id, status: AnimalStatus.ACTIVE,
            species: data.species, serialNumber: data.serialNumber!, description: data.description || '',
            photos: photos as any, biometricHash: hash, registeredDate: new Date().toISOString(), transferHistory: []
        });
        // Delay onCancel slightly to ensure state update propagates
        setTimeout(() => onCancel(), 100);
    };

    return (
        <div className="p-4 space-y-6 pb-24">
            <div className="flex justify-between items-center"><h2 className="text-xl font-bold">Register Animal</h2><Button variant="outline" onClick={onCancel}><X className="w-4 h-4"/></Button></div>
            {step === 1 && (
                <div className="space-y-4">
                    <select className="w-full p-3 border rounded" value={data.species} onChange={e=>setData({...data, species: e.target.value as any})}>
                        <option value="Cattle">Cattle</option><option value="Goat">Goat</option><option value="Sheep">Sheep</option><option value="Pig">Pig</option><option value="Camel">Camel</option>
                    </select>
                    <div className="grid grid-cols-3 gap-2">
                        {['left', 'right', 'front'].map(side => (
                            <div key={side} className="border-2 border-dashed rounded h-24 flex items-center justify-center relative bg-slate-50 overflow-hidden">
                                {photos[side as keyof typeof photos] ? (
                                    <img src={photos[side as keyof typeof photos]} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-xs text-slate-400 capitalize">{side}</span>
                                )}
                                <input type="file" accept="image/*" className="absolute inset-0 opacity-0" onChange={e => e.target.files && handlePhoto(side as any, e.target.files[0])} />
                            </div>
                        ))}
                    </div>
                    {loading && <p className="text-center text-xs text-primary animate-pulse">Processing Image...</p>}
                    <textarea className="w-full p-2 border rounded text-sm" placeholder="Description" value={data.description} onChange={e=>setData({...data, description: e.target.value})} rows={3} />
                    <Button className="w-full" disabled={!photos.left || !photos.right || !photos.front || loading} onClick={()=>setStep(2)}>Next: Biometrics</Button>
                </div>
            )}
            {step === 2 && <BiometricScanner onScanComplete={finalize} />}
        </div>
    );
};

// --- BUYER SEARCH MODAL ---
const TransferModal: React.FC<{ animalId: string, onClose: () => void }> = ({ animalId, onClose }) => {
    const { users, currentUser, initiateTransfer } = useStore();
    const [search, setSearch] = useState('');
    const buyers = users.filter(u => u.id !== currentUser?.id && (u.name.toLowerCase().includes(search.toLowerCase()) || u.registrationNumber.includes(search)));

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-xl p-4 h-[70vh] flex flex-col">
                <div className="flex justify-between mb-4"><h3 className="font-bold">Select Buyer</h3><Button variant="outline" onClick={onClose}><X className="w-4 h-4"/></Button></div>
                <input placeholder="Search Name or Reg No..." className="w-full p-2 border rounded mb-4" value={search} onChange={e=>setSearch(e.target.value)} />
                <div className="overflow-y-auto flex-1 space-y-2">
                    {buyers.map(u => (
                        <div key={u.id} className="p-3 border rounded flex justify-between items-center">
                            <div><p className="font-bold text-sm">{u.name}</p><p className="text-xs text-slate-500">{u.registrationNumber}</p></div>
                            <Button className="text-xs" onClick={()=>{initiateTransfer(animalId, u.id); onClose(); alert("Request Sent!");}}>Select</Button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- MARKET AGENT VIEW ---
const MarketView: React.FC = () => {
    const { findAnimalByHash, users } = useStore();
    const [scanned, setScanned] = useState<Animal | null>(null);

    return (
        <div className="p-4 space-y-6 pb-24">
            <h1 className="text-2xl font-bold">Market Check-In</h1>
            {!scanned ? (
                <BiometricScanner mode="IDENTIFY" onScanComplete={hash => {
                    const animal = findAnimalByHash(hash);
                    if(animal) setScanned(animal);
                    else alert("Animal Not Found in Registry");
                }} />
            ) : (
                <Card className="border-l-4 border-green-500">
                    <div className="flex gap-4">
                        <img src={scanned.photos?.left || 'https://picsum.photos/200'} className="w-24 h-24 object-cover rounded" />
                        <div>
                            <h3 className="font-bold">{scanned.serialNumber}</h3>
                            <Badge status={scanned.status} />
                            <p className="text-sm mt-1">{scanned.description}</p>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t">
                        <p className="text-xs font-bold uppercase text-slate-500">Current Owner</p>
                        <p>{users.find(u => u.id === scanned.ownerId)?.name || 'Unknown'}</p>
                    </div>
                    {scanned.status === AnimalStatus.STOLEN && <div className="bg-red-600 text-white p-2 text-center mt-4 rounded font-bold animate-pulse">STOP! STOLEN ANIMAL</div>}
                    <Button onClick={()=>setScanned(null)} className="w-full mt-4">Scan Next</Button>
                </Card>
            )}
        </div>
    );
};

// --- DASHBOARDS ---

const FarmerDashboard: React.FC = () => {
    const { currentUser, animals, reportStolen, recoverAnimal, markDead, homeSlaughter } = useStore();
    const [view, setView] = useState('LIST');
    const [sellId, setSellId] = useState<string | null>(null);
    const myAnimals = animals.filter(a => a.ownerId === currentUser?.id);

    if(view === 'REGISTER') return <RegisterAnimalView onCancel={()=>setView('LIST')} />;

    return (
        <div className="space-y-6 p-4 pb-24">
            <div className="flex justify-between items-center">
                <div><h1 className="text-xl font-bold">My Stock</h1><p className="text-xs text-slate-500">{currentUser?.location.village}</p></div>
                <Button onClick={()=>setView('REGISTER')}><PlusCircle className="w-4 h-4"/> Add</Button>
            </div>
            <div className="space-y-4">
                {myAnimals.map(a => (
                    <Card key={a.id}>
                        <div className="flex gap-3 mb-3">
                            <img src={a.photos?.left || 'https://picsum.photos/200'} className="w-20 h-20 rounded object-cover" />
                            <div><h3 className="font-bold">{a.serialNumber}</h3><Badge status={a.status} /><p className="text-xs text-slate-500">{a.species}</p></div>
                        </div>
                        {a.status === AnimalStatus.ACTIVE && (
                            <div className="grid grid-cols-4 gap-2 pt-2 border-t">
                                <button onClick={()=>setSellId(a.id)} className="flex flex-col items-center gap-1 text-[10px]"><ShoppingBag className="w-5 h-5 text-blue-500"/>Sell</button>
                                <button onClick={()=>confirm("Home Slaughter?") && homeSlaughter(a.id)} className="flex flex-col items-center gap-1 text-[10px]"><Utensils className="w-5 h-5 text-orange-500"/>Eat</button>
                                <button onClick={()=>confirm("Dead?") && markDead(a.id)} className="flex flex-col items-center gap-1 text-[10px]"><Skull className="w-5 h-5 text-slate-500"/>Dead</button>
                                <button onClick={()=>confirm("Report Stolen?") && reportStolen(a.id)} className="flex flex-col items-center gap-1 text-[10px]"><ShieldAlert className="w-5 h-5 text-red-500"/>Stolen</button>
                            </div>
                        )}
                        {a.status === AnimalStatus.STOLEN && (
                            <div className="mt-2 pt-2 border-t border-red-100">
                                <div className="bg-red-50 p-2 rounded-lg mb-2">
                                    <p className="text-xs text-red-700 flex items-center gap-1 font-bold">
                                        <ShieldAlert className="w-3 h-3" />
                                        Reported Stolen - Authorities Notified
                                    </p>
                                </div>
                                <Button 
                                    variant="primary" 
                                    className="w-full py-2 text-xs"
                                    onClick={() => {
                                        if(confirm('Confirm recovery? This will return the animal to ACTIVE status and resolve alerts.')) {
                                            recoverAnimal(a.id);
                                        }
                                    }}
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    Report Recovered & Return to Stock
                                </Button>
                            </div>
                        )}
                    </Card>
                ))}
            </div>
            {sellId && <TransferModal animalId={sellId} onClose={()=>setSellId(null)} />}
        </div>
    );
};

const ButcheryDashboard: React.FC = () => {
    const { animals, currentUser, logSlaughter, transferToButchery } = useStore();
    const [activeTab, setActiveTab] = useState<'SLAUGHTER' | 'TRANSFER'>('SLAUGHTER');
    const [formData, setFormData] = useState({ animalId: '', live: 0, dead: 0, sold: 0 });
    const stock = animals.filter(a => a.ownerId === currentUser?.id && a.status === AnimalStatus.ACTIVE);

    const handleSlaughter = () => {
        logSlaughter({ id: Date.now().toString(), animalId: formData.animalId, butcheryId: currentUser!.id, liveWeight: formData.live, deadWeight: formData.dead, meatSold: formData.sold, date: new Date().toISOString() });
        alert("Logged!"); setFormData({ animalId: '', live: 0, dead: 0, sold: 0 });
    };

    return (
        <div className="p-4 space-y-6 pb-24">
            <h1 className="text-2xl font-bold">Butchery Panel</h1>
            <div className="flex gap-2"><Button onClick={()=>setActiveTab('SLAUGHTER')} variant={activeTab==='SLAUGHTER'?'primary':'outline'} className="flex-1">Log Slaughter</Button><Button onClick={()=>setActiveTab('TRANSFER')} variant={activeTab==='TRANSFER'?'primary':'outline'} className="flex-1">Transfer Stock</Button></div>
            
            {activeTab === 'SLAUGHTER' ? (
                <Card className="space-y-4">
                    <select className="w-full p-2 border rounded" value={formData.animalId} onChange={e=>setFormData({...formData, animalId: e.target.value})}>
                        <option value="">Select Animal</option>{stock.map(a=><option key={a.id} value={a.id}>{a.serialNumber}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-4"><input type="number" placeholder="Live Kg" className="p-2 border rounded" onChange={e=>setFormData({...formData, live: +e.target.value})} /><input type="number" placeholder="Dead Kg" className="p-2 border rounded" onChange={e=>setFormData({...formData, dead: +e.target.value})} /></div>
                    <input type="number" placeholder="Sold Kg" className="w-full p-2 border rounded" onChange={e=>setFormData({...formData, sold: +e.target.value})} />
                    <Button className="w-full" onClick={handleSlaughter}>Confirm</Button>
                </Card>
            ) : (
                 <div className="text-center p-10 text-slate-400">Butchery-to-Butchery Transfer Module Active</div>
            )}
        </div>
    );
};

const AuthorityDashboard: React.FC = () => {
    const { alerts, animals } = useStore();
    // Filter alerts to only show unresolved or important ones if desired, or show all with status
    const activeAlerts = alerts.filter(a => !a.resolved);
    
    const data = [{name: 'Active', value: animals.filter(a=>a.status==='ACTIVE').length}, {name: 'Stolen', value: animals.filter(a=>a.status==='STOLEN').length}];
    return (
        <div className="p-4 space-y-6 pb-24">
            <h1 className="text-2xl font-bold">Authority HQ</h1>
            <div className="h-48"><ResponsiveContainer><PieChart><Pie data={data} dataKey="value" outerRadius={60} fill="#059669" label /><Tooltip/></PieChart></ResponsiveContainer></div>
            <h3 className="font-bold">Active Alerts (County Wide)</h3>
            {activeAlerts.length === 0 ? <p className="text-slate-400 text-sm">No active alerts.</p> : activeAlerts.map(a => (
                <div key={a.id} className="p-3 border-l-4 border-red-500 bg-white shadow mb-2">
                    <p className="font-bold">{a.type.replace('_', ' ')}</p>
                    <p className="text-xs">{a.details}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{new Date(a.timestamp).toLocaleString()}</p>
                </div>
            ))}
        </div>
    );
};

// --- APP ROOT ---
const AppContent: React.FC = () => {
    const { currentUser, logout, transferRequests, acceptTransfer, rejectTransfer, users, animals } = useStore();
    const [notifOpen, setNotifOpen] = useState(false);
    
    if(!currentUser) return <AuthView />;

    const myRequests = transferRequests.filter(r => r.toUserId === currentUser.id && r.status === 'PENDING');

    if(notifOpen) return (
        <div className="p-4 space-y-4 pb-24">
            <div className="flex justify-between"><h2 className="font-bold">Notifications</h2><Button variant="outline" onClick={()=>setNotifOpen(false)}><X className="w-4 h-4"/></Button></div>
            {myRequests.map(req => {
                const seller = users.find(u => u.id === req.fromUserId);
                const animal = animals.find(a => a.id === req.animalId);
                return (
                    <Card key={req.id}>
                        <p className="text-sm mb-2"><span className="font-bold">{seller?.name}</span> wants to sell you <span className="font-bold">{animal?.species}</span>.</p>
                        <div className="flex gap-2"><Button className="flex-1 text-xs" onClick={()=>acceptTransfer(req.id)}>Accept</Button><Button variant="danger" className="flex-1 text-xs" onClick={()=>rejectTransfer(req.id)}>Reject</Button></div>
                    </Card>
                )
            })}
            {myRequests.length === 0 && <p className="text-center text-slate-400">No new notifications.</p>}
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans relative">
            <main className="max-w-md mx-auto min-h-screen bg-white shadow-2xl overflow-y-auto relative">
                {currentUser.role === UserRole.FARMER && <FarmerDashboard />}
                {currentUser.role === UserRole.BUTCHERY && <ButcheryDashboard />}
                {currentUser.role === UserRole.AUTHORITY && <AuthorityDashboard />}
                {currentUser.role === UserRole.MARKET_AGENT && <MarketView />}

                <nav className="fixed bottom-0 left-0 right-0 bg-white border-t py-3 px-6 flex justify-between z-50 max-w-md mx-auto">
                    <button className="text-primary flex flex-col items-center gap-1"><UserIcon className="w-6 h-6"/><span className="text-[10px]">Home</span></button>
                    <button className="text-slate-400 flex flex-col items-center gap-1 relative" onClick={()=>setNotifOpen(true)}>
                        {myRequests.length > 0 && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"/>}
                        <Bell className="w-6 h-6"/><span className="text-[10px]">Notify</span>
                    </button>
                    <button className="text-slate-400 flex flex-col items-center gap-1" onClick={logout}><LogOut className="w-6 h-6"/><span className="text-[10px]">Logout</span></button>
                </nav>
            </main>
        </div>
    );
};

const App: React.FC = () => (
  <ErrorBoundary>
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  </ErrorBoundary>
);

export default App;