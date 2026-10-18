import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, LogIn } from 'lucide-react';
import ChateauLogo from '../../assets/ChataueLogo.png';

// ─── Restricted-area notice ─────────────────────────────────────────────────
// Shown whenever "Log In" is clicked from the public landing page — the app
// has no way to know yet whether whoever clicked is an actual HOA officer or
// a curious resident, so this is a gentle heads-up to both: officers know
// their credentials and just click through, while a resident who wandered in
// out of curiosity gets told plainly that this isn't for them before they
// even reach the login form. Typing /admin directly in the address bar skips
// this entirely, same as before — this only gates the landing page's own
// button, not the route itself.
const LoginNoticeModal = ({ onClose, onContinue }) => (
  <div className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    onClick={onClose}>
    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7 animate-in zoom-in-95 duration-200"
      onClick={e => e.stopPropagation()}>
      <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
        <ShieldAlert size={26} className="text-amber-600" />
      </div>
      <h3 className="text-lg font-black text-slate-900 mb-2">Restricted Area</h3>
      <p className="text-sm text-slate-500 leading-relaxed mb-6">
        This page is restricted, only HOA officers have the right to access it.
        If you're a resident, there's nothing here for you; please use the CHATEAU mobile app instead.
      </p>
      <div className="flex gap-3">
        <button onClick={onClose}
          className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm cursor-pointer transition-all">
          Cancel
        </button>
        <button onClick={onContinue}
          className="flex-1 py-3 rounded-2xl bg-[#006837] hover:bg-[#004d29] text-white font-bold text-sm shadow-lg shadow-[#006837]/20 cursor-pointer transition-all">
          Continue
        </button>
      </div>
    </div>
  </div>
);

const Header = () => {
  const navigate = useNavigate();
  const [isOpen,   setIsOpen]   = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showLoginNotice, setShowLoginNotice] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const navLinks = [
    { name: 'Our Team',     id: 'team'         },
    { name: 'How it Works', id: 'how-it-works' },
    { name: 'About Us',     id: 'about'        },
    { name: 'Download',     id: 'download'     },
    { name: 'FAQ',          id: 'faqs'         },
  ];

  const scrollToSection = (id) => (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <style>{`
        .nav-underline { position:relative; padding-bottom:4px; }
        .nav-underline::after {
          content:''; position:absolute; bottom:0; left:0;
          width:0; height:2px; background:#FFF200; border-radius:2px;
          transition:width .3s ease;
        }
        .nav-underline:hover::after { width:100%; }
      `}</style>

      <nav className={`fixed w-full z-50 transition-all duration-500
        ${scrolled || isOpen
          ? 'bg-[#006837]/96 backdrop-blur-xl shadow-2xl shadow-black/20 py-2'
          : 'bg-transparent py-5'}`}>

        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex justify-between items-center">

            <a href="/" className="flex-shrink-0 group">
              <img src={ChateauLogo} alt="Chateau Real"
                className="h-14 md:h-16 w-auto object-contain group-hover:scale-105 transition-transform duration-300" />
            </a>

            {/* Desktop */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map(l => (
                <a key={l.name} href={`#${l.id}`} onClick={scrollToSection(l.id)}
                  className="nav-underline text-white/90 hover:text-[#FFF200] text-sm font-semibold tracking-wide transition-colors duration-200">
                  {l.name}
                </a>
              ))}
              <a href="#download" onClick={scrollToSection('download')}
                className="ml-2 px-5 py-2.5 bg-[#006837] hover:bg-[#004d29] text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-black/30 hover:-translate-y-0.5">
                Get the App
              </a>
              {/* HOA officers' entry point — still just a shortcut to /admin,
                  the direct URL keeps working exactly as before. Gated behind
                  LoginNoticeModal since anyone can see this button, not just
                  officers. */}
              <button onClick={() => setShowLoginNotice(true)}
                className="flex items-center gap-1.5 px-5 py-2.5 border border-white/30 hover:border-[#FFF200] text-white hover:text-[#FFF200] rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer">
                <LogIn size={16} /> Log In
              </button>
            </div>

            {/* Mobile burger */}
            <button onClick={() => setIsOpen(v => !v)}
              className="md:hidden w-10 h-10 flex flex-col items-center justify-center gap-[5px] cursor-pointer">
              <span className={`block w-6 h-0.5 bg-white rounded transition-all duration-300 origin-center ${isOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
              <span className={`block w-6 h-0.5 bg-white rounded transition-all duration-200 ${isOpen ? 'opacity-0 scale-x-0' : ''}`} />
              <span className={`block w-6 h-0.5 bg-white rounded transition-all duration-300 origin-center ${isOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[30rem] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="bg-[#004d25]/98 backdrop-blur-xl border-t border-white/10 px-6 py-5 space-y-1">
            {navLinks.map(l => (
              <a key={l.name} href={`#${l.id}`} onClick={(e) => { scrollToSection(l.id)(e); setIsOpen(false); }}
                className="flex items-center px-3 py-3 text-white/90 hover:text-[#FFF200] hover:bg-white/5 rounded-xl text-base font-semibold transition-all">
                {l.name}
              </a>
            ))}
            <a href="#download" onClick={(e) => { scrollToSection('download')(e); setIsOpen(false); }}
              className="flex items-center justify-center mt-3 py-3 bg-[#006837] hover:bg-[#004d29] text-white rounded-xl font-black text-sm shadow-md shadow-black/30 transition-all duration-200">
              Get the App
            </a>
            <button onClick={() => { setShowLoginNotice(true); setIsOpen(false); }}
              className="w-full flex items-center justify-center gap-1.5 mt-2 py-3 border border-white/30 text-white rounded-xl font-black text-sm transition-all duration-200 cursor-pointer">
              <LogIn size={16} /> Log In
            </button>
          </div>
        </div>
      </nav>

      {showLoginNotice && (
        <LoginNoticeModal
          onClose={() => setShowLoginNotice(false)}
          onContinue={() => { setShowLoginNotice(false); navigate('/admin'); }}
        />
      )}
    </>
  );
};

export default Header;
