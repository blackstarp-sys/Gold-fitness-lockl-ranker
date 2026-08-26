import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 bg-rose-50 rounded-xl border border-rose-200 m-8">
          <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
          <h2 className="text-lg font-bold text-slate-900 mb-2">Something went wrong</h2>
          <p className="text-slate-600 text-sm mb-4">We encountered an unexpected error displaying this component.</p>
          <pre className="text-xs bg-white p-4 rounded border border-rose-100 text-rose-600 max-w-full overflow-auto">
            {this.state.error?.message}
          </pre>
          <button
            // @ts-ignore
            onClick={() => this.setState({ hasError: false })}
            className="mt-6 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700"
          >
            Try Again
          </button>
        </div>
      );
    }

    // @ts-ignore
    return this.props.children;
  }
}
