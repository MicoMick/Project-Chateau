import React from 'react';
import { MapPin, Facebook, ArrowUp } from 'lucide-react';
import ChateauLogo from '../../assets/ChataueLogo.png';

const Footer = () => {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const links = [
    { label: 'Our Team',    id: 'team'         },
    { label: 'How It Works',id: 'how-it-works' },
    { label: 'About Us',    id: 'about'        },
    { label: 'Download App',id: 'download'     },
    { label: "FAQ's",       id: 'faqs'         },
  ];

  const scrollToSection = (id) => (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#006837] text-white relative overflow-hidden">

      {/* Top edge decoration */}
      <div className="h-1 bg-gradient-to-r from-[#004d29] via-[#FFF200] to-[#004d29]" />

      {/* Background glow */}
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#FFF200]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-6 lg:px-16 py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">

          {/* Brand */}
          <div className="flex flex-col gap-4 reveal reveal-left">
            <img src={ChateauLogo} alt="Chateau Real" className="h-25 w-auto object-contain" />
            <p className="text-white/50 text-xs tracking-[0.2em] uppercase font-bold pl-1">
              Metropolis Greens
            </p>
            <p className="text-white/60 text-sm leading-relaxed max-w-xs">
              "Your trusted homeowners association building a safer, more connected way of community living."
            </p>
          </div>

          {/* Quick links */}
          <div className="reveal reveal-delay-1">
            <h3 className="font-black text-base mb-5 text-[#FFF200] uppercase tracking-widest text-xs">Quick Links</h3>
            <ul className="space-y-3">
              {links.map(l => (
                <li key={l.label}>
                  <a href={`#${l.id}`} onClick={scrollToSection(l.id)}
                    className="text-white/70 hover:text-[#FFF200] transition-colors duration-200 text-sm font-medium flex items-center gap-2 group">
                    <span className="w-0 group-hover:w-3 h-px bg-[#FFF200] transition-all duration-200 rounded" />
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="reveal reveal-delay-2">
            <h3 className="font-black text-base mb-5 text-[#FFF200] uppercase tracking-widest text-xs">Contact Us</h3>
            <div className="space-y-4">
              <a href="https://www.facebook.com/share/g/1EB3Q4yPB6/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 text-white/70 hover:text-white transition-colors group">
                <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center group-hover:bg-[#1877F2]/20 transition-colors">
                  <Facebook size={16} className="text-[#FFF200]" />
                </div>
                <span className="text-sm font-medium">Chateau Real Facebook Page</span>
              </a>
              <div className="flex items-start gap-3 text-white/70">
                <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin size={16} className="text-[#FFF200]" />
                </div>
                <span className="text-sm font-medium leading-relaxed">
                  Metropolis Dr, Manggahan,<br />General Trias, Cavite
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-8 flex reveal reveal-delay-3 flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/40 text-sm">© 2026 CHATEAU REAL. All rights reserved.</p>
          <button onClick={scrollToTop}
            className="group flex items-center gap-2 text-white/50 hover:text-[#FFF200] transition-all duration-300 cursor-pointer">
            <span className="text-xs font-bold uppercase tracking-widest">Back to top</span>
            <div className="w-8 h-8 border border-white/10 rounded-xl flex items-center justify-center group-hover:border-[#FFF200] group-hover:bg-[#FFF200]/10 group-hover:-translate-y-1 transition-all">
              <ArrowUp size={15} />
            </div>
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
