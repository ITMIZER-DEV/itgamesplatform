import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { ThemedToaster } from '@/components/layout/ThemedToaster';

export const metadata: Metadata = {
  title: 'ITGames Arena • Plataforma de Competições de CrossFit & HYROX',
  description: 'Sistema completo para gestão de competições fitness: Súmulas Inteligentes A4/PDF, Baterias & Raias, App do Juiz Offline e Live Leaderboard.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Aplica o tema salvo (ou a preferência do sistema) antes da primeira pintura */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('itgames_theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}})();` }} />
      </head>
      <body className="bg-[var(--background)] text-[var(--foreground)] min-h-screen flex flex-col antialiased">
        <Navbar />
        <main className="flex-1 pb-24 lg:pb-0">
          {children}
        </main>
        <footer className="border-t border-zinc-800 py-5 text-center text-xs text-zinc-500 no-print">
          <div className="max-w-7xl mx-auto px-4">
            ITGames Arena © {new Date().getFullYear()}
          </div>
        </footer>
        <ThemedToaster />
      </body>
    </html>
  );
}
