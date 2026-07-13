import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

// Accordion-style picker — replaces native <select> everywhere.
// options: [{ value, label, hint?, color? }]
export default function Picker({ label, value, options, onChange, placeholder = 'בחרי...' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef}>
      {label && <span className="label">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="input flex items-center justify-between gap-2 text-right cursor-pointer hover:border-gray-300"
      >
        <span className={`flex items-center gap-2 truncate ${selected ? 'text-gray-800' : 'text-gray-400'}`}>
          {selected?.color && (
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: selected.color }} />
          )}
          {selected?.label || placeholder}
        </span>
        <ChevronDown size={15} className={`flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="mt-1.5 border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden fade-in"
        >
          {options.map(opt => {
            const isSel = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSel}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-right transition-colors border-b border-gray-50 last:border-0 ${
                  isSel ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {opt.color && (
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: opt.color }} />
                )}
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{opt.label}</span>
                  {opt.hint && <span className="block text-xs text-gray-400 font-normal mt-0.5">{opt.hint}</span>}
                </span>
                {isSel && <Check size={15} className="flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
