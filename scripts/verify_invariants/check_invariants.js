#!/usr/bin/env node
/*
  check_invariants.js
  - Connects to MongoDB (MONGO_URI env or default)
  - Verifies domain invariants and writes a report JSON

  Usage:
    MONGO_URI="mongodb://localhost:27017/vrg-transport" node check_invariants.js
*/

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/vrg-transport';

const { Schema } = mongoose;

const UniversitySchema = new Schema({ name: String }, { collection: 'universities' });
const University = mongoose.model('University', UniversitySchema);

const EnrollmentPeriodSchema = new Schema({
  startDate: Date,
  endDate: Date,
  totalSlots: Number,
  active: Boolean,
}, { collection: 'enrollment_periods' });
const EnrollmentPeriod = mongoose.model('EnrollmentPeriod', EnrollmentPeriodSchema);

const UniversitySlotSub = new Schema({
  universityId: { type: Schema.Types.ObjectId, ref: 'University' },
  priorityOrder: Number,
  filledSlots: Number,
}, { _id: false });

const BusSchema = new Schema({
  identifier: String,
  shift: String,
  capacity: Number,
  universitySlots: [UniversitySlotSub],
  active: Boolean,
}, { collection: 'buses' });
const Bus = mongoose.model('Bus', BusSchema);

const LicenseRequestSchema = new Schema({
  studentId: String,
  type: String,
  status: String,
  enrollmentPeriodId: Schema.Types.ObjectId,
  filaPosition: Number,
  busId: Schema.Types.ObjectId,
  universityId: Schema.Types.ObjectId,
  createdAt: Date,
}, { collection: 'license_requests' });
const LicenseRequest = mongoose.model('LicenseRequest', LicenseRequestSchema);

