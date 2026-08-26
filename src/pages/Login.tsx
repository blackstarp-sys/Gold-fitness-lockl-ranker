import React from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';

export default function Login() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);

  if (loading) return null;
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async () => {
    setIsAuthenticating(true);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential && credential.accessToken) {
        // Send tokens to backend to save for server-side tasks
        await apiFetch('/api/auth/google-tokens', {
          method: 'POST',
          body: JSON.stringify({
            access_token: credential.accessToken,
            // Google auth provider on client doesn't return refresh token by default unless setup properly,
            // but we can send what we have.
            expires_in: 3600 
          })
        }).catch(console.error);
      }

      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Failed to log in', err);
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="bg-card p-10 rounded-[2.5rem] border border-border max-w-sm w-full text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-bl-[100px] pointer-events-none" />
        
        <div className="w-16 h-16 bg-card-nested border border-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-primary shadow-[0_0_15px_rgba(114,87,245,0.2)]">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-white mb-2 tracking-tight">Dhanus Gold Fitness</h1>
        <p className="text-sm text-muted mb-8 font-medium">Sign in to access your Local Ranker AI dashboard.</p>
        
        <button 
          onClick={handleLogin}
          disabled={isAuthenticating}
          className="w-full flex items-center justify-center gap-3 bg-primary hover:bg-primary/90 text-white disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 rounded-xl font-bold transition-all shadow-lg shadow-primary/20"
        >
          {isAuthenticating ? (
            <Loader2 className="w-5 h-5 animate-spin text-white" />
          ) : (
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 brightness-0 invert" />
          )}
          {isAuthenticating ? 'Authenticating...' : 'Continue with Google'}
        </button>
      </div>
    </div>
  );
}
