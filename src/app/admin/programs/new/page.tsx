'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { CustomFormField, EmailTemplate, ProgramEmailTemplates } from '@/models/types';

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

type PageState = 'form' | 'submitting' | 'success' | 'error';

export default function CreateProgramPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>('form');
  const [errorMessage, setErrorMessage] = useState('');
  const [createdProgramId, setCreatedProgramId] = useState('');

  // Basic fields
  const [name, setName] = useState('');
  const [brandColor, setBrandColor] = useState('#1a1a2e');
  const [sessionDuration, setSessionDuration] = useState(180);
  const [slotInterval, setSlotInterval] = useState(15);
  const [maxAttendees, setMaxAttendees] = useState(3);
  const [calendarTemplate, setCalendarTemplate] = useState('');

  // Logo
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Custom form fields
  const [customFields, setCustomFields] = useState<CustomFormField[]>([]);

  // Email templates
  const [emailTemplates, setEmailTemplates] = useState<ProgramEmailTemplates>({});
  const [activeTemplateTab, setActiveTemplateTab] = useState<NotificationType>('confirmation');
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

  async function handleSubmit() {
    if (!name.trim()) {
      setErrorMessage('Program name is required.');
      return;
    }

    setPageState('submitting');
    setErrorMessage('');

    // Filter out empty custom fields
    const validFields = customFields.filter(f => f.name.trim() && f.label.trim());

    // Filter out empty email templates
    const validTemplates: ProgramEmailTemplates = {};
    for (const [key, tmpl] of Object.entries(emailTemplates)) {
      if (tmpl && tmpl.subject && tmpl.bodyHtml) {
        validTemplates[key as NotificationType] = tmpl;
      }
    }

    try {
      const res = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          brandColor,
          sessionDurationMinutes: sessionDuration,
          slotIntervalMinutes: slotInterval,
          maxAttendees,
          customFormFields: validFields,
          ...(calendarTemplate.trim() && { calendarInviteTitleTemplate: calendarTemplate.trim() }),
          ...(Object.keys(validTemplates).length > 0 && { emailTemplates: validTemplates }),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to create program.');
        setPageState('error');
        return;
      }

      // Upload logo if provided
      if (logoFile && data.id) {
        const formData = new FormData();
        formData.append('logo', logoFile);
        await fetch(`/api/programs/${data.id}/logo`, {
          method: 'POST',
          body: formData,
        });
      }

      setCreatedProgramId(data.id);
      setPageState('success');
    } catch {
      setErrorMessage('Network error. Please try again.');
      setPageState('error');
    }
  }

  if (pageState === 'success') {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="text-emerald-600 text-4xl mb-3" aria-hidden="true">✓</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Program Created</h2>
          <p className="text-gray-600 mb-6">&quot;{name}&quot; has been created successfully.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => router.push(`/admin/programs/${createdProgramId}`)}
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
            <h1 className="text-2xl font-bold text-gray-900">Create Program</h1>
            <p className="mt-1 text-sm text-gray-500">Set up a new booking program with custom settings.</p>
          </div>
          <button
            onClick={() => router.push('/admin/programs')}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-red-700 text-sm">
            {errorMessage}
          </div>
        )}

        {/* Program Name */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">1. Program Name</h3>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tech Talks, 1:1 Coaching"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </section>

        {/* Logo Upload */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">2. Logo</h3>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
            className="text-sm text-gray-600"
          />
          {logoFile && <p className="mt-1 text-xs text-gray-500">Selected: {logoFile.name}</p>}
        </section>

        {/* Brand Color */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">3. Brand Color</h3>
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
          <h3 className="text-lg font-semibold text-gray-800 mb-2">4. Session Duration</h3>
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
          <h3 className="text-lg font-semibold text-gray-800 mb-2">5. Slot Interval</h3>
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
          <h3 className="text-lg font-semibold text-gray-800 mb-2">6. Max Attendees per Session</h3>
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
            <h3 className="text-lg font-semibold text-gray-800">7. Custom Form Fields</h3>
            <button
              onClick={addCustomField}
              className="px-3 py-1 text-xs font-medium bg-gray-100 rounded hover:bg-gray-200 transition-colors"
            >
              + Add Field
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-3">Define additional fields for the booking form (beyond name and email).</p>
          {customFields.length === 0 && (
            <p className="text-sm text-gray-400">No custom fields added.</p>
          )}
          {customFields.map((field, idx) => (
            <div key={idx} className="flex flex-wrap gap-2 mb-2 items-end bg-white border border-gray-200 rounded p-3">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs text-gray-500 mb-1">Field Key</label>
                <input
                  type="text"
                  value={field.name}
                  onChange={(e) => updateCustomField(idx, { name: e.target.value })}
                  placeholder="e.g. department"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs text-gray-500 mb-1">Label</label>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => updateCustomField(idx, { label: e.target.value })}
                  placeholder="e.g. Department"
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
                    placeholder="e.g. Option A, Option B, Option C"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          ))}
        </section>

        {/* Calendar Invite Template */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">8. Calendar Invite Title Template</h3>
          <p className="text-sm text-gray-500 mb-2">
            Use {'{programName}'} and {'{userName}'} as placeholders. Leave blank for default.
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
          <h3 className="text-lg font-semibold text-gray-800 mb-2">9. Email Templates</h3>
          <p className="text-sm text-gray-500 mb-3">
            Customize email notifications. Leave blank to use defaults.
          </p>
          <div className="flex gap-1 mb-3 flex-wrap">
            {NOTIFICATION_TYPES.map(nt => (
              <button
                key={nt.key}
                onClick={() => { setActiveTemplateTab(nt.key); }}
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
        </section>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={pageState === 'submitting'}
          className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors text-lg"
        >
          {pageState === 'submitting' ? 'Creating…' : 'Create Program'}
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
          placeholder="<p>Hi {userName}, your session on {sessionDate} at {sessionTime} is confirmed.</p>"
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
