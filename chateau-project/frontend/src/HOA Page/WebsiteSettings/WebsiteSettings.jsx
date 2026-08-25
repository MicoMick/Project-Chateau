import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseAdmin";
import {
  Camera, CheckCircle, AlertCircle, Loader2, RotateCcw, Globe, Users, Image as ImageIcon, Save,
} from "lucide-react";
import logger from '../auditLogger';

// Bundled fallback photos — shown until an admin uploads a replacement.
import RaffyTuvilla     from '../../assets/RaffyTuvilla.png';
import MichaelNocum     from '../../assets/MichaelNocum.png';
import JanetVillar      from '../../assets/JanetVillar.png';
import JoevyMelegrito   from '../../assets/JoevyMelegrito.png';
import DivineArenas     from '../../assets/DivineArenas.png';
import DaisyJimenez     from '../../assets/DaisyJimenez.png';
import BabyArboleda     from '../../assets/BabyArboleda.png';
import RonelSantos      from '../../assets/RonelSantos.png';
import MarkAlvinTahir   from '../../assets/MarkAlvinTahir.png';
import CoverdCourt      from '../../assets/CoverdCourt.jpg';
import ModelHouse1      from '../../assets/ModelHouse1.jpg';
import House2           from '../../assets/House2.jpg';

// ─── Constants ────────────────────────────────────────────────────────────────
// Keys here must match the `name` / `caption` used in Team.jsx and AboutUs.jsx —
// that's how those public pages look up an override in `website_settings`.
const TEAM_MEMBERS = [
  { key: 'Raffy Tuvilla',     role: 'President',          fallback: RaffyTuvilla    },
  { key: 'Michael Nocum',     role: 'Vice President',     fallback: MichaelNocum    },
  { key: 'Janet Villar',      role: 'Treasurer',          fallback: JanetVillar     },
  { key: 'Joevy Melegrito',   role: 'Secretary',          fallback: JoevyMelegrito  },
  { key: 'Divine Arenas',     role: 'Auditor',            fallback: DivineArenas    },
  { key: 'Daisy Jimenez',     role: 'Board of Directors', fallback: DaisyJimenez    },
  { key: 'Baby Arboleda',     role: 'Board of Directors', fallback: BabyArboleda    },
  { key: 'Ronel Santos',      role: 'Board of Directors', fallback: RonelSantos     },
  { key: 'Mark Alvin Tahir',  role: 'Board of Directors', fallback: MarkAlvinTahir  },
];

const ABOUT_SLIDES = [
  { key: 'Covered Basketball Court', fallback: CoverdCourt },
  { key: 'Modern Home Interior',     fallback: ModelHouse1 },
  { key: 'Beautiful Home Exterior',  fallback: House2      },
];

