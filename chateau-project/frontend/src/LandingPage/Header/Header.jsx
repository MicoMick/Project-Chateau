import React, { useState, useEffect } from 'react';
import ChateauLogo from '../../assets/ChataueLogo.png';

const Header = () => {
  const [isOpen,   setIsOpen]   = useState(false);
  const [scrolled, setScrolled] = useState(false);

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
        ${scrolled
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
                className="ml-2 px-5 py-2.5 bg-[#006837] hover:bg-[#006837]-300 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-[#006837]-400/20 hover:-translate-y-0.5">
                Get the App
              </a>
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
        <div className={`md:hidden overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="bg-[#004d25]/98 backdrop-blur-xl border-t border-white/10 px-6 py-5 space-y-1">
            {navLinks.map(l => (
              <a key={l.name} href={`#${l.id}`} onClick={(e) => { scrollToSection(l.id)(e); setIsOpen(false); }}
                className="flex items-center px-3 py-3 text-white/90 hover:text-[#FFF200] hover:bg-white/5 rounded-xl text-base font-semibold transition-all">
                {l.name}
              </a>
            ))}
            <a href="#download" onClick={(e) => { scrollToSection('download')(e); setIsOpen(false); }}
              className="flex items-center justify-center mt-3 py-3 bg-[#FFF200] text-[#006837] rounded-xl font-black text-sm">
              Get the App
            </a>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Header;
