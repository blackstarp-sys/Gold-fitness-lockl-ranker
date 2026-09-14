import React from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { auth } from '../lib/firebase.ts';
import firebaseConfig from '../../firebase-applet-config.json';
import { useAuth } from '../context/AuthContext.tsx';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: any) => void;
          renderButton: (
            element: HTMLElement,
            options: any
          ) => void;
          cancel: () => void;
        };
      };
    };
  }
}

export default function Login() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const googleButtonRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const clientId = (firebaseConfig as any).oAuthClientId;

    if (!clientId) {
      setLoginError('Google OAuth client ID is not configured.');
      return;
    }

    let isMounted = true;

    const renderGoogleButton = () => {
      if (!isMounted) return;
      if (!window.google?.accounts?.id || !googleButtonRef.current) {
        window.setTimeout(renderGoogleButton, 200);
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        cancel_on_tap_outside: true,
        callback: async (response: { credential?: string }) => {
          try {
            setIsAuthenticating(true);
            setLoginError(null);

            if (!response?.credential) {
              throw new Error('Google did not return an ID token.');
            }

            const firebaseCredential =
              GoogleAuthProvider.credential(response.credential);

            const result = await signInWithCredential(
              auth,
              firebaseCredential
            );

            const authenticatedEmail =
              result.user.email?.trim().toLowerCase();

            if (authenticatedEmail !== 'dhanusgoldfitness@gmail.com') {
              await auth.signOut();
              throw new Error(
                'Please sign in using dhanusgoldfitness@gmail.com'
              );
            }

            navigate('/dashboard', { replace: true });
          } catch (error: any) {
            setLoginError(
              error?.message || 'Google authentication failed.'
            );
          } finally {
            if (isMounted) {
              setIsAuthenticating(false);
            }
          }
        }
      });

      if (googleButtonRef.current) {
        googleButtonRef.current.innerHTML = '';

        window.google.accounts.id.renderButton(
          googleButtonRef.current,
          {
            type: 'standard',
            theme: 'filled_blue',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            width: 320
          }
        );
      }
    };

    renderGoogleButton();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  if (loading) return null;
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="bg-card p-10 rounded-[2.5rem] border border-border max-w-sm w-full text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-bl-[100px] pointer-events-none" />
        
        <div className="w-16 h-16 bg-card-nested border border-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-primary shadow-[0_0_15px_rgba(114,87,245,0.2)]">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-white mb-2 tracking-tight">Dhanus Gold Fitness</h1>
        <p className="text-sm text-muted mb-6 font-medium">Sign in to access your Local Ranker AI dashboard.</p>
        
        {loginError && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs text-left flex items-start gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{loginError}</div>
          </div>
        )}

        <div className="flex flex-col items-center justify-center min-h-[44px]">
          {isAuthenticating && (
            <div className="flex items-center gap-2 mb-3 text-xs font-bold text-primary">
              <Loader2 className="w-4 h-4 animate-spin" />
              Authenticating session with Firebase...
            </div>
          )}
          <div ref={googleButtonRef} className={isAuthenticating ? 'opacity-50 pointer-events-none' : ''} />
        </div>
      </div>
    </div>
  );
}
