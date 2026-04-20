#!/usr/bin/env node
/*
  simulate_release.js
  - Read-only simulation of BusService.releaseSlotsForBus promotion algorithm
  - Prints which waitlisted requests WOULD be promoted for a given bus and quantity

  Usage:
    MONGO_URI="mongodb://localhost:27017/vrg-transport" node simulate_release.js --busId=<busId> [--quantity=3] [--periodId=<periodId>]
*/

const mongoose = require('mongoose');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv)).options({
  busId: { type: 'string', demandOption: true },
  quantity: { type: 'number', demandOption: false },
  periodId: { type: 'string', demandOption: false },
}).argv;

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/vrg-transport';
const { Schema } = mongoose;

const UniversitySlotSub = new Schema({
  universityId: Schema.Types.ObjectId,
  priorityOrder: Number,
  filledSlots: Number,
}, { _id: false });

const BusSchema = new Schema({ identifier: String, capacity: Number, universitySlots: [UniversitySlotSub] }, { collection: 'buses' });
const Bus = mongoose.model('Bus', BusSchema);

const EnrollmentPeriodSchema = new Schema({ startDate: Date, endDate: Date, totalSlots: Number, active: Boolean }, { collection: 'enrollment_periods' });
const EnrollmentPeriod = mongoose.model('EnrollmentPeriod', EnrollmentPeriodSchema);

const LicenseRequestSchema = new Schema({ studentId: String, status: String, enrollmentPeriodId: Schema.Types.ObjectId, filaPosition: Number, busId: Schema.Types.ObjectId, universityId: Schema.Types.ObjectId, createdAt: Date }, { collection: 'license_requests' });
const LicenseRequest = mongoose.model('LicenseRequest', LicenseRequestSchema);

async function main() {
  await mongoose.connect(MONGO_URI).catch(err => { console.error('Mongo connect failed:', err.message); process.exit(2); });

  const bus = await Bus.findById(argv.busId).lean();
  if (!bus) { console.error('Bus not found:', argv.busId); process.exit(3); }

  const period = argv.periodId ? await EnrollmentPeriod.findById(argv.periodId).lean() : await EnrollmentPeriod.findOne({ active: true }).lean();
  if (!period) { console.error('No enrollment period found (active or by periodId).'); process.exit(4); }

  const periodId = period._id.toString();
  const q = typeof argv.quantity === 'number' ? argv.quantity : undefined;

  // Gather waitlisted requests for this bus and period
  const waitlistedForBus = await LicenseRequest.find({ enrollmentPeriodId: period._id, busId: bus._id, status: 'waitlisted' }).lean();

  // compute per-university counts (pending + waitlisted)
  const grouped = await LicenseRequest.aggregate([
    { $match: { enrollmentPeriodId: period._id, busId: bus._id } },
    { $group: { _id: '$universityId', pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } }, waitlisted: { $sum: { $cond: [{ $eq: ['$status', 'waitlisted'] }, 1, 0] } } } }
  ]);

  const perUniCounts = {};
  for (const g of grouped) {
    const uid = g._id ? g._id.toString() : null;
    if (!uid) continue;
    perUniCounts[uid] = { pending: g.pending || 0, waitlisted: g.waitlisted || 0 };
  }

  const slots = bus.universitySlots || [];
  const sortedUniIds = [...slots].sort((a,b) => (a.priorityOrder||0) - (b.priorityOrder||0)).map(s => s.universityId?.toString()).filter(Boolean);

  // Find first priority index with any active demand
  let startIndex = 0;
  for (let i = 0; i < sortedUniIds.length; i++) {
    const uid = sortedUniIds[i];
    const counts = perUniCounts[uid] || { pending: 0, waitlisted: 0 };
    if ((counts.pending || 0) + (counts.waitlisted || 0) > 0) { startIndex = i; break; }
  }

  let remainingToPromote = q === undefined ? slots.reduce((acc, s) => acc + ((s.filledSlots && s.filledSlots > 0) ? s.filledSlots : 0), 0) : q;
  if (!remainingToPromote) {
    console.log('No slots to promote (released slots = 0).');
    await mongoose.disconnect();
    process.exit(0);
  }

  const waitlisted = waitlistedForBus.sort((a,b) => {
    const pa = a.filaPosition ?? 0; const pb = b.filaPosition ?? 0;
    if (pa && pb) return pa - pb;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const promotedIds = [];

  for (let idx = startIndex; idx < sortedUniIds.length && remainingToPromote > 0; idx++) {
    const uniId = sortedUniIds[idx];
    const counts = perUniCounts[uniId] || { pending: 0, waitlisted: 0 };
    if ((counts.pending || 0) + (counts.waitlisted || 0) === 0) continue;
    if ((counts.waitlisted || 0) === 0) {
      // block lower priorities
      break;
    }

    const candidates = waitlisted.filter(r => (r.universityId?.toString?.() === uniId));
    if (!candidates.length) continue;

    const take = Math.min(remainingToPromote, candidates.length);
    for (let i = 0; i < take; i++) promotedIds.push(candidates[i]._id.toString());
    remainingToPromote -= take;
    if (candidates.length > take) break;
    if ((counts.pending || 0) > 0) break;
  }

  console.log(`Simulation for bus ${bus.identifier} (id=${bus._id}):`);
  console.log(`  Released slots (sim): ${q === undefined ? '(not specified; use --quantity to simulate)' : q}`);
  console.log(`  Promotable count computed: ${promotedIds.length}`);
  if (promotedIds.length) console.log('  Promoted request IDs:', promotedIds.join(', '));

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error('Error:', err); process.exit(5); });
