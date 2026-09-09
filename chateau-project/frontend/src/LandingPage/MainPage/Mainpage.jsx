import React, { useEffect, useState } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import ChateauGate from '../../assets/Chateau_Gate.jpg';

const Mainpage = () => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 100); return () => clearTimeout(t); }, []);

  // ── Global scroll-reveal observer ──────────────────────────────────────────
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          obs.unobserve(e.target);
        }
      }),
      { threshold: 0.12 }
    );
    // Observe all .reveal elements across the whole page
    const observe = () => document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
    observe();
    // Re-run after a tick to catch late-rendered sections
    const t = setTimeout(observe, 300);
    return () => { obs.disconnect(); clearTimeout(t); };
  }, []);



  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden">
      <style>{`
        .hero-fade-up {
          opacity: 0;
          transform: translateY(32px);
          transition: opacity 0.9s ease, transform 0.9s ease;
        }
        .hero-fade-up.visible { opacity: 1; transform: translateY(0); }

        /* ─── Global scroll-reveal utilities ─── */
        .reveal {
          opacity: 0;
          transform: translateY(32px);
          transition: opacity 0.7s cubic-bezier(.22,.68,0,1), transform 0.7s cubic-bezier(.22,.68,0,1);
        }
        .reveal.reveal-left  { transform: translateX(-32px); }
        .reveal.reveal-right { transform: translateX( 32px); }
        .reveal.reveal-scale { transform: scale(0.92); }
        .reveal.is-visible {
          opacity: 1;
          transform: translateY(0) translateX(0) scale(1);
        }
        .reveal-delay-1 { transition-delay: 100ms; }
        .reveal-delay-2 { transition-delay: 200ms; }
        .reveal-delay-3 { transition-delay: 300ms; }
        .reveal-delay-4 { transition-delay: 400ms; }
      `}</style>

      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img src={ChateauGate} alt="Chateau Gate"
          className="w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/80" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 text-center flex flex-col items-center">

        {/* Floating badge */}
        <div className={`hero-fade-up ${visible ? 'visible' : ''} inline-flex items-center gap-2.5 px-5 py-2.5 text-xs font-bold text-white mb-8 tracking-widest uppercase [text-shadow:0_1px_6px_rgba(0,0,0,0.85)]`}
          style={{ transitionDelay: '0ms' }}>
          Chateau Real Executive Village — CREVHAI
        </div>

        {/* Headline */}
        <h1 className={`hero-fade-up ${visible ? 'visible' : ''} text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.92] mb-6 text-white`}
          style={{ transitionDelay: '150ms' }}>
          <span className="block mb-2">Welcome to</span>
          <span className="block text-[#006837]">
            Chateau Real
          </span>
        </h1>

        {/* Subtitle */}
        <p className={`hero-fade-up ${visible ? 'visible' : ''} max-w-2xl text-white/75 text-base md:text-lg leading-relaxed mb-10 text-center`}
          style={{ transitionDelay: '300ms' }}>
          "A modern HOA management system that simplifies operations and strengthens community trust."
          "Handle dues, service requests, and community announcements in one trusted platform, built for Chateau Real Executive Village."
        </p>

        {/* CTAs */}
        <div className={`hero-fade-up ${visible ? 'visible' : ''} flex flex-col sm:flex-row items-center gap-4`}
          style={{ transitionDelay: '450ms' }}>
          <a href="#download" onClick={(e) => { e.preventDefault(); document.getElementById('download')?.scrollIntoView({ behavior: 'smooth' }); }}>
            <button className="flex items-center gap-3 px-8 py-4 bg-[#006837] hover:bg-[#004d29] text-white font-bold rounded-2xl transition-all duration-200 shadow-md shadow-black/30 hover:-translate-y-1 cursor-pointer">
              <Download size={18} />
              Download Mobile App
            </button>
          </a>
          <a href="#about" onClick={(e) => { e.preventDefault(); document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' }); }}>
            <button className="flex items-center gap-3 px-8 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-semibold rounded-2xl transition-all duration-200 hover:-translate-y-1 cursor-pointer">
              Learn More
            </button>
          </a>
        </div>
      </div>

      {/* Scroll-down indicator */}
      <a href="#team" onClick={(e) => { e.preventDefault(); document.getElementById('team')?.scrollIntoView({ behavior: 'smooth' }); }}
        aria-label="Scroll to next section"
        className={`hero-fade-up ${visible ? 'visible' : ''} absolute bottom-8 left-1/2 -translate-x-1/2 z-10 w-11 h-11 flex items-center justify-center rounded-full border border-white/30 text-white/80 hover:text-white hover:border-white/60 transition-colors duration-200 cursor-pointer animate-bounce`}
        style={{ transitionDelay: '600ms' }}>
        <ChevronDown size={22} />
      </a>
    </div>
  );
};

export default Mainpage;
