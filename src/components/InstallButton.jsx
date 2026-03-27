import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Impede o mini-infobar automático do Chrome
      e.preventDefault();
      // Armazena o evento para o botão disparar
      setDeferredPrompt(e);
      // Habilita a view do botão
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Opcional: ouvir se app foi instalado e esconder o botão
    window.addEventListener('appinstalled', () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert('⚠️ O download do App não está disponível no momento.\n\nIsso geralmente acontece se você estiver numa Guia Anônima (Incógnita) ou se o app já estiver instalado. Abra numa aba normal do seu celular ou PC para instalar!');
      return;
    }
    
    // Mostra o prompt nativo de instalação
    deferredPrompt.prompt();
    
    // Aguarda a escolha do usuário
    const { outcome } = await deferredPrompt.userChoice;
    
    // Independente do que escolheu
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  return (
    <button
      onClick={handleInstallClick}
      className="fixed bottom-6 right-6 z-[9999] bg-kinetic-neon text-kinetic-black w-16 h-16 rounded-full flex flex-col items-center justify-center shadow-[0_0_20px_rgba(204,255,0,0.5)] hover:scale-105 hover:bg-kinetic-white transition-all cursor-pointer animate-bounce"
      title="Baixar App KINETIC"
    >
      <Download className="w-7 h-7" />
    </button>
  );
}
