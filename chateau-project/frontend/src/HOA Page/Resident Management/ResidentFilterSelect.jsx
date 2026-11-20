import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';

// ─── Scrollable resident-filter dropdown ───────────────────────────────────
// Drop-in replacement for a native <select> of residents. Renders its menu
// through a portal so it can scroll (with a styled scrollbar) without being
// clipped by an `overflow-hidden` card ancestor.
const ResidentFilterSelect = ({
  value,
  onChange,
  options,
  allValue = 'All',
  allLabel = 'All Residents',
  icon: Icon,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const [searchText, setSearchText] = useState('');
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);

  // Reset the search box each time the menu closes, so reopening starts fresh
  // instead of still showing the last filter.
  useEffect(() => {
    if (!open) setSearchText('');
  }, [open]);

  // Autofocus the search box once the menu has actually mounted (it renders a
  // render-cycle after `open` flips, once menuPos is known).
  useEffect(() => {
    if (open && menuPos) searchRef.current?.focus();
  }, [open, menuPos]);

  useEffect(() => {
    if (!open) return;
    const updatePos = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setMenuPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    updatePos();

    const handleClickOutside = (e) => {
      if (triggerRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const handleScroll = (e) => {
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) return; // scrolling inside the menu itself
      setOpen(false);
    };
    const handleResize = () => setOpen(false);

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [open]);

  const selected = options.find(o => o.value === value);
  const label = value === allValue ? allLabel : (selected?.label || allLabel);

  const trimmedSearch = searchText.trim().toLowerCase();
  const filteredOptions = trimmedSearch
    ? options.filter(o => o.label.toLowerCase().includes(trimmedSearch))
    : options;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center justify-between gap-2 w-full ${Icon ? 'pl-8' : 'pl-3'} pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] cursor-pointer`}
      >
        {Icon && <Icon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />}
        <span className="truncate">{label}</span>
        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && menuPos && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: menuPos.width, zIndex: 9999 }}
          className="bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
        >
          {/* Pinned search box — stays put while the option list below it scrolls,
              so this still works with a few hundred residents instead of just scrolling. */}
          <div className="relative border-b border-slate-100 p-1.5">
            <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
              placeholder="Type to search..."
              className="w-full pl-7 pr-2 py-1.5 text-sm text-slate-700 placeholder-slate-400 bg-slate-50 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837]"
            />
          </div>

          <div className="max-h-56 overflow-y-auto dropdown-scroll py-1">
            <button
              type="button"
              onClick={() => { onChange(allValue); setOpen(false); }}
              className={`block w-full text-left px-3 py-2 text-sm font-semibold cursor-pointer hover:bg-slate-50 ${value === allValue ? 'text-[#006837] bg-[#006837]/5' : 'text-slate-600'}`}
            >
              {allLabel}
            </button>
            {filteredOptions.length > 0 ? filteredOptions.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`block w-full text-left px-3 py-2 text-sm font-semibold cursor-pointer hover:bg-slate-50 truncate ${value === o.value ? 'text-[#006837] bg-[#006837]/5' : 'text-slate-600'}`}
              >
                {o.label}
              </button>
            )) : (
              <p className="px-3 py-2 text-sm text-slate-400 italic">No matches</p>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ResidentFilterSelect;
