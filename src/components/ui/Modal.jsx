import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// Shared modal: overlay click + Escape close, dialog semantics, one look everywhere.
export default function Modal({ title, subtitle, onClose, children, maxWidth = 'max-w-md' }) {
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector('input, select, textarea, button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} p-6 max-h-[90vh] overflow-y-auto fade-in`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            aria-label="סגירה"
            className="p-1 -mt-1 -ml-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        {subtitle && <p className="text-gray-500 text-sm">{subtitle}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
