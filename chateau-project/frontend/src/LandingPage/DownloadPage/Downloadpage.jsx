import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, Download, CheckCircle2, CalendarCheck, CreditCard, Megaphone, Vote } from 'lucide-react';
import { supabase } from '../../HOA Page/supabaseAdmin';

const features = [
  { icon: CalendarCheck, text: 'Reserve facilities with Panorama view'           },
  { icon: CreditCard,    text: 'Track HOA dues'                          },
  { icon: Megaphone,     text: 'Report neighborhood issues directly to the HOA'  },
  { icon: Vote,          text: 'Vote in community elections'                     },
  { icon: CheckCircle2,  text: 'Receive real-time announcements'                 },
];

const DEFAULT_QR_URL = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=CHATEAU-APP-DOWNLOAD&color=006837';

const Downloadpage = () => {
  const [visible, setVisible] = useState(false);
  const [qrUrl, setQrUrl] = useState(DEFAULT_QR_URL);
  const [apkUrl, setApkUrl] = useState(null);
  const [apkFilename, setApkFilename] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); }}, { threshold: 0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  // Admin-uploaded QR code / APK — set from HOA Page > Website Settings.
  useEffect(() => {
    supabase.from('website_settings')
      .select('download_qr_url, app_apk_url, app_apk_filename')
      .eq('id', 1).maybeSingle()
      .then(({ data }) => {
        if (data?.download_qr_url) setQrUrl(data.download_qr_url);
        if (data?.app_apk_url) setApkUrl(data.app_apk_url);
        if (data?.app_apk_filename) setApkFilename(data.app_apk_filename);
      });
  }, []);

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

      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[600px] h-[600px] bg-[#006837]/20 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-96 h-96 bg-[#FFF200]/5 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-6 lg:px-16 relative z-10">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-16">

          {/* Left text */}
          <div className={`w-full lg:w-1/2 text-white transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16'}`}>

            <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-[#006837]/20 border border-[#006837]/30 rounded-full text-xs font-bold mb-7 tracking-widest uppercase">
              <Smartphone size={14} className="text-[#006837]" />
              <span className="text-white/80">Mobile App for Residents</span>
            </div>

            <h2 className="text-5xl md:text-6xl font-black mb-6 leading-tight tracking-tight">
              Download{' '}
              <span className="text-[#006837]">CHATEAU</span>
              <br />App on Your Phone
            </h2>

            <p className="text-slate-400 text-lg leading-relaxed mb-10 max-w-xl">
              "Everything about your community, one tap away. Scan the QR code or click down below to download the CHATEAU app and take charge of your community life today."
            </p>

            {/* Feature list */}
            <ul className="space-y-3.5 mb-12">
              {features.map((f, i) => (
                <li key={i} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-xl bg-[#006837]/20 border border-[#006837]/30 flex items-center justify-center shrink-0">
                    <f.icon size={14} className="text-[#006837]" />
                  </div>
                  <span className="text-slate-300 text-sm font-medium">{f.text}</span>
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
            <div className="relative group">
              {/* Glow ring */}
              <div className="absolute inset-0 bg-[#006837]/20 rounded-[3.5rem] blur-2xl scale-105 group-hover:scale-110 transition-transform duration-500" />

              {/* Phone frame */}
              <div className="relative w-[280px] h-[560px] bg-slate-900 border-[6px] border-slate-700 rounded-[3rem] p-3 shadow-2xl group-hover:scale-105 transition-transform duration-500">
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
                      className="w-36 h-36" />
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
      </div>
    </section>
  );
};

export default Downloadpage;
