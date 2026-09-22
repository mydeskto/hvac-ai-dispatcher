const base = 'http://localhost:4001/api';
const sim = await fetch(`${base}/ai/calls/simulate`, { method: 'POST' }).then((r) => r.json());
console.log('started:', sim.callId, 'status:', sim.status);
for (let i = 0; i < 12; i += 1) {
  await new Promise((r) => setTimeout(r, 3000));
  const call = await fetch(`${base}/calls/${sim.callId}`).then((r) => r.json());
  console.log(`t+${(i + 1) * 3}s status=${call.status} lines=${call.transcript.length} booking=${call.bookingId ?? '-'}`);
  if (call.status === 'completed') break;
}
const wa = await fetch(`${base}/whatsapp`).then((r) => r.json());
console.log('latest whatsapp:', wa[0]?.to, '| booking:', wa[0]?.bookingId);