async function main() {
  console.log('Connecting to', MONGO_URI);
  await mongoose.connect(MONGO_URI, { dbName: undefined }).catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(2);
  });

  const report = { timestamp: new Date().toISOString(), anomalies: [] };

  const activePeriod = await EnrollmentPeriod.findOne({ active: true }).lean();
  if (!activePeriod) {
    console.warn('No active enrollment period found. Aborting checks that require an active period.');
  } else {
    console.log('Active enrollment period:', activePeriod._id?.toString?.() ?? '<unknown>');
  }

  // 1) Check totalSlots >= sum(bus.capacity)
  const buses = await Bus.find({}).lean();
  const totalCapacity = buses.reduce((acc, b) => acc + (b.capacity || 0), 0);
  if (activePeriod && (activePeriod.totalSlots < totalCapacity)) {
    report.anomalies.push({
      type: 'ENROLLMENT_TOTAL_BELOW_BUS_CAPACITY',
      message: `EnrollmentPeriod.totalSlots (${activePeriod.totalSlots}) is less than sum of bus capacities (${totalCapacity}).`,
      period: activePeriod._id?.toString?.(),
      totalSlots: activePeriod.totalSlots,
      totalCapacity,
    });
  }

  // load license requests for active period if exists
  let licenseRequests = [];
  if (activePeriod) {
    licenseRequests = await LicenseRequest.find({ enrollmentPeriodId: activePeriod._id }).lean();
  }

  // 2) Per-bus checks
  for (const bus of buses) {
    const busId = bus._id?.toString?.();
    const universitySlots = bus.universitySlots || [];
    const filledSum = universitySlots.reduce((acc, s) => acc + (s.filledSlots || 0), 0);

    if (activePeriod) {
      const pendingCount = licenseRequests.filter(r => (r.busId?.toString?.() === busId) && r.status === 'pending').length;
      if (filledSum !== pendingCount) {
        report.anomalies.push({
          type: 'BUS_FILLED_MISMATCH_PENDING',
          message: `Bus ${bus.identifier} (id=${busId}) filledSlots sum (${filledSum}) != pending requests (${pendingCount}) for active period.`,
          busId,
          identifier: bus.identifier,
          filledSum,
          pendingCount,
        });
      }
    }

    // capacity vs filled
    if (bus.capacity != null && filledSum > bus.capacity) {
      report.anomalies.push({
        type: 'BUS_FILLED_EXCEEDS_CAPACITY',
        message: `Bus ${bus.identifier} filledSlots (${filledSum}) exceeds capacity (${bus.capacity}).`,
        busId,
        filledSum,
        capacity: bus.capacity,
      });
    }

    // university slots integrity: duplicate priorityOrder, negative filledSlots
    const orders = universitySlots.map(s => s.priorityOrder);
    const dupOrders = orders.filter((v, i) => orders.indexOf(v) !== i);
    if (dupOrders.length) {
      report.anomalies.push({
        type: 'DUPLICATE_PRIORITY_ORDER',
        message: `Bus ${bus.identifier} has duplicate priorityOrder values: ${[...new Set(dupOrders)].join(',')}`,
        busId,
        duplicateOrders: [...new Set(dupOrders)],
      });
    }

    for (const slot of universitySlots) {
      if ((slot.filledSlots || 0) < 0) {
        report.anomalies.push({
          type: 'NEGATIVE_FILLED_SLOTS',
          message: `Bus ${bus.identifier} has negative filledSlots for university ${slot.universityId}.`,
          busId,
          universityId: slot.universityId?.toString?.(),
          filledSlots: slot.filledSlots,
        });
      }

      if (activePeriod) {
        const pendingForUni = licenseRequests.filter(r => (r.busId?.toString?.() === busId) && (r.universityId?.toString?.() === (slot.universityId?.toString?.())) && r.status === 'pending').length;
        if ((slot.filledSlots || 0) !== pendingForUni) {
          report.anomalies.push({
            type: 'UNI_FILLED_MISMATCH',
            message: `Bus ${bus.identifier} university ${slot.universityId} filledSlots (${slot.filledSlots}) != pending requests for that uni (${pendingForUni}).`,
            busId,
            universityId: slot.universityId?.toString?.(),
            filledSlots: slot.filledSlots,
            pendingForUni,
          });
        }
      }
    }

    // waitlist invariants: filaPosition uniqueness and sequence
    if (activePeriod) {
      const waitlisted = licenseRequests.filter(r => (r.busId?.toString?.() === busId) && r.status === 'waitlisted')
        .sort((a, b) => {
          const pa = a.filaPosition ?? 0; const pb = b.filaPosition ?? 0;
          if (pa && pb) return pa - pb;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

      const positions = waitlisted.map(w => w.filaPosition).filter(Boolean);
      const uniquePos = [...new Set(positions)];
      if (positions.length !== uniquePos.length) {
        report.anomalies.push({
          type: 'DUPLICATE_FILA_POSITION',
          message: `Bus ${bus.identifier} has duplicated filaPosition values among waitlisted requests.`,
          busId,
          duplicatedCount: positions.length - uniquePos.length,
        });
      }

      // gaps detection (expectation: filaPosition should start at 1 and be continuous, but allow nulls)
      if (positions.length > 0) {
        const min = Math.min(...positions);
        const max = Math.max(...positions);
        if (min !== 1 || max - positions.length + 1 !== 0) {
          // We'll check for missing numbers in 1..max
          const missing = [];
          for (let i = 1; i <= max; i++) if (!positions.includes(i)) missing.push(i);
          if (missing.length) {
            report.anomalies.push({
              type: 'MISSING_FILA_POSITIONS',
              message: `Bus ${bus.identifier} missing filaPosition values: ${missing.join(',')}`,
              busId,
              missing,
            });
          }
        }
      }
    }
  }

  // Save report
  const outDir = path.join(__dirname);
  const outFile = path.join(outDir, `report-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf8');

  console.log('Report written to', outFile);
  console.log('Anomalies found:', report.anomalies.length);

  await mongoose.disconnect();
  process.exit(report.anomalies.length ? 2 : 0);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(3);
});
