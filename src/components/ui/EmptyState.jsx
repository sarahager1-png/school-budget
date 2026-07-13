import { Plus } from 'lucide-react';

// Friendly empty screen: what this is + one clear next step.
export default function EmptyState({ icon: Icon, title, hint, actionLabel, onAction }) {
  return (
    <div className="card text-center py-14 px-6">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto mb-4">
          <Icon size={26} className="text-teal-500" />
        </div>
      )}
      <p className="text-lg font-bold text-gray-700 mb-1">{title}</p>
      {hint && <p className="text-sm text-gray-400 max-w-xs mx-auto leading-relaxed">{hint}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn-primary mx-auto mt-5">
          <Plus size={16} />
          {actionLabel}
        </button>
      )}
    </div>
  );
}
