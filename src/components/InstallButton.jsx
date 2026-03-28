import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

export default function InstallButton({ inline = false }) {
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
      className="fixed bottom-0 right-0 z-[9999] bg-kinetic-neon text-kinetic-black w-14 h-14 md:w-16 md:h-16 rounded-tl-2xl flex flex-col items-center justify-center shadow-[-5px_-5px_15px_rgba(0,0,0,0.3)] hover:bg-kinetic-white transition-colors cursor-pointer"
      title="Baixar App KINETIC"
    >
      <Download className="w-6 h-6 md:w-7 md:h-7" />
    </button>
  );
}
