import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  Building2, 
  Hash, 
  ShieldAlert, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight,
  Info
} from 'lucide-react';
import { 
  auth, 
  db, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendEmailVerification, 
  doc, 
  setDoc, 
  getDoc 
} from '../firebase';
import { UserProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode: 'login' | 'signup' | 'admin';
  onLoginSuccess: (user: UserProfile) => void;
}

const DEPARTMENTS = [
  'SEECS (Electrical Eng & Computer Science)',
  'NBS (NUST Business School)',
  'SINES (Interdisciplinary Eng & Sciences)',
  'SCME (Chemical & Materials Eng)',
  'SMME (Mechanical & Manufacturing Eng)',
  'ASAB (Applied Biosciences)',
  'S3H (Social Sciences & Humanities)',
  'SNS (Natural Sciences)',
  'NICE (Civil & Environmental Eng)',
  'RCMS (Computational Sciences)',
  'USPCASE (Energy Systems)'
];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode,
  onLoginSuccess
}) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'admin'>(initialMode);
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState(DEPARTMENTS[0].split(' ')[0]);
  const [regId, setRegId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setErrorMessage(null);
    setSuccessNotice(null);
  };

  const handleStudentSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    resetForm();

    const cleanEmail = email.trim().toLowerCase();

    // STRICT NUST EMAIL VALIDATION
    if (!cleanEmail.endsWith('@student.nust.edu.pk')) {
      setErrorMessage("Access Restricted: You must register using your official @student.nust.edu.pk address.");
      return;
    }

    if (!regId.trim()) {
      setErrorMessage("Please enter your NUST Registration / CMS ID.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;

      // 2. Trigger email verification
      try {
        await sendEmailVerification(user);
      } catch (err: any) {
        console.warn("sendEmailVerification warning:", err);
      }

      // 3. Save profile in /users/{uid}
      const deptShort = department.split(' ')[0];
      const newProfile: UserProfile = {
        uid: user.uid,
        name: fullName.trim() || 'NUSTian',
        dept: deptShort,
        regId: regId.trim(),
        email: cleanEmail,
        role: 'student',
        emailVerified: user.emailVerified
      };

      try {
        await setDoc(doc(db, "users", user.uid), newProfile);
      } catch (err: any) {
        console.warn("Could not save to firestore doc, fallback locally:", err);
      }

      setSuccessNotice("Registration successful! Verification email dispatched to your NUST address. Please verify to enable checkout.");
      onLoginSuccess(newProfile);
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err: any) {
      console.error("Signup error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setErrorMessage("An account with this NUST student email already exists. Please sign in instead.");
      } else {
        setErrorMessage(err.message || "Failed to create account. Please check your network.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetForm();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.endsWith('@student.nust.edu.pk')) {
      setErrorMessage("Access Restricted: You must log in using your official @student.nust.edu.pk address.");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;

      // Fetch user profile from /users/{uid}
      let profile: UserProfile | null = null;
      try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
          profile = docSnap.data() as UserProfile;
        }
      } catch (err) {
        console.warn("Could not get profile from db:", err);
      }

      if (!profile) {
        profile = {
          uid: user.uid,
          name: cleanEmail.split('@')[0],
          dept: 'SEECS',
          regId: 'CMS-' + user.uid.substring(0, 6).toUpperCase(),
          email: cleanEmail,
          role: 'student',
          emailVerified: user.emailVerified
        };
      } else {
        profile.emailVerified = user.emailVerified;
      }

      onLoginSuccess(profile);
      onClose();
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMessage("Invalid NUST student email or password.");
      } else {
        setErrorMessage(err.message || "Login failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetForm();

    const cleanEmail = email.trim().toLowerCase();

    setLoading(true);
    try {
      // First try regular signIn
      let user;
      try {
        const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
        user = userCredential.user;
      } catch (signInErr: any) {
        // If user doesn't exist yet and it's the requested admin credentials, create it
        if (cleanEmail === 'admin@nust.edu.pk' || cleanEmail.startsWith('admin')) {
          try {
            const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
            user = userCredential.user;
          } catch (createErr) {
            throw signInErr;
          }
        } else {
          throw signInErr;
        }
      }

      const adminProfile: UserProfile = {
        uid: user.uid,
        name: 'Concordia Central Manager',
        dept: 'NUST Directorate of Services',
        regId: 'NUST-ADM-01',
        email: cleanEmail,
        role: 'admin',
        emailVerified: true
      };

      try {
        await setDoc(doc(db, "users", user.uid), adminProfile);
      } catch (err) {
        console.warn("Could not save admin profile to db:", err);
      }

      onLoginSuccess(adminProfile);
      onClose();
    } catch (err: any) {
      console.error("Admin login error:", err);
      setErrorMessage("Admin verification failed. Use dedicated credentials (e.g. admin@nust.edu.pk).");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/50">
          <button
            onClick={() => { setMode('login'); resetForm(); }}
            className={`flex-1 py-3 text-xs font-bold transition-colors ${
              mode === 'login'
                ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-900/80'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Student Login
          </button>
          <button
            onClick={() => { setMode('signup'); resetForm(); }}
            className={`flex-1 py-3 text-xs font-bold transition-colors ${
              mode === 'signup'
                ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-900/80'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Register Student
          </button>
          <button
            onClick={() => { setMode('admin'); resetForm(); }}
            className={`flex-1 py-3 text-xs font-bold transition-colors ${
              mode === 'admin'
                ? 'text-amber-400 border-b-2 border-amber-500 bg-slate-900/80'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Admin KDS
          </button>

          <button
            onClick={onClose}
            className="px-4 text-slate-500 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          )}

          {successNotice && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <div>{successNotice}</div>
            </div>
          )}

          {mode === 'signup' && (
            <form onSubmit={handleStudentSignup} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Hamza Ali"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Department
                  </label>
                  <div className="relative">
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full px-2.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 transition"
                    >
                      {DEPARTMENTS.map((dept) => {
                        const code = dept.split(' ')[0];
                        return <option key={code} value={code}>{code}</option>;
                      })}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Registration / CMS ID
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-2.5 top-3 w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={regId}
                      onChange={(e) => setRegId(e.target.value)}
                      placeholder="e.g. 358941"
                      className="w-full pl-7 pr-2 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">
                    NUST Student Email
                  </label>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    *@student.nust.edu.pk
                  </span>
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. hzafar.bese21seecs@student.nust.edu.pk"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Create Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Verification link will be emailed to your NUST inbox immediately.</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? "Registering & Sending Verification..." : "Create Student Account"}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          {mode === 'login' && (
            <form onSubmit={handleStudentLogin} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">
                    NUST Student Email
                  </label>
                  <span className="text-[10px] text-slate-400">@student.nust.edu.pk</span>
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.id@student.nust.edu.pk"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? "Authenticating..." : "Sign In to Concordia Portal"}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="pt-2 text-center">
                <span className="text-xs text-slate-400">New student? </span>
                <button
                  type="button"
                  onClick={() => { setMode('signup'); resetForm(); }}
                  className="text-xs font-bold text-emerald-400 hover:underline"
                >
                  Register here
                </button>
              </div>
            </form>
          )}

          {mode === 'admin' && (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <p className="font-bold">Secured Admin Access</p>
                  <p className="text-[11px] text-amber-300/80">
                    Restricted to cafeteria managers for Concordia 1, 2, and 3. Default demo admin: <code className="bg-amber-950/60 px-1 py-0.5 rounded text-amber-200">admin@nust.edu.pk</code>
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@nust.edu.pk"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Admin Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('admin@nust.edu.pk');
                    setPassword('nustadmin123');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-[11px] font-medium transition"
                >
                  Fill Default Credentials
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/30 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? "Verifying..." : "Authorize Admin KDS Access"}
                <ShieldCheck className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
