import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
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
                <div className="p-4 bg-red-900/80 text-white rounded-lg border border-red-500 m-4 z-50 relative">
                    <h2 className="text-xl font-bold mb-2">💥 Crash detected</h2>
                    <pre className="text-xs font-mono overflow-auto max-h-40 bg-black/50 p-2 rounded">
                        {this.state.error?.toString()}
                    </pre>
                    <button
                        className="mt-4 px-4 py-2 bg-red-600 rounded hover:bg-red-500"
                        onClick={() => {
                            localStorage.clear();
                            window.location.reload();
                        }}
                    >
                        Clear Data & Reload
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
