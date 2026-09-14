import { auth } from './firebase.ts';
import { notifyApiError, notifyApiSuccess } from '../context/ToastContext.tsx';

export interface ApiFetchOptions extends RequestInit {
  showSuccessToast?: boolean;
  successMessage?: string;
  suppressErrorToast?: boolean;
  optionalAuth?: boolean;
}

async function getToken(required = true) {
  if (auth.authStateReady) {
    await auth.authStateReady();
  }
  const user = auth.currentUser;
  if (!user) {
    if (!required) return null;
    const error: any = new Error('Authentication required');
    error.status = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }
  return user.getIdToken();
}

export async function apiFetch<T = any>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  let status: number | undefined;

  try {
    const token = await getToken(!options.optionalAuth);
    
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(path, {
      ...options,
      headers
    });

    status = response.status;
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(
        data?.message ||
        data?.error ||
        `Request failed: ${response.status}`
      ) as Error & {
        status?: number;
        code?: string;
        googleError?: any;
        details?: any;
      };

      error.status = response.status;
      error.code = data?.code || data?.error_code || (response.status === 401 ? 'UNAUTHORIZED' : (response.status === 403 ? 'GOOGLE_API_FORBIDDEN' : undefined));
      error.googleError = data?.googleError || null;
      error.details = data?.details || null;

      console.error('[API FETCH FAILED]', {
        method,
        pathname: path,
        baseUrl,
        errorName: error.name,
        errorMessage: error.message
      });

      throw error;
    }

    // Trigger success notification toast on state-changing requests or explicitly requested toasts
    if (method !== 'GET' || options.showSuccessToast) {
      notifyApiSuccess({
        method,
        pathname: path,
        message: data?.message || options.successMessage || `Action completed successfully`
      });
    }

    return data as T;
  } catch (err: any) {
    console.error('[API FETCH FAILED]', {
      method,
      pathname: path,
      baseUrl,
      errorName: err?.name || 'Error',
      errorMessage: err?.message || String(err)
    });

    if (!options.suppressErrorToast) {
      notifyApiError({
        method,
        pathname: path,
        message: err?.message || 'Failed to fetch',
        status: err?.status || status
      });
    }

    throw err;
  }
}