// Position options offered in the editor — matches ROLE_COLORS in Team.jsx so
// the public page keeps its color-coded badges.
const ROLE_OPTIONS = ['President', 'Vice President', 'Treasurer', 'Secretary', 'Auditor', 'Board of Directors'];

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// ─── Notification Modal ───────────────────────────────────────────────────────
const NotifModal = ({ n, onClose }) => {
  if (!n.show) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl p-7 max-w-sm w-full shadow-2xl text-center border border-slate-100 animate-in zoom-in-95 duration-200">
        <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4 ${n.type === 'success' ? 'bg-emerald-50' : 'bg-red-50'}`}>
          {n.type === 'success' ? <CheckCircle size={26} className="text-emerald-500" /> : <AlertCircle size={26} className="text-red-500" />}
        </div>
        <h3 className="text-lg font-black text-slate-900 mb-2">{n.title}</h3>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">{n.message}</p>
        <button onClick={onClose} className="w-full py-3 bg-[#006837] hover:bg-[#004d29] text-white rounded-2xl font-bold transition-all cursor-pointer">Continue</button>
      </div>
    </div>
  );
};

// ─── Photo Card ───────────────────────────────────────────────────────────────
const PhotoCard = ({ label, sublabel, imgUrl, isOverridden, uploading, onUpload, onReset }) => (
  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md hover:border-[#006837]/20 transition-all overflow-hidden">
    <div className="relative h-40 bg-slate-100">
      <img src={imgUrl} alt={label} className="w-full h-full object-cover" />
      {uploading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <Loader2 size={22} className="animate-spin text-white" />
        </div>
      )}
      {isOverridden && (
        <span className="absolute top-2 left-2 px-2 py-0.5 bg-[#006837] text-white text-[10px] font-black rounded-full uppercase tracking-wide">Custom</span>
      )}
    </div>
    <div className="p-4">
      <p className="text-sm font-black text-slate-900 truncate">{label}</p>
      {sublabel && <p className="text-xs text-slate-400 mb-1">{sublabel}</p>}
      <div className="flex gap-2 mt-3">
        <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#006837]/10 hover:bg-[#006837]/20 text-[#006837] rounded-xl text-xs font-bold cursor-pointer transition-all">
          <Camera size={13} /> {uploading ? 'Uploading…' : 'Change Photo'}
          <input type="file" accept="image/*" className="hidden" disabled={uploading}
            onChange={e => { const file = e.target.files[0]; e.target.value = ''; if (file) onUpload(file); }} />
        </label>
        {isOverridden && (
          <button type="button" onClick={onReset} disabled={uploading} title="Reset to default photo"
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition-all cursor-pointer disabled:opacity-50">
            <RotateCcw size={13} />
          </button>
        )}
      </div>
    </div>
  </div>
);

// ─── Team Member Card — photo + editable Name/Position ────────────────────────
const TeamMemberCard = ({
  defaultName, name, role, imgUrl, isPhotoOverridden, isRosterOverridden,
  uploading, savingRoster, onUploadPhoto, onResetPhoto, onSaveRoster, onResetRoster,
}) => {
  const [draftName, setDraftName] = useState(name);
  const [draftRole, setDraftRole] = useState(role);

  useEffect(() => { setDraftName(name); }, [name]);
  useEffect(() => { setDraftRole(role); }, [role]);

  const isDirty = draftName.trim() !== name || draftRole !== role;

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md hover:border-[#006837]/20 transition-all overflow-hidden">
      <div className="relative h-40 bg-slate-100">
        <img src={imgUrl} alt={defaultName} className="w-full h-full object-cover" />
        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 size={22} className="animate-spin text-white" />
          </div>
        )}
        {isPhotoOverridden && (
          <span className="absolute top-2 left-2 px-2 py-0.5 bg-[#006837] text-white text-[10px] font-black rounded-full uppercase tracking-wide">Custom Photo</span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#006837]/10 hover:bg-[#006837]/20 text-[#006837] rounded-xl text-xs font-bold cursor-pointer transition-all">
            <Camera size={13} /> {uploading ? 'Uploading…' : 'Change Photo'}
            <input type="file" accept="image/*" className="hidden" disabled={uploading}
              onChange={e => { const file = e.target.files[0]; e.target.value = ''; if (file) onUploadPhoto(file); }} />
          </label>
          {isPhotoOverridden && (
            <button type="button" onClick={onResetPhoto} disabled={uploading} title="Reset to default photo"
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition-all cursor-pointer disabled:opacity-50">
              <RotateCcw size={13} />
            </button>
          )}
        </div>

        <div className="pt-3 mt-1 border-t border-slate-100 space-y-2">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Name</label>
            <input type="text" value={draftName} onChange={e => setDraftName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837]" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Position</label>
            <select value={draftRole} onChange={e => setDraftRole(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837]">
              {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" disabled={!isDirty || savingRoster}
              onClick={() => onSaveRoster(draftName.trim(), draftRole)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#006837] hover:bg-[#004d29] text-white rounded-lg text-xs font-bold cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {savingRoster ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {savingRoster ? 'Saving…' : 'Save'}
            </button>
            {isRosterOverridden && (
              <button type="button" onClick={onResetRoster} disabled={savingRoster} title="Reset name & position to default"
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg transition-all cursor-pointer disabled:opacity-50">
                <RotateCcw size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const WebsiteSettings = () => {
  const [teamPhotos,  setTeamPhotos]  = useState({});
  const [teamRoster,  setTeamRoster]  = useState({}); // { [defaultName]: { name, role } }
  const [aboutPhotos, setAboutPhotos] = useState({});
  const [loading,     setLoading]     = useState(true);
  const [uploadingKey, setUploadingKey] = useState(null); // `${section}:${key}`
  const [savingRosterKey, setSavingRosterKey] = useState(null); // defaultName
  const [notification, setNotification] = useState({ show: false, title: '', message: '', type: 'success' });

  const notify = (title, message, type = 'success') =>
    setNotification({ show: true, title, message, type });

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('website_settings')
      .select('team_photos, team_roster, about_photos')
      .eq('id', 1)
      .maybeSingle();
    setTeamPhotos(data?.team_photos || {});
    setTeamRoster(data?.team_roster || {});
    setAboutPhotos(data?.about_photos || {});
    setLoading(false);
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleUpload = async (section, key, file) => {
    const mapKey = `${section}:${key}`;
    setUploadingKey(mapKey);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${section}/${slugify(key)}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('website-photos').upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('website-photos').getPublicUrl(path);

      const column = section === 'team' ? 'team_photos' : 'about_photos';
      const currentMap = section === 'team' ? teamPhotos : aboutPhotos;
      const updatedMap = { ...currentMap, [key]: publicUrl };

      const { data: { user } } = await supabase.auth.getUser();
      const { error: saveErr } = await supabase.from('website_settings').upsert({
        id: 1,
        [column]: updatedMap,
        updated_at: new Date().toISOString(),
        updated_by: user?.id || null,
      });
      if (saveErr) throw saveErr;

      if (section === 'team') setTeamPhotos(updatedMap); else setAboutPhotos(updatedMap);
      logger.info('Website photo updated', { section, key });
      notify('Photo Updated', `"${key}" has been updated on the landing page.`);
    } catch (err) {
      notify('Upload Error', err.message, 'error');
    } finally {
      setUploadingKey(null);
    }
  };

  const handleReset = async (section, key) => {
    const column = section === 'team' ? 'team_photos' : 'about_photos';
    const currentMap = section === 'team' ? teamPhotos : aboutPhotos;
    const updatedMap = { ...currentMap };
    delete updatedMap[key];
    try {
      const { error } = await supabase.from('website_settings').upsert({
        id: 1,
        [column]: updatedMap,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      if (section === 'team') setTeamPhotos(updatedMap); else setAboutPhotos(updatedMap);
      logger.info('Website photo reset to default', { section, key });
      notify('Reset', `"${key}" reverted to its default photo.`);
    } catch (err) {
      notify('Error', err.message, 'error');
    }
  };

  const handleSaveRoster = async (defaultName, newName, newRole) => {
    if (!newName) { notify('Error', 'Name cannot be empty.', 'error'); return; }
    setSavingRosterKey(defaultName);
    try {
      const updatedRoster = { ...teamRoster, [defaultName]: { name: newName, role: newRole } };
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('website_settings').upsert({
        id: 1,
        team_roster: updatedRoster,
        updated_at: new Date().toISOString(),
        updated_by: user?.id || null,
      });
      if (error) throw error;
      setTeamRoster(updatedRoster);
      logger.info('Team member details updated', { defaultName, newName, newRole });
      notify('Saved!', `"${defaultName}"'s name and position have been updated on the landing page.`);
    } catch (err) {
      notify('Error', err.message, 'error');
    } finally {
      setSavingRosterKey(null);
    }
  };

  const handleResetRoster = async (defaultName) => {
    const updatedRoster = { ...teamRoster };
    delete updatedRoster[defaultName];
    try {
      const { error } = await supabase.from('website_settings').upsert({
        id: 1,
        team_roster: updatedRoster,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setTeamRoster(updatedRoster);
      logger.info('Team member details reset to default', { defaultName });
      notify('Reset', `"${defaultName}" reverted to their default name & position.`);
    } catch (err) {
      notify('Error', err.message, 'error');
    }
  };

  return (
    <div className="p-6 space-y-5 animate-in fade-in duration-300">
      <NotifModal n={notification} onClose={() => setNotification({ ...notification, show: false })} />

      {/* ── Header banner ── */}
      <div className="bg-gradient-to-br from-[#006837] to-[#004d29] rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-20 translate-x-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#FFF200]/10 rounded-full translate-y-16 -translate-x-8 pointer-events-none" />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
            <Globe size={20} />
          </div>
          <div>
            <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">Landing Page</p>
            <h2 className="text-xl font-black leading-tight">Website Settings</h2>
            <p className="text-white/70 text-sm mt-1 font-semibold">Manage the photos shown on the public landing page.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-10 h-10 border-4 border-[#006837]/20 border-t-[#006837] rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-medium animate-pulse">Loading website settings…</p>
        </div>
      ) : (
        <>
          {/* ── Team photos ── */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 bg-[#006837]/10 rounded-xl flex items-center justify-center">
                <Users size={15} className="text-[#006837]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Board of Directors</h3>
                <p className="text-xs text-slate-400">Photo, name & position shown in the "Meet Our People" section.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TEAM_MEMBERS.map(m => (
                <TeamMemberCard key={m.key}
                  defaultName={m.key}
                  name={teamRoster[m.key]?.name || m.key}
                  role={teamRoster[m.key]?.role || m.role}
                  imgUrl={teamPhotos[m.key] || m.fallback}
                  isPhotoOverridden={!!teamPhotos[m.key]}
                  isRosterOverridden={!!teamRoster[m.key]}
                  uploading={uploadingKey === `team:${m.key}`}
                  savingRoster={savingRosterKey === m.key}
                  onUploadPhoto={file => handleUpload('team', m.key, file)}
                  onResetPhoto={() => handleReset('team', m.key)}
                  onSaveRoster={(newName, newRole) => handleSaveRoster(m.key, newName, newRole)}
                  onResetRoster={() => handleResetRoster(m.key)}
                />
              ))}
            </div>
          </div>

          {/* ── About Us gallery photos ── */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 bg-[#006837]/10 rounded-xl flex items-center justify-center">
                <ImageIcon size={15} className="text-[#006837]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">About Us Gallery</h3>
                <p className="text-xs text-slate-400">Slideshow photos shown in the "Our Community" section.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ABOUT_SLIDES.map(s => (
                <PhotoCard key={s.key}
                  label={s.key}
                  imgUrl={aboutPhotos[s.key] || s.fallback}
                  isOverridden={!!aboutPhotos[s.key]}
                  uploading={uploadingKey === `about:${s.key}`}
                  onUpload={file => handleUpload('about', s.key, file)}
                  onReset={() => handleReset('about', s.key)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default WebsiteSettings;
