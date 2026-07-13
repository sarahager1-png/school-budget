import Modal from './Modal.jsx';

export default function ConfirmDialog({ title, message, confirmLabel = 'מחק', onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose} maxWidth="max-w-sm">
      <p className="text-gray-500 text-sm mb-5">{message}</p>
      <div className="flex gap-3">
        <button
          onClick={() => { onConfirm(); onClose(); }}
          className="btn-danger flex-1 justify-center"
        >
          {confirmLabel}
        </button>
        <button onClick={onClose} className="btn-outline flex-1 justify-center">ביטול</button>
      </div>
    </Modal>
  );
}
