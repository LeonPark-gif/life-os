import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    componentName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 m-4 bg-red-900/50 border border-red-500 rounded-lg text-white backdrop-blur-md">
                    <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                        ⚠️ Absturz in {this.props.componentName || 'Komponente'}
                    </h2>
                    <p className="text-sm opacity-80 mb-4">
                        Ein unerwarteter Fehler ist aufgetreten.
                    </p>
                    <details className="text-xs font-mono bg-black/50 p-2 rounded overflow-auto max-h-48">
                        <summary className="cursor-pointer font-bold text-red-300">Fehler Details anzeigen</summary>
                        <div className="mt-2 whitespace-pre-wrap text-red-200">
                            {this.state.error && this.state.error.toString()}
                        </div>
                        <div className="mt-2 opacity-50">
                            {this.state.errorInfo?.componentStack}
                        </div>
                    </details>
                    <button
                        className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-sm transition-colors"
                        onClick={() => {
                            localStorage.clear();
                            window.location.reload();
                        }}
                    >
                        App zurücksetzen (Daten löschen)
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
