import React, { useState, useEffect, useRef } from 'react';
import { Download, CheckCircle2, CalendarCheck, CreditCard, Megaphone, Vote, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../HOA Page/supabaseAdmin';
import ScreenHome          from '../../assets/app-previews/home.svg';
import ScreenPayments      from '../../assets/app-previews/payments.svg';
import ScreenNotifications from '../../assets/app-previews/notifications.svg';
import ScreenReport        from '../../assets/app-previews/report.svg';
import ScreenReserve       from '../../assets/app-previews/reserve.svg';
import ScreenVoting        from '../../assets/app-previews/voting.svg';

const features = [
  { icon: CalendarCheck, text: 'Reserve facilities with Panorama view'           },
  { icon: CreditCard,    text: 'Track HOA dues'                          },
  { icon: Megaphone,     text: 'Report neighborhood issues directly to the HOA'  },
  { icon: Vote,          text: 'Vote in community elections'                     },
  { icon: CheckCircle2,  text: 'Receive real-time announcements'                 },
];

const DEFAULT_QR_URL = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=CHATEAU-APP-DOWNLOAD&color=006837';

// Keys here must match APP_SCREENSHOTS in HOA Page > Website Settings — that's
// how an admin's upload there overrides the bundled placeholder mockup below.
const APP_SCREENSHOTS = [
  { key: 'Home Dashboard',     fallback: ScreenHome,          blurb: 'Balance, HOA calendar & announcements at a glance.' },
  { key: 'Payments',           fallback: ScreenPayments,      blurb: 'Track dues and payment history in one place.'       },
  { key: 'Notifications',      fallback: ScreenNotifications, blurb: 'Never miss a due date or community announcement.'   },
  { key: 'Submit a Report',    fallback: ScreenReport,        blurb: 'Report maintenance, noise, or security concerns.'   },
  { key: 'Reserve a Facility', fallback: ScreenReserve,       blurb: 'Book amenities and check availability by date.'     },
  { key: 'Vote in Elections',  fallback: ScreenVoting,        blurb: 'Cast your vote securely from your phone.'           },
];

const Downloadpage = () => {
  const [visible, setVisible] = useState(false);
  const [qrUrl, setQrUrl] = useState(DEFAULT_QR_URL);
  const [apkUrl, setApkUrl] = useState(null);
  const [apkFilename, setApkFilename] = useState(null);
  const [screenshotOverrides, setScreenshotOverrides] = useState({});
  const [slidePage, setSlidePage] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); }}, { threshold: 0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  // Admin-uploaded QR code / APK / app screenshots — set from HOA Page > Website Settings.
  useEffect(() => {
    supabase.from('website_settings')
      .select('download_qr_url, app_apk_url, app_apk_filename, app_screenshots')
      .eq('id', 1).maybeSingle()
      .then(({ data }) => {
        if (data?.download_qr_url) setQrUrl(data.download_qr_url);
        if (data?.app_apk_url) setApkUrl(data.app_apk_url);
        if (data?.app_apk_filename) setApkFilename(data.app_apk_filename);
        if (data?.app_screenshots) setScreenshotOverrides(data.app_screenshots);
      });
  }, []);

  const screenshots = APP_SCREENSHOTS.map(s => ({ ...s, url: screenshotOverrides[s.key] || s.fallback }));

  // 3 cards per slide — the rest are reached via the arrow buttons, not free scroll.
  const CARDS_PER_SLIDE = 3;
  const screenshotSlides = [];
  for (let i = 0; i < screenshots.length; i += CARDS_PER_SLIDE) {
    screenshotSlides.push(screenshots.slice(i, i + CARDS_PER_SLIDE));
  }
  const totalSlides = screenshotSlides.length;
  const goToSlide = (dir) => setSlidePage(p => Math.max(0, Math.min(totalSlides - 1, p + dir)));

  const handleDownloadClick = () => {
    if (!apkUrl) return;
    const a = document.createElement('a');
    a.href = apkUrl;
    a.download = apkFilename || 'chateau-app.apk';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <section id="download" ref={ref}
      className="relative py-24 md:py-32 overflow-hidden bg-slate-950">

      <div className="container mx-auto px-6 lg:px-16 relative z-10">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-16">

          {/* Left text */}
          <div className={`w-full lg:w-1/2 text-white transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16'}`}>

            <div className="inline-flex items-center mb-6 tracking-widest uppercase">
              <span className="text-white/80 text-sm font-bold">A Mobile App for Residents</span>
            </div>

            <h2 className="text-4xl md:text-5xl font-black mb-5 leading-tight tracking-tight">
              Download{' '}
              <span className="text-[#006837]">CHATEAU</span>
              <br />App on Your Phone
            </h2>

            <p className="text-slate-400 text-base leading-relaxed mb-8 max-w-xl">
              "Everything about your community, one tap away. Scan the QR code or click down below to download the CHATEAU app and take charge of your community life today."
            </p>

            {/* Feature list */}
            <ul className="space-y-3 mb-10">
              {features.map((f, i) => (
                <li key={i} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-xl bg-[#006837]/20 border border-[#006837]/30 flex items-center justify-center shrink-0">
                    <f.icon size={14} className="text-[#006837]" />
                  </div>
                  <span className="text-slate-300 text-base font-medium">{f.text}</span>
                </li>
              ))}
            </ul>

            <button onClick={handleDownloadClick} disabled={!apkUrl} title={apkUrl ? undefined : 'Coming soon'}
              className="flex items-center gap-3 bg-[#006837] hover:bg-[#004d29] text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-2xl shadow-[#006837]/30 hover:-translate-y-1 hover:shadow-[#006837]/50 active:scale-95 cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[#006837]/30">
              <Download size={18} className="group-hover:translate-y-0.5 transition-transform" />
              {apkUrl ? 'Download Now' : 'Coming Soon'}
            </button>
          </div>

          {/* Phone mockup */}
          <div className={`w-full lg:w-auto flex justify-center transition-all duration-1000 delay-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16'}`}>
            <div className="relative">
              {/* Phone frame */}
              <div className="relative w-[290px] h-[580px] bg-slate-900 border-[6px] border-slate-700 rounded-[3rem] p-3 shadow-2xl">
                {/* Screen */}
                <div className="w-full h-full bg-slate-50 rounded-[2.4rem] flex flex-col items-center justify-center p-6 text-center overflow-hidden relative">
                  {/* Status bar pill */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-5 bg-slate-900 rounded-full" />

                  <div className="mt-6 mb-4">
                    <span className="text-[10px] font-black text-[#006837] uppercase tracking-[0.3em]">CHATEAU</span>
                    <h3 className="text-2xl font-black text-slate-900 mt-1 leading-tight">Scan To<br/>Download</h3>
                  </div>

                  <div className="bg-white p-4 rounded-3xl shadow-xl border border-slate-100">
                    <img
                      src={qrUrl}
                      alt="QR Code"
                      className="w-40 h-40" />
                  </div>

                  <p className="mt-5 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    Point camera to scan
                  </p>

                  {/* Bottom home bar */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-24 h-1.5 bg-slate-300 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── App preview carousel ── */}
        <div className={`mt-24 transition-all duration-1000 delay-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16'}`}>
          <div className="text-center mb-10">
            <h3 className="text-2xl md:text-3xl font-black text-white mb-2">See the App in Action</h3>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">A quick look at what residents see once they're inside CHATEAU.</p>
          </div>

          <div className="relative">
            <button onClick={() => goToSlide(-1)} disabled={slidePage === 0}
              className="hidden md:flex absolute -left-5 top-[42%] -translate-y-1/2 z-10 w-11 h-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => goToSlide(1)} disabled={slidePage === totalSlides - 1}
              className="hidden md:flex absolute -right-5 top-[42%] -translate-y-1/2 z-10 w-11 h-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight size={20} />
            </button>

            {/* Slide viewport — shows exactly one slide (3 cards) at a time */}
            <div className="overflow-hidden">
              <div className="flex transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${slidePage * 100}%)` }}>
                {screenshotSlides.map((slide, i) => (
                  <div key={i} className="flex gap-6 shrink-0 w-full px-1 py-2 justify-center">
                    {slide.map(s => (
                      <div key={s.key} className="w-full max-w-[15rem]">
                        <div className="rounded-[2rem] border-4 border-slate-800 bg-slate-900 shadow-2xl overflow-hidden aspect-[9/18]">
                          <img src={s.url} alt={s.key} className="w-full h-full object-cover" />
                        </div>
                        <p className="text-white font-bold text-sm mt-4 text-center">{s.key}</p>
                        <p className="text-slate-500 text-xs mt-1 text-center leading-relaxed">{s.blurb}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Slide indicator dots */}
            {totalSlides > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                {screenshotSlides.map((_, i) => (
                  <button key={i} onClick={() => setSlidePage(i)}
                    className={`rounded-full transition-all cursor-pointer ${i === slidePage ? 'w-6 h-2 bg-[#006837]' : 'w-2 h-2 bg-white/20 hover:bg-white/40'}`} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Downloadpage;
