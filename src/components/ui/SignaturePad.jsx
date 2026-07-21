import { useRef, useEffect } from 'react';
import SignaturePadLib from 'signature_pad';
import { Eraser, Check } from 'lucide-react';

// משטח חתימה במגע/עכבר — שומר PNG שקוף כ-data-url
export default function SignaturePad({ onSave, onEmpty, height = 150, saveLabel = 'אישור חתימה' }) {
  const canvasRef = useRef(null);
  const padRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    padRef.current = new SignaturePadLib(canvas, {
      backgroundColor: 'rgba(255,255,255,0)',
      penColor: '#1A0B35',
      minWidth: 1,
      maxWidth: 3,
    });
    // קנבס חד גם ברטינה/מובייל
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const newWidth = canvas.offsetWidth * ratio;
      const newHeight = canvas.offsetHeight * ratio;
      // מונע ניקוי מיותר (למשל פתיחת מקלדת וירטואלית) כשהגודל בפועל לא השתנה
      if (newWidth === canvas.width && newHeight === canvas.height) return;
      const data = padRef.current && !padRef.current.isEmpty() ? padRef.current.toData() : null;
      canvas.width = newWidth;
      canvas.height = newHeight;
      canvas.getContext('2d').scale(ratio, ratio);
      padRef.current?.clear();
      if (data) padRef.current?.fromData(data);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      padRef.current?.off();
    };
  }, []);

  const handleSave = () => {
    if (!padRef.current || padRef.current.isEmpty()) return onEmpty?.();
    onSave(padRef.current.toDataURL('image/png'));
  };

  return (
    <div className="space-y-2">
      <div className="relative border-2 border-dashed border-purple-200 rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="w-full touch-none block"
          style={{ height, cursor: 'crosshair', touchAction: 'none' }}
          aria-label="משטח חתימה"
        />
        <p className="absolute bottom-1.5 inset-x-0 text-center text-xs text-gray-300 pointer-events-none select-none">
          חותמים כאן — באצבע או בעכבר
        </p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => padRef.current?.clear()} className="btn-outline btn-sm flex-1 justify-center">
          <Eraser size={14} />
          ניקוי
        </button>
        <button type="button" onClick={handleSave} className="btn-primary btn-sm flex-1 justify-center">
          <Check size={14} />
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
