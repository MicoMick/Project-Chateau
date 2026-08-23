import React, { useEffect, useState } from 'react';
import ChataueLogo from '../assets/ChataueLogo.png';

const SplashScreen = ({ duration = 2200, onFinish }) => {
  const [visible, setVisible] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const startFade = setTimeout(() => setFadingOut(true), duration);
    const remove = setTimeout(() => {
      setVisible(false);
      onFinish?.();
    }, duration + 400);

    return () => {
      clearTimeout(startFade);
      clearTimeout(remove);
    };
  }, [duration, onFinish]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900 transition-opacity duration-400 ease-out ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center gap-6 animate-[splash-in_0.6s_ease-out]">
        <img
          src={ChataueLogo}
          alt="Chateau"
          className="w-24 h-24 object-contain drop-shadow-[0_0_25px_rgba(0,104,55,0.45)]"
        />
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-wide text-white">Chateau Real</h1>
          <p className="text-sm text-slate-400 mt-1">Loading your community…</p>
        </div>
        <div className="w-10 h-10 border-4 border-[#006837]/20 border-t-[#006837] rounded-full animate-spin" />
      </div>

      <style>{`
        @keyframes splash-in {
          from { opacity: 0; transform: translateY(8px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
