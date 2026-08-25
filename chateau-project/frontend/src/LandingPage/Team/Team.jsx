import React, { useEffect, useState } from 'react';
import { supabase } from '../../HOA Page/supabaseAdmin';
import RaffyTuvilla     from '../../assets/RaffyTuvilla.png';
import MichaelNocum     from '../../assets/MichaelNocum.png';
import JanetVillar      from '../../assets/JanetVillar.png';
import JoevyMelegrito   from '../../assets/JoevyMelegrito.png';
import DivineArenas     from '../../assets/DivineArenas.png';
import DaisyJimenez     from '../../assets/DaisyJimenez.png';
import BabyArboleda     from '../../assets/BabyArboleda.png';
import RonelSantos      from '../../assets/RonelSantos.png';
import MarkAlvinTahir   from '../../assets/MarkAlvinTahir.png';

const ROLE_COLORS = {
  'President':         'bg-[#006837]/10 text-[#006837] border-[#006837]/20',
  'Vice President':    'bg-blue-50 text-blue-700 border-blue-100',
  'Treasurer':         'bg-amber-50 text-amber-700 border-amber-100',
  'Secretary':         'bg-violet-50 text-violet-700 border-violet-100',
  'Auditor':           'bg-rose-50 text-rose-700 border-rose-100',
  'Board of Directors':'bg-slate-100 text-slate-600 border-slate-200',
};

const teamMembers = [
  { name: 'Raffy Tuvilla',     role: 'President',          url: RaffyTuvilla    },
  { name: 'Michael Nocum',     role: 'Vice President',     url: MichaelNocum    },
  { name: 'Janet Villar',      role: 'Treasurer',          url: JanetVillar     },
  { name: 'Joevy Melegrito',   role: 'Secretary',          url: JoevyMelegrito  },
  { name: 'Divine Arenas',     role: 'Auditor',            url: DivineArenas    },
  { name: 'Daisy Jimenez',     role: 'Board of Directors', url: DaisyJimenez   },
  { name: 'Baby Arboleda',     role: 'Board of Directors', url: BabyArboleda   },
  { name: 'Ronel Santos',      role: 'Board of Directors', url: RonelSantos    },
  { name: 'Mark Alvin Tahir',  role: 'Board of Directors', url: MarkAlvinTahir },
];

const Team = () => {
  const [photoOverrides, setPhotoOverrides] = useState({});
  const [rosterOverrides, setRosterOverrides] = useState({});

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('tc-visible'); obs.unobserve(e.target); }}),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.tc-card').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // Admin-uploaded photo/name/position overrides — set from HOA Page > Website Settings.
  useEffect(() => {
    supabase.from('website_settings').select('team_photos, team_roster').eq('id', 1).maybeSingle()
      .then(({ data }) => {
        if (data?.team_photos) setPhotoOverrides(data.team_photos);
        if (data?.team_roster) setRosterOverrides(data.team_roster);
      });
  }, []);

  // Separate President for feature spotlight — overrides are keyed by each
  // member's original/default name, so lookups always use m.name, not the
  // (possibly overridden) display name.
  const [president, ...rest] = teamMembers.map(m => ({
    ...m,
    url:  photoOverrides[m.name] || m.url,
    role: rosterOverrides[m.name]?.role || m.role,
    name: rosterOverrides[m.name]?.name || m.name,
  }));

  return (
    <section id="team" className="py-28 bg-white overflow-hidden relative">
      <style>{`
        @keyframes tcPop {
          from { opacity:0; transform:translateY(30px) scale(0.96); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .tc-card { opacity:0; }
        .tc-card.tc-visible { animation: tcPop 0.6s cubic-bezier(.22,.68,0,1.2) forwards; }
      `}</style>

      {/* Subtle top gradient band */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#006837] via-[#FFF200] to-[#006837]" />

      <div className="container mx-auto px-6">

        {/* Header */}
        <div className="text-center mb-16 reveal">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#006837]/10 border border-[#006837]/20 rounded-full text-[#006837] text-xs font-black uppercase tracking-widest mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#006837]" />
            Meet Our People
          </div>
          <h2 className="text-5xl md:text-6xl font-black text-slate-900 mb-4 tracking-tight">
            Board of <span className="text-[#006837]">Directors</span>
          </h2>
          <p className="max-w-2xl mx-auto text-slate-500 text-lg leading-relaxed">
            The Board of Directors is here to serve{' '}
            <span className="text-[#006837] font-semibold">Chateau Real</span>,
            dedicated to delivering a simple, trusted, and secure neighborhood experience.
          </p>
        </div>

        {/* President spotlight */}
        <div className="tc-card flex justify-center mb-12" style={{ animationDelay: '0ms' }}>
          <div className="group bg-gradient-to-br from-[#006837] to-[#004d29] rounded-3xl p-8 flex flex-col items-center text-center w-72 shadow-2xl shadow-[#006837]/20 hover:-translate-y-2 transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-20 translate-x-20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#FFF200]/10 rounded-full translate-y-16 -translate-x-10 pointer-events-none" />
            {/* ── Photo: fixed-size square container with object-cover ── */}
            <div className="relative w-28 h-28 rounded-2xl overflow-hidden border-4 border-white/30 shadow-xl mb-5 shrink-0">
              <img src={president.url} alt={president.name}
                className="w-full h-full object-cover object-top group-hover:scale-110 transition-transform duration-500" />
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FFF200] text-[#006837] rounded-full text-[10px] font-black uppercase tracking-widest mb-3">
              {president.role}
            </span>
            <h3 className="text-xl font-black text-white">{president.name}</h3>
          </div>
        </div>

        {/* Rest of team */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {rest.map((member, i) => {
            const roleColor = ROLE_COLORS[member.role] || ROLE_COLORS['Board of Directors'];
            return (
              <div key={i}
                className="tc-card group bg-white border border-slate-100 rounded-2xl p-6 flex flex-col items-center text-center shadow-sm hover:shadow-xl hover:border-[#006837]/20 hover:-translate-y-1 transition-all duration-300"
                style={{ animationDelay: `${(i + 1) * 80}ms` }}>

                {/* ── Photo: fixed square, object-cover object-top ── */}
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-slate-100 shadow-md mb-4 shrink-0 group-hover:border-[#006837]/20 transition-colors">
                  <img src={member.url} alt={member.name}
                    className="w-full h-full object-cover object-top group-hover:scale-110 transition-transform duration-500" />
                </div>

                <h3 className="text-base font-black text-slate-900 mb-2">{member.name}</h3>
                <span className={`inline-flex text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${roleColor}`}>
                  {member.role}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Team;
