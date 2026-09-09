import React, { useEffect } from 'react';
import { UserPlus, Home, Settings, CheckCircle } from 'lucide-react';

const steps = [
  {
    number: '01',
    title:  'Register & Login',
    description: 'Set up your account and dive right into everything CHATEAU has to offer.',
    icon:   <UserPlus size={18} className="text-white" />,
  },
  {
    number: '02',
    title:  'Explore Facilities',
    description: 'Browse community amenities with panorama visualization and select your preferred spaces.',
    icon:   <Home size={18} className="text-white" />,
  },
  {
    number: '03',
    title:  'Manage Activities',
    description: 'Reserve facilities, track payments, report an issue, view announcements, and participate in elections.',
    icon:   <Settings size={18} className="text-white" />,
  },
  {
    number: '04',
    title:  'Stay Connected',
    description: 'Receive real-time updates and stay informed about your community activities.',
    icon:   <CheckCircle size={18} className="text-white" />,
  },
];

const HowItWorks = () => {
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('hw-visible'); obs.unobserve(e.target); }}),
      { threshold: 0.15 }
    );
    document.querySelectorAll('.hw-card').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <section id="how-it-works" className="py-28 bg-slate-950 overflow-hidden relative">
      <style>{`
        @keyframes hwPop {
          from { opacity:0; transform:translateY(40px) scale(0.95); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .hw-card { opacity:0; }
        .hw-card.hw-visible { animation: hwPop 0.65s cubic-bezier(.22,.68,0,1.2) forwards; }
      `}</style>

      <div className="container mx-auto px-6 relative z-10">

        {/* Header */}
        <div className="text-center mb-20 reveal">
          <h2 className="text-5xl md:text-6xl font-black text-white mb-5 tracking-tight">
            How It <span className="text-[#006837]">Works</span>
          </h2>
          <p className="max-w-3xl mx-auto text-slate-400 text-lg leading-relaxed">
            "Four simple steps to a seamless, more connected neighborhood. Designed for residents, practical, and built for everyday convenience."
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Connecting line — desktop only */}
          <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-[#006837]/40 to-transparent" />

          {steps.map((step, i) => (
            <div key={i} className="hw-card relative flex flex-col" style={{ animationDelay: `${i * 120}ms` }}>

              {/* Icon + connector dot */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative z-10 w-12 h-12 rounded-2xl bg-[#006837] flex items-center justify-center mb-3">
                  {step.icon}
                </div>
                <span className="text-[#006837]/60 text-[10px] font-black uppercase tracking-[0.2em]">Step {step.number}</span>
              </div>

              {/* Card */}
              <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="text-4xl font-black text-white mb-3 leading-none select-none">{step.number}</div>
                <h4 className="text-base font-bold text-white mb-2">{step.title}</h4>
                <p className="text-slate-400 text-sm leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
