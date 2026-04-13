'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import type { Program, CustomFormField, EmailTemplate, ProgramEmailTemplates } from '@/models/types';

type NotificationType = 'confirmation' | 'cancellation' | 'waitlist_promotion' | 'reminder';

const DURATION_OPTIONS = [
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 180, label: '3 hours' },
];

const INTERVAL_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
];

const MAX_ATTENDEES_OPTIONS = [1, 2, 3, 5, 10];

const FIELD_TYPES: CustomFormField['type'][] = ['text', 'select', 'textarea'];

const NOTIFICATION_TYPES: { key: NotificationType; label: string }[] = [
  { key: 'confirmation', label: 'Booking Confirmation' },
  { key: 'cancellation', label: 'Booking Cancellation' },
  { key: 'waitlist_promotion', label: 'Waitlist Promotion' },
  { key: 'reminder', label: 'Session Reminder' },
];

type PageState = 'loading' | 'form' | 'submitting' | 'success' | 'error';

export default function EditProgramSettingsPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = use(params);
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [brandColor, setBrandColor] = useState('#1a1a2e');
  const [sessionDuration, setSessionDuration] = useState(180);
  const [slotInterval, setSlotInterval] = useState(15);
  const [maxAttendees, setMaxAttendees] = useState(3);
  const [calendarTemplate, setCalendarTemplate] = useState('');
  const [active, setActive] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [customFields, setCustomFields] = useState<CustomFormField[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<ProgramEmailTemplates>({});
  const [activeTemplateTab, setActiveTemplateTab] = useState<NotificationType>('confirmation');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  // Load program data
  useEffect(() => {
    async function loadProgram() {
      try {
        const res = await fetch(`/api/programs/${programId}`, { cache: 'no-store' });
        if (!res.ok) {
          setErrorMessage('Program not found.');
          setPageState('error');
          return;
        }
        const program: Program = await res.json();
        setName(program.name);
        setBrandColor(program.brandColor);
        setSessionDuration(program.sessionDurationMinutes);
        setSlotInterval(program.slotIntervalMinutes);
        setMaxAttendees(program.maxAttendees);
        setCalendarTemplate(program.calendarInviteTitleTemplate || '');
        setActive(program.active);
        setLogoUrl(program.logoUrl);
        setCustomFields(program.customFormFields || []);
        setEmailTemplates(program.emailTemplates || {});
        setPageState('form');
      } catch {
        setErrorMessage('Failed to load program.');
        setPageState('error');
      }
    }
    loadProgram();
  }, [programId]);

  const addCustomField = useCallback(() => {
    setCustomFields(prev => [...prev, { name: '', label: '', type: 'text', required: false }]);
  }, []);

  const updateCustomField = useCallback((index: number, updates: Partial<CustomFormField>) => {
    setCustomFields(prev => prev.map((f, i) => i === index ? { ...f, ...updates } : f));
  }, []);

  const removeCustomField = useCallback((index: number) => {
    setCustomFields(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateEmailTemplate = useCallback((type: NotificationType, updates: Partial<EmailTemplate>) => {
    setEmailTemplates(prev => {
      const existing = prev[type] || { subject: '', bodyHtml: '' };
      return { ...prev, [type]: { ...existing, ...updates } };
    });
  }, []);

  const handlePreview = useCallback(async () => {
    const template = emailTemplates[activeTemplateTab];
    if (!template || !template.subject || !template.bodyHtml) {
      setPreviewHtml('<p>Please fill in subject and body first.</p>');
      return;
    }
    try {
      const res = await fetch(`/api/programs/${programId}/email-templates/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewHtml(data.html);
      } else {
        setPreviewHtml('<p>Failed to generate preview.</p>');
      }
    } catch {
      setPreviewHtml('<p>Error generating preview.</p>');
    }
  }, [emailTemplates, activeTemplateTab, programId]);

  async function handleSubmit() {
    if (!name.trim()) {
      setErrorMessage('Program name is required.');
      return;
    }

    setPageState('submitting');
    setErrorMessage('');

    const validFields = customFields.filter(f => f.name.trim() && f.label.trim());

    const validTemplates: ProgramEmailTemplates = {};
    for (const [key, tmpl] of Object.entries(emailTemplates)) {
      if (tmpl && tmpl.subject && tmpl.bodyHtml) {
        validTemplates[key as NotificationType] = tmpl;
      }
    }

    try {
      const res = await fetch(`/api/programs/${programId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          brandColor,
          sessionDurationMinutes: sessionDuration,
          slotIntervalMinutes: slotInterval,
          maxAttendees,
          customFormFields: validFields,
          calendarInviteTitleTemplate: calendarTemplate.trim() || '{programName} Session — {userName}',
          emailTemplates: validTemplates,
          active,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to update program.');
        setPageState('error');
        return;
      }

      // Upload logo if a new file was selected
      if (logoFile) {
        const formData = new FormData();
        formData.append('logo', logoFile);
        const logoRes = await fetch(`/api/programs/${programId}/logo`, {
          method: 'POST',
          body: formData,
        });
        if (logoRes.ok) {
          const logoData = await logoRes.json();
          setLogoUrl(logoData.logoUrl);
        }
      }

      setPageState('success');
    } catch {
      setErrorMessage('Network error. Please try again.');
      setPageState('error');
    }
  }

  if (pageState === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600 text-lg">Loading program settings…</p>
      </main>
    );
  }

  if (pageState === 'success') {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="text-emerald-600 text-4xl mb-3" aria-hidden="true">✓</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Settings Updated</h2>
          <p className="text-gray-600 mb-6">Program settings have been saved.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => router.push(`/admin/programs/${programId}`)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              View Program
            </button>
            <button
              onClick={() => router.push('/admin/programs')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Back to Programs
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Program Settings</h1>
            <p className="mt-1 text-sm text-gray-500">Edit settings for {name || 'this program'}.</p>
          </div>
          <button
            onClick={() => router.push(`/admin/programs/${programId}`)}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
          >
            Back
          </button>
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-red-700 text-sm">
            {errorMessage}
          </div>
        )}

        {/* Active Status */}
        <section className="mb-6">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded"
            />
            Program is active
          </label>
        </section>

        {/* Program Name */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Program Name</h3>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </section>

        {/* Logo */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Logo</h3>
          {logoUrl && (
            <div className="mb-2">
              <img src={logoUrl} alt="Current logo" className="w-16 h-16 rounded-lg object-cover" />
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
            className="text-sm text-gray-600"
          />
          {logoFile && <p className="mt-1 text-xs text-gray-500">New file: {logoFile.name}</p>}
        </section>

        {/* Brand Color */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Brand Color</h3>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
            />
            <input
              type="text"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </section>

        {/* Session Duration */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Session Duration</h3>
          <select
            value={sessionDuration}
            onChange={(e) => setSessionDuration(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DURATION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </section>

        {/* Slot Interval */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Slot Interval</h3>
          <select
            value={slotInterval}
            onChange={(e) => setSlotInterval(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {INTERVAL_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </section>

        {/* Max Attendees */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Max Attendees per Session</h3>
          <p className="text-xs text-gray-500 mb-1">Changes only apply to newly created sessions.</p>
          <select
            value={maxAttendees}
            onChange={(e) => setMaxAttendees(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MAX_ATTENDEES_OPTIONS.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </section>

        {/* Custom Form Fields */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-800">Custom Form Fields</h3>
            <button
              onClick={addCustomField}
              className="px-3 py-1 text-xs font-medium bg-gray-100 rounded hover:bg-gray-200 transition-colors"
            >
              + Add Field
            </button>
          </div>
          {customFields.length === 0 && (
            <p className="text-sm text-gray-400">No custom fields.</p>
          )}
          {customFields.map((field, idx) => (
            <div key={idx} className="flex flex-wrap gap-2 mb-2 items-end bg-white border border-gray-200 rounded p-3">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs text-gray-500 mb-1">Field Key</label>
                <input
                  type="text"
                  value={field.name}
                  onChange={(e) => updateCustomField(idx, { name: e.target.value })}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs text-gray-500 mb-1">Label</label>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => updateCustomField(idx, { label: e.target.value })}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="w-28">
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select
                  value={field.type}
                  onChange={(e) => updateCustomField(idx, { type: e.target.value as CustomFormField['type'] })}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {FIELD_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateCustomField(idx, { required: e.target.checked })}
                  />
                  Required
                </label>
                <button
                  onClick={() => removeCustomField(idx)}
                  className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  Remove
                </button>
              </div>
              {field.type === 'select' && (
                <div className="w-full">
                  <label className="block text-xs text-gray-500 mb-1">Options (comma-separated)</label>
                  <input
                    type="text"
                    value={(field.options || []).join(', ')}
                    onChange={(e) => updateCustomField(idx, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          ))}
        </section>

        {/* Calendar Invite Template */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Calendar Invite Title Template</h3>
          <p className="text-sm text-gray-500 mb-2">
            Use {'{programName}'} and {'{userName}'} as placeholders.
          </p>
          <input
            type="text"
            value={calendarTemplate}
            onChange={(e) => setCalendarTemplate(e.target.value)}
            placeholder="{programName} Session — {userName}"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </section>

        {/* Email Templates */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Email Templates</h3>
          <div className="flex gap-1 mb-3 flex-wrap">
            {NOTIFICATION_TYPES.map(nt => (
              <button
                key={nt.key}
                onClick={() => { setActiveTemplateTab(nt.key); setPreviewHtml(null); }}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  activeTemplateTab === nt.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {nt.label}
              </button>
            ))}
          </div>
          <EmailTemplateEditor
            template={emailTemplates[activeTemplateTab]}
            onChange={(updates) => updateEmailTemplate(activeTemplateTab, updates)}
          />
          <button
            onClick={handlePreview}
            className="mt-2 px-3 py-1.5 text-xs font-medium bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            Preview
          </button>
          {previewHtml && (
            <div className="mt-3 border border-gray-200 rounded p-3 bg-white">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Preview</h4>
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          )}
        </section>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={pageState === 'submitting'}
          className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors text-lg"
        >
          {pageState === 'submitting' ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </main>
  );
}

function EmailTemplateEditor({
  template,
  onChange,
}: {
  template?: EmailTemplate;
  onChange: (updates: Partial<EmailTemplate>) => void;
}) {
  return (
    <div className="space-y-3 bg-white border border-gray-200 rounded p-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Subject</label>
        <input
          type="text"
          value={template?.subject || ''}
          onChange={(e) => onChange({ subject: e.target.value })}
          placeholder="e.g. Your {programName} booking is confirmed"
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Body HTML</label>
        <textarea
          value={template?.bodyHtml || ''}
          onChange={(e) => onChange({ bodyHtml: e.target.value })}
          rows={4}
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Header HTML (optional)</label>
        <textarea
          value={template?.headerHtml || ''}
          onChange={(e) => onChange({ headerHtml: e.target.value })}
          rows={2}
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Footer HTML (optional)</label>
        <textarea
          value={template?.footerHtml || ''}
          onChange={(e) => onChange({ footerHtml: e.target.value })}
          rows={2}
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        />
      </div>
      <p className="text-xs text-gray-400">
        Placeholders: {'{userName}'}, {'{userEmail}'}, {'{programName}'}, {'{eventTitle}'}, {'{sessionDate}'}, {'{sessionTime}'}, {'{location}'}, {'{referenceCode}'}, {'{cancelUrl}'}, {'{programLogo}'}
      </p>
    </div>
  );
}
