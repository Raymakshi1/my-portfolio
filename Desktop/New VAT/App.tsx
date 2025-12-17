import React, { useState, useRef, useEffect } from 'react';
import { StoreProvider, useStore } from './services/store';
import { UserRole, AnimalStatus, Animal } from './types';
import { generateAnimalDescription, analyzeTheftRisk, validateIrisScan } from './services/geminiService';
import { 
  X, ShieldAlert, ScanLine, User as UserIcon, PlusCircle, 
  Search, LogOut, CheckCircle, AlertTriangle, 
  Camera, ShoppingBag, Utensils, Skull, Eye, ArrowRightLeft, Lock
} from 'lucide-react';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// --- COMPONENTS ---

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

// --- BIOMETRIC SCANNER COMPONENT ---
const BiometricScanner: React.FC<{ onScanComplete: (hash: string) => void }> = ({ onScanComplete }) => {
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
            
            // Validate with AI
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
                        {/* Scanner Overlay */}
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

// --- VIEWS ---

const LoginView: React.FC = () => {
  const { login, registerUser } = useStore();
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Login State
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration State
  const [regData, setRegData] = useState({
      name: '',
      phoneNumber: '',
      password: '',
      role: UserRole.FARMER,
      county: '',
      district: '',
      division: '',
      locationName: '',
      sublocation: '',
      village: ''
  });

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      const success = await login(phone, password);
      setLoading(false);
      if(!success) alert("Invalid credentials or user not found.");
  };

  const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      await registerUser({
          name: regData.name,
          phoneNumber: regData.phoneNumber,
          password: regData.password,
          role: regData.role,
          location: {
              county: regData.county,
              district: regData.district,
              division: regData.division,
              locationName: regData.locationName,
              sublocation: regData.sublocation,
              village: regData.village
          }
      });
      setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg">
        <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center">
                <ScanLine className="w-10 h-10 text-white" />
            </div>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 text-center mb-2">Cattle Tracker</h1>
        <p className="text-slate-500 text-center mb-8">
            {isRegistering ? "Create your account" : "Secure Login"}
        </p>
        
        {isRegistering ? (
            <form onSubmit={handleRegister} className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar">
                <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Full Name</label>
                    <input required type="text" className="w-full p-2 border rounded" value={regData.name} onChange={e => setRegData({...regData, name: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Phone Number</label>
                    <input required type="tel" className="w-full p-2 border rounded" value={regData.phoneNumber} onChange={e => setRegData({...regData, phoneNumber: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Password</label>
                    <input required type="password" className="w-full p-2 border rounded" value={regData.password} onChange={e => setRegData({...regData, password: e.target.value})} />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">County</label>
                        <input required type="text" className="w-full p-2 border rounded" value={regData.county} onChange={e => setRegData({...regData, county: e.target.value})} />
                    </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">District</label>
                        <input required type="text" className="w-full p-2 border rounded" value={regData.district} onChange={e => setRegData({...regData, district: e.target.value})} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Division</label>
                        <input required type="text" className="w-full p-2 border rounded" value={regData.division} onChange={e => setRegData({...regData, division: e.target.value})} />
                    </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Location</label>
                        <input required type="text" className="w-full p-2 border rounded" value={regData.locationName} onChange={e => setRegData({...regData, locationName: e.target.value})} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Sub-Location</label>
                        <input required type="text" className="w-full p-2 border rounded" value={regData.sublocation} onChange={e => setRegData({...regData, sublocation: e.target.value})} />
                    </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Village</label>
                        <input required type="text" className="w-full p-2 border rounded" value={regData.village} onChange={e => setRegData({...regData, village: e.target.value})} />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Role</label>
                    <select className="w-full p-2 border rounded" value={regData.role} onChange={e => setRegData({...regData, role: e.target.value as UserRole})}>
                        <option value={UserRole.FARMER}>Farmer</option>
                        <option value={UserRole.BUTCHERY}>Butchery</option>
                        <option value={UserRole.AUTHORITY}>Authority</option>
                        <option value={UserRole.MARKET_AGENT}>Market Agent</option>
                    </select>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Registering...' : 'Register Account'}
                </Button>
                
                <p className="text-center text-sm text-slate-500 mt-2">
                    Already have an account? <span onClick={() => setIsRegistering(false)} className="text-primary font-bold cursor-pointer">Login</span>
                </p>
            </form>
        ) : (
            <form onSubmit={handleLogin} className="space-y-4">
                <div className="relative">
                    <UserIcon className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <input 
                        type="tel" 
                        required
                        placeholder="Phone Number" 
                        className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                    />
                </div>
                 <div className="relative">
                    <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <input 
                        type="password" 
                        required
                        placeholder="Password" 
                        className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>
                
                <Button type="submit" className="w-full py-3" disabled={loading}>
                    {loading ? 'Authenticating...' : 'Login'}
                </Button>

                <p className="text-center text-sm text-slate-500 mt-4">
                    New user? <span onClick={() => setIsRegistering(true)} className="text-primary font-bold cursor-pointer">Create Account</span>
                </p>
                <div className="mt-8 p-3 bg-blue-50 text-blue-700 rounded text-xs text-center">
                    <p className="font-bold">Demo Credentials:</p>
                    <p>Phone: 0712345678 / Pass: 123 (Farmer)</p>
                    <p>Phone: 0722222222 / Pass: 123 (Butchery)</p>
                </div>
            </form>
        )}
      </div>
    </div>
  );
};

const RegisterAnimalView: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
  const { registerAnimal, currentUser } = useStore();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<Animal>>({
    species: 'Cattle',
    serialNumber: `CAT-${Date.now()}`
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
    // Automatically move to final step or submit
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

const FarmerDashboard: React.FC = () => {
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

const AuthorityDashboard: React.FC = () => {
  const { alerts, animals, users } = useStore();
  const [riskAnalysis, setRiskAnalysis] = useState<string | null>(null);

  // Generate stats
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

const ButcheryDashboard: React.FC = () => {
    const { animals, currentUser, logSlaughter, users, transferToButchery } = useStore();
    const [selectedAnimalId, setSelectedAnimalId] = useState('');
    const [weights, setWeights] = useState({ live: 0, dead: 0, sold: 0 });
    const [mode, setMode] = useState<'SLAUGHTER' | 'TRANSFER'>('SLAUGHTER');
    
    // Transfer State
    const [transferData, setTransferData] = useState({ animalId: '', targetButcheryId: '', weight: 0 });

    const ownedAnimals = animals.filter(a => a.ownerId === currentUser?.id && a.status === AnimalStatus.ACTIVE);
    const otherButcheries = users.filter(u => u.role === UserRole.BUTCHERY && u.id !== currentUser?.id);

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

    const handleTransfer = () => {
      if(!currentUser || !transferData.animalId || !transferData.targetButcheryId) return;
      
      transferToButchery(transferData.animalId, currentUser.id, transferData.targetButcheryId, transferData.weight);
      alert("Transferred successfully!");
      setTransferData({ animalId: '', targetButcheryId: '', weight: 0 });
    };

    return (
        <div className="p-4 space-y-6 pb-20">
            <header>
                <h1 className="text-2xl font-bold">Butchery Panel</h1>
                <p className="text-slate-500">Log Slaughters & Transfers</p>
            </header>

            <div className="flex gap-2">
              <Button 
                onClick={() => setMode('SLAUGHTER')} 
                variant={mode === 'SLAUGHTER' ? 'primary' : 'outline'}
                className="flex-1"
              >
                Slaughter
              </Button>
              <Button 
                onClick={() => setMode('TRANSFER')} 
                variant={mode === 'TRANSFER' ? 'primary' : 'outline'}
                className="flex-1"
              >
                Transfer
              </Button>
            </div>

            {mode === 'SLAUGHTER' ? (
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
            ) : (
              <Card>
                <h3 className="font-bold mb-4 flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-accent" /> Butchery-to-Butchery Transfer
                </h3>
                <div className="space-y-4">
                   <div>
                        <label className="block text-sm font-medium mb-1">Select Animal</label>
                        <select 
                            className="w-full p-2 border rounded-lg bg-slate-50"
                            value={transferData.animalId}
                            onChange={(e) => setTransferData({...transferData, animalId: e.target.value})}
                        >
                            <option value="">-- Select Animal --</option>
                            {ownedAnimals.map(a => (
                                <option key={a.id} value={a.id}>{a.serialNumber} - {a.species}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Target Butchery</label>
                        <select 
                            className="w-full p-2 border rounded-lg bg-slate-50"
                            value={transferData.targetButcheryId}
                            onChange={(e) => setTransferData({...transferData, targetButcheryId: e.target.value})}
                        >
                            <option value="">-- Select Butchery --</option>
                            {otherButcheries.map(u => (
                                <option key={u.id} value={u.id}>{u.name} ({u.location.locationName})</option>
                            ))}
                        </select>
                    </div>

                    <div>
                          <label className="block text-xs font-medium text-slate-500">Transferred Weight (kg)</label>
                          <input type="number" className="w-full p-2 border rounded" value={transferData.weight} onChange={e => setTransferData({...transferData, weight: Number(e.target.value)})} />
                    </div>

                    <Button className="w-full" onClick={handleTransfer} disabled={!transferData.animalId || !transferData.targetButcheryId}>Transfer Stock</Button>
                </div>
              </Card>
            )}
        </div>
    );
}

// --- MAIN LAYOUT & ROUTING ---

const AppContent: React.FC = () => {
  const { currentUser, alerts, logout } = useStore();
  const [currentTab, setCurrentTab] = useState('DASHBOARD');

  // Global Alert Banner
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
      {/* Alert Banner */}
      {stolenAlerts.length > 0 && (
        <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-between text-sm font-medium shadow-md">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 animate-pulse" />
            <span>{stolenAlerts.length} Active Stolen Animal Reports</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-md mx-auto min-h-screen bg-white shadow-2xl overflow-hidden relative">
        {renderView()}

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-3 px-6 flex justify-between items-center z-50 max-w-md mx-auto shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button onClick={() => setCurrentTab('DASHBOARD')} className={`${currentTab === 'DASHBOARD' ? 'text-primary' : 'text-slate-400'} flex flex-col items-center gap-1`}>
            <UserIcon className="w-6 h-6" />
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

const App: React.FC = () => {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
};

export default App;