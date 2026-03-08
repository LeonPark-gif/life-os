import type { ReactNode } from 'react';
import ParticleBackground from '../components/ParticleBackground';
import ErrorBoundary from '../components/ErrorBoundary';

interface Props {
    children: ReactNode;
}

export default function GlassLayout({ children }: Props) {
    return (
        <div className="relative h-screen w-full text-white overflow-hidden font-sans">
            <ErrorBoundary>
                <ParticleBackground />
            </ErrorBoundary>

            {/* Main Content Overlay */}
            <main className="relative z-10 w-full h-full p-4 md:p-8 flex flex-col gap-6 max-h-screen overflow-hidden">
                <header className="flex justify-between items-center backdrop-blur-xs bg-glass rounded-2xl p-4 border border-glassBorder shadow-lg">
                    <h1 className="text-2xl font-bold tracking-tighter bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        DASILVA OS
                    </h1>
                    <div className="flex gap-2 text-sm text-gray-300">
                        <span>{new Date().toLocaleDateString('de-DE')}</span>
                    </div>
                </header>

                <section className="flex-1 flex flex-col md:flex-row gap-6">
                    {children}
                </section>
            </main>
        </div>
    );
}
