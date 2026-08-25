import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Maximize2 } from 'lucide-react';
import { supabase } from '../../HOA Page/supabaseAdmin';
import CoverdCourt from '../../assets/CoverdCourt.jpg';
import ModelHouse1 from '../../assets/ModelHouse1.jpg';
import House2      from '../../assets/House2.jpg';

const slides = [
  { url: CoverdCourt, caption: 'Covered Basketball Court' },
  { url: ModelHouse1, caption: 'Modern Home Interior'     },
  { url: House2,      caption: 'Beautiful Home Exterior'  },
];

const AboutUs = () => {
  const [current,        setCurrent]        = useState(0);
  const [lightboxOpen,   setLightboxOpen]   = useState(false);
  const [sectionVisible, setSectionVisible] = useState(false);
  const [photoOverrides, setPhotoOverrides] = useState({});

  // Admin-uploaded photo overrides — set from HOA Page > Website Settings.
  useEffect(() => {
    supabase.from('website_settings').select('about_photos').eq('id', 1).maybeSingle()
      .then(({ data }) => { if (data?.about_photos) setPhotoOverrides(data.about_photos); });
  }, []);

  const activeSlides = slides.map(s => ({ ...s, url: photoOverrides[s.caption] || s.url }));

  const next = () => setCurrent(p => (p === slides.length - 1 ? 0 : p + 1));
  const prev = () => setCurrent(p => (p === 0 ? slides.length - 1 : p - 1));

  useEffect(() => { const t = setInterval(next, 5000); return () => clearInterval(t); }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setSectionVisible(true); obs.disconnect(); }},
      { threshold: 0.1 }
    );
    const el = document.getElementById('about');
    if (el) obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="about" className="py-28 bg-slate-50 overflow-hidden">
      <style>{`
        .au-fade   { opacity:0; transform:translateX(-30px); transition:opacity .9s ease, transform .9s ease; }
        .au-fade.visible   { opacity:1; transform:translateX(0); }
        .au-fade-r { opacity:0; transform:translateX(30px);  transition:opacity .9s ease .2s, transform .9s ease .2s; }
        .au-fade-r.visible { opacity:1; transform:translateX(0); }
      `}</style>

      <div className="container mx-auto px-6 lg:px-16">
        <div className="flex flex-col lg:flex-row items-center gap-16">

          {/* ── Left: text ── */}
          <div className={`w-full lg:w-1/2 au-fade ${sectionVisible ? 'visible' : ''}`}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#006837]/10 border border-[#006837]/20 rounded-full text-[#006837] text-xs font-black uppercase tracking-widest mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#006837]" />
              Our Community
            </div>

            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 leading-tight tracking-tight">
              Elevate Your Living<br />
              Experience at{' '}
              <span className="text-[#006837]">Chateau</span>
            </h2>

            <div className="space-y-4 text-slate-600 leading-relaxed">
              <p>
                Chateau isn't just a place to live, it's a premier community designed for those who value security, comfort, and connection. 
                Nestled in modern architecture and lush greenery, our subdivision offers a sanctuary away from the hustle, without compromising on convenience. 
                Here, quiet mornings on tree-lined streets and friendly chats with neighbors are simply part of everyday life. Familiar faces, shared spaces, and a genuine sense of belonging make every day feel a little more like home. 
                With reliable security and well-kept surroundings, Chateau offers the comfort and peace of mind every resident deserves. It's more than a subdivision, it's the place where you call it home.
              </p>
              <p className="font-semibold text-slate-800">
                Why wait in line at the HOA office when you can manage your home from your fingertips?
              </p>
              <p>
                The CHATEAU App is your key to a seamless lifestyle, instant access to facility bookings,
                real-time community updates, and a direct line to your HOA board.
              </p>
               <p className="font-semibold text-slate-800">
                A platform, built exclusively for our community.
              </p>
                <p>
                Access to the CHATEAU App is strictly limited to verified residents and HOA officers of Chateau Real Executive Village. 
                Every account is validated against our official homeowner records before activation, no outsiders, no exceptions.
                Resident data, financial records, and community communications are kept confidential and are never shared beyond the Chateau community. 
                This ensures that the same trust and security you feel walking through our gates extends to every interaction you have on the app."
              </p>
            </div>
          </div>

          {/* ── Right: slideshow (no lightbox) ── */}
          <div className={`w-full lg:w-1/2 au-fade-r ${sectionVisible ? 'visible' : ''}`}>
            <div className="relative group rounded-3xl overflow-hidden shadow-2xl border-4 border-white cursor-pointer"
              onClick={() => setLightboxOpen(true)}>

              {/* Slides */}
              <div className="aspect-[4/3] relative bg-slate-100">
                {activeSlides.map((slide, i) => (
                  <div key={i}
                    className={`absolute inset-0 transition-opacity duration-1000 ${i === current ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <img src={slide.url} alt={slide.caption}
                      className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-700" />
                    {/* Hover overlay hint */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/20 backdrop-blur-md p-4 rounded-2xl text-white">
                        <Maximize2 size={28} />
                      </div>
                    </div>
                    {/* Caption */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                      <p className="text-white font-bold text-lg">{slide.caption}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Prev / Next */}
              {[
                { fn: prev, icon: ChevronLeft,  pos: 'left-3'  },
                { fn: next, icon: ChevronRight, pos: 'right-3' },
              ].map(b => (
                <button key={b.pos} onClick={e => { e.stopPropagation(); b.fn(); }}
                  className={`absolute ${b.pos} top-1/2 -translate-y-1/2 w-11 h-11 bg-black/30 hover:bg-white hover:text-slate-900 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all opacity-0 group-hover:opacity-100 z-10`}>
                  <b.icon size={22} />
                </button>
              ))}

              {/* Dot indicators */}
              <div className="absolute bottom-4 right-4 flex gap-1.5 z-10">
                {slides.map((_, i) => (
                  <button key={i} onClick={e => { e.stopPropagation(); setCurrent(i); }}
                    className={`rounded-full transition-all cursor-pointer ${i === current ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/50 hover:bg-white/80'}`} />
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-[999] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxOpen(false)}>

          {/* Close */}
          <button onClick={() => setLightboxOpen(false)}
            className="absolute top-5 right-5 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-2xl flex items-center justify-center transition-all z-20 cursor-pointer">
            <X size={22} />
          </button>

          {/* Prev / Next */}
          {[
            { fn: prev, icon: ChevronLeft,  pos: 'left-4'  },
            { fn: next, icon: ChevronRight, pos: 'right-4' },
          ].map(b => (
            <button key={b.pos} onClick={e => { e.stopPropagation(); b.fn(); }}
              className={`absolute ${b.pos} top-1/2 -translate-y-1/2 w-14 h-14 bg-white/5 hover:bg-white/15 text-white rounded-full flex items-center justify-center transition-all z-20 cursor-pointer`}>
              <b.icon size={32} />
            </button>
          ))}

          <img src={activeSlides[current].url} alt={activeSlides[current].caption}
            className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300" />

          <div className="absolute bottom-8 text-center pointer-events-none">
            <p className="text-white text-xl font-bold">{activeSlides[current].caption}</p>
            <p className="text-white/40 text-xs mt-1 uppercase tracking-widest font-bold">
              {current + 1} / {slides.length}
            </p>
          </div>
        </div>
      )}
    </section>
  );
};

export default AboutUs;
