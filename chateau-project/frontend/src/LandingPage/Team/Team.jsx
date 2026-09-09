import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

// Seniority, highest first — used to build the hierarchy layout below.
const ROLE_RANK = {
  'President': 0,
  'Vice President': 1,
  'Treasurer': 2,
  'Secretary': 3,
  'Auditor': 4,
  'Board of Directors': 5,
};

// Puts the most senior member dead center, then alternates the next-most-senior
// members outward to the right and left, so rank fans out symmetrically from
// the middle of the carousel (e.g. President | VP | Treasurer | Secretary...).
const buildHierarchyOrder = (list) => {
  const sorted = [...list].sort(
    (a, b) => (ROLE_RANK[a.role] ?? 99) - (ROLE_RANK[b.role] ?? 99)
  );
  const n = sorted.length;
  const center = Math.floor(n / 2);
  const result = new Array(n);
  result[center] = sorted[0];
  let left = center - 1;
  let right = center + 1;
  let goRight = true;
  for (let i = 1; i < n; i++) {
    if (goRight) { result[right] = sorted[i]; right++; }
    else         { result[left]  = sorted[i]; left--; }
    goRight = !goRight;
  }
  return { ordered: result, centerIndex: center };
};

const Team = () => {
  const [photoOverrides, setPhotoOverrides] = useState({});
  const [rosterOverrides, setRosterOverrides] = useState({});
  const trackRef = useRef(null);

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

  // Overrides are keyed by each member's original/default name, so lookups
  // always use m.name, not the (possibly overridden) display name.
  const members = teamMembers.map(m => ({
    ...m,
    url:  photoOverrides[m.name] || m.url,
    role: rosterOverrides[m.name]?.role || m.role,
    name: rosterOverrides[m.name]?.name || m.name,
  }));

  const { ordered: orderedMembers, centerIndex } = buildHierarchyOrder(members);

  const scrollByCard = (dir) => {
    trackRef.current?.scrollBy({ left: dir * 300, behavior: 'smooth' });
  };

  // Center the carousel on the President's card once everything has rendered.
  useEffect(() => {
    const track = trackRef.current;
    const centerCard = track?.children[centerIndex];
    if (track && centerCard) {
      track.scrollLeft = centerCard.offsetLeft - (track.clientWidth - centerCard.clientWidth) / 2;
    }
  }, [members.length, centerIndex]);

  return (
    <section id="team" className="py-28 bg-white overflow-hidden relative">
      <style>{`
        @keyframes tcPop {
          from { opacity:0; transform:translateY(30px) scale(0.96); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .tc-card { opacity:0; }
        .tc-card.tc-visible { animation: tcPop 0.6s cubic-bezier(.22,.68,0,1.2) forwards; }
        .tc-scrollbar-hide::-webkit-scrollbar { display: none; }
        .tc-scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Subtle top gradient band */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#006837] via-[#FFF200] to-[#006837]" />

      <div className="container mx-auto px-6">

        {/* Header */}
        <div className="text-center mb-16 reveal">
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">
            The Board of <span className="text-[#006837]">Directors</span>
          </h2>
          <p className="max-w-2xl mx-auto text-slate-500 text-base leading-relaxed">
            The Board of Directors is here to serve{' '}
            <span className="text-[#006837] font-semibold">Chateau Real</span>,
            dedicated to delivering a simple, trusted, and secure neighborhood experience.
          </p>
        </div>

        {/* Carousel */}
        <div className="relative">
          {/* Arrows */}
          <button onClick={() => scrollByCard(-1)}
            className="hidden md:flex absolute -left-5 top-1/2 -translate-y-1/2 z-10 w-11 h-11 items-center justify-center rounded-full bg-white border border-slate-200 shadow-lg text-slate-700 hover:text-[#006837] hover:border-[#006837]/30 transition-colors cursor-pointer">
            <ChevronLeft size={20} />
          </button>
          <button onClick={() => scrollByCard(1)}
            className="hidden md:flex absolute -right-5 top-1/2 -translate-y-1/2 z-10 w-11 h-11 items-center justify-center rounded-full bg-white border border-slate-200 shadow-lg text-slate-700 hover:text-[#006837] hover:border-[#006837]/30 transition-colors cursor-pointer">
            <ChevronRight size={20} />
          </button>

          <div ref={trackRef}
            className="tc-scrollbar-hide flex items-center gap-6 overflow-x-auto snap-x snap-mandatory px-1 py-2">
            {orderedMembers.map((member, i) => {
              const isPresident = i === centerIndex;
              return (
                <div key={i}
                  className={`tc-card relative shrink-0 snap-center rounded-2xl overflow-hidden shadow-lg ${
                    isPresident
                      ? 'w-60 h-80 sm:w-64 sm:h-96 -translate-y-3 z-10 shadow-xl'
                      : 'w-52 h-72 sm:w-60 sm:h-80'
                  }`}
                  style={{ animationDelay: `${i * 80}ms` }}>

                  {/* Photo — tall frame, top-aligned crop so the torso stays in view */}
                  <img src={member.url} alt={member.name}
                    className="absolute inset-0 w-full h-full object-cover object-top" />

                  {/* Bottom scrim + label — plain text, no pill background */}
                  <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <h3 className="text-white font-black text-base leading-tight">{member.name}</h3>
                    <p className="text-white/80 text-xs font-semibold tracking-wide">{member.role}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Team;
