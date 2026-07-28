import { useState } from 'react';
import { Mail, Send } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { supabase } from '../lib/supabase.js';

export default function ContactPage() {
  const { notify } = useApp();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');

  const canSubmit = subject.trim().length > 0 && message.trim().length > 0 && (email.trim() || phone.trim()) && !sending;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim()) {
      notify('נא למלא נושא לפנייה', 'error');
      return;
    }
    if (!message.trim()) {
      notify('נא למלא הודעה', 'error');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      notify('נא למלא אימייל או טלפון ליצירת קשר', 'error');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('contact-support', {
        body: { name: name.trim(), subject: subject.trim(), email: email.trim(), phone: phone.trim(), message: message.trim(), honeypot },
      });
      if (error || data?.error) {
        notify(data?.error || 'שליחת ההודעה נכשלה — נסי שוב', 'error');
        return;
      }
      const sentAt = new Date().toLocaleString('he-IL', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jerusalem' });
      const phoneNote = phone.trim() ? ` נחזור אלייך גם לטלפון ${phone.trim()}.` : '';
      const msg = `✅ תודה! קיבלנו את פנייתך בנושא "${subject.trim()}" (${sentAt}). ניצור איתך קשר בהקדם האפשרי.${phoneNote}`;
      setSent(true);
      setConfirmMessage(msg);
      setName(''); setSubject(''); setEmail(''); setPhone(''); setMessage('');
      notify(msg, 'success');
    } catch (err) {
      console.error(err);
      notify('שליחת ההודעה נכשלה — בדקי את החיבור ונסי שוב', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
            <Mail size={18} className="text-purple-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">יצירת קשר</h2>
        </div>
        <p className="text-gray-500 text-sm mt-0.5">
          יש שאלה, בעיה או בקשה? השאירי פרטים ושרה תחזור אלייך בהקדם.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
        {/* Honeypot — hidden from real users, bots tend to fill every field */}
        <input
          type="text"
          name="company"
          value={honeypot}
          onChange={e => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="absolute opacity-0 pointer-events-none h-0 w-0"
          aria-hidden="true"
        />

        <div>
          <label className="label">שם</label>
          <input
            type="text"
            className="input"
            placeholder="שם מלא (לא חובה)"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="label">נושא הפנייה</label>
          <input
            type="text"
            className="input"
            placeholder="לדוגמה: בעיה בהזנת תקציב"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            maxLength={150}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">אימייל</label>
            <input
              type="email"
              className="input"
              placeholder="example@mail.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">טלפון</label>
            <input
              type="tel"
              className="input"
              placeholder="050-0000000"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 -mt-2">יש למלא לפחות אחד מהשניים — אימייל או טלפון</p>

        <div>
          <label className="label">הודעה</label>
          <textarea
            className="input min-h-[120px] resize-y"
            placeholder="איך אפשר לעזור?"
            value={message}
            onChange={e => setMessage(e.target.value)}
            maxLength={5000}
            required
          />
        </div>

        <button type="submit" className="btn-primary w-full sm:w-auto justify-center" disabled={!canSubmit}>
          <Send size={15} />
          {sending ? 'שולחת...' : 'שליחה'}
        </button>

        {sent && (
          <p className="text-sm text-green-600 font-medium">{confirmMessage}</p>
        )}
      </form>

      <p className="text-center text-gray-400 text-xs">בנוי ופיתוח: שרה הגר · 0503339770</p>
    </div>
  );
}
