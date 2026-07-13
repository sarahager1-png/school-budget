import { CheckCircle, AlertTriangle, Info } from 'lucide-react';

// Feedback after every action: rendered by Layout, fed from AppContext.notify()
export default function ToastHost({ toasts }) {
  if (!toasts.length) return null;

  const ICONS = { success: CheckCircle, error: AlertTriangle, info: Info };
  const STYLES = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-gray-800 text-white',
  };

  return (
    <div
      className="fixed bottom-20 md:bottom-6 inset-x-0 z-[70] flex flex-col items-center gap-2 px-4 pointer-events-none"
      aria-live="polite"
      role="status"
    >
      {toasts.map(t => {
        const Icon = ICONS[t.type] || Info;
        return (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium fade-in max-w-sm ${STYLES[t.type] || STYLES.info}`}
          >
            <Icon size={16} className="flex-shrink-0" />
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
