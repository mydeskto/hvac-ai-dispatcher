'use client';

import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { mutate } from 'swr';
import { patch, post, usePolling } from '@/lib/api';
import { formatTime } from '@/lib/format';
import { Booking, BookingStatus, ServiceType, Slot, Technician } from '@/lib/types';

const SERVICES: ServiceType[] = ['Cooling', 'Heating', 'Emergency'];
const STATUSES: BookingStatus[] = ['Pending', 'Confirmed', 'Cancelled', 'Completed'];

function toDateInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

export function BookingModal({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  const isNew = booking === null;
  const [serviceType, setServiceType] = useState<ServiceType>(booking?.serviceType ?? 'Cooling');
  const [date, setDate] = useState(toDateInput(booking?.start ?? new Date().toISOString()));
  const [slotStart, setSlotStart] = useState(booking?.start ?? '');
  const [technicianId, setTechnicianId] = useState(booking?.technicianId ?? '');
  const [status, setStatus] = useState<BookingStatus>(booking?.status ?? 'Pending');
  const [notes, setNotes] = useState(booking?.notes ?? '');
  const [customerName, setCustomerName] = useState(booking?.customerName ?? '');
  const [customerPhone, setCustomerPhone] = useState(booking?.customerPhone ?? '');
  const [whatsapp, setWhatsapp] = useState(booking?.customerWhatsapp ?? '');
  const [location, setLocation] = useState(booking?.location ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: technicians } = usePolling<Technician[]>('/technicians', { refreshInterval: 0 });
  const { data: availability } = usePolling<{ slots: Slot[] }>(`/availability?date=${date}T12:00:00&service=${serviceType}`, {
    refreshInterval: 0,
  });

  const slots = useMemo(() => availability?.slots ?? [], [availability]);
  const selectedSlot = slots.find((s) => s.start === slotStart);
  const eligible = (technicians ?? []).filter(
    (t) => t.skills.includes(serviceType) && (!selectedSlot || selectedSlot.technicianIds.includes(t.id) || t.id === booking?.technicianId),
  );

  useEffect(() => {
    if (!slotStart && slots.length > 0) {
      const open = slots.find((s) => s.technicianIds.length > 0);
      if (open) setSlotStart(open.start);
    }
  }, [slots, slotStart]);

  useEffect(() => {
    if (selectedSlot && !selectedSlot.technicianIds.includes(technicianId) && technicianId !== booking?.technicianId) {
      setTechnicianId(selectedSlot.technicianIds[0] ?? '');
    }
  }, [selectedSlot, technicianId, booking?.technicianId]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (isNew) {
        await post('/bookings', {
          customerName: customerName || undefined,
          customerPhone,
          whatsapp: whatsapp || customerPhone,
          location,
          technicianId,
          serviceType,
          start: slotStart,
          notes,
          status,
        });
      } else {
        await patch(`/bookings/${booking.id}`, { technicianId, serviceType, start: slotStart, status, notes });
      }
      await mutate(() => true);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{isNew ? 'New booking' : 'Manage booking'}</h2>
            <p className="text-sm text-slate-500">
              {isNew ? 'Dispatchers can create bookings manually.' : `${booking.customerName ?? booking.customerPhone} · ${booking.location ?? ''}`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {isNew ? (
            <>
              <label className="text-sm font-medium text-slate-700">
                Customer name
                <input className="input mt-1" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Phone number
                <input className="input mt-1" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+1 (512) 555-0100" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                WhatsApp number
                <input className="input mt-1" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Service address
                <input className="input mt-1" value={location} onChange={(e) => setLocation(e.target.value)} />
              </label>
            </>
          ) : null}

          <label className="text-sm font-medium text-slate-700">
            Service type
            <select className="input mt-1" value={serviceType} onChange={(e) => setServiceType(e.target.value as ServiceType)}>
              {SERVICES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Date
            <input type="date" className="input mt-1" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Time slot
            <select className="input mt-1" value={slotStart} onChange={(e) => setSlotStart(e.target.value)}>
              <option value="">Select a slot</option>
              {slots.map((s) => (
                <option key={s.start} value={s.start} disabled={s.technicianIds.length === 0 && s.start !== booking?.start}>
                  {formatTime(s.start)} – {formatTime(s.end)}{' '}
                  {s.technicianIds.length === 0 ? '(fully booked)' : `(${s.technicianIds.length} free)`}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Technician
            <select className="input mt-1" value={technicianId} onChange={(e) => setTechnicianId(e.target.value)}>
              <option value="">Select a technician</option>
              {eligible.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Status
            <select className="input mt-1" value={status} onChange={(e) => setStatus(e.target.value as BookingStatus)}>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Notes
            <textarea className="input mt-1" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>

        {error ? <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={busy || !slotStart || !technicianId} onClick={save}>
            {busy ? 'Saving…' : isNew ? 'Create booking' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
