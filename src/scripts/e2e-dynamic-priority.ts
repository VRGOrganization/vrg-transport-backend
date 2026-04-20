import 'reflect-metadata';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Schema, Types } from 'mongoose';

async function main() {
  console.log('E2E dynamic-priority (simulation): starting in-memory MongoDB');
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'e2e' });

  // Minimal schemas for test
  const UniversitySchema = new Schema({ name: String, acronym: String, address: String }, { timestamps: true });
  const EnrollmentPeriodSchema = new Schema({ startDate: Date, endDate: Date, totalSlots: Number, filledSlots: Number, waitlistSequence: Number, closedWaitlistCount: Number, licenseValidityMonths: Number, active: Boolean, createdByAdminId: String }, { timestamps: true });

  const StudentSchema = new Schema({ name: String, email: String, cpfHash: String, password: String, telephone: String, institution: String, universityId: Types.ObjectId }, { timestamps: true });

  const BusSchema = new Schema({
    identifier: String,
    capacity: Number,
    filledSlots: Number,
    universitySlots: [{ universityId: Types.ObjectId, priorityOrder: Number, filledSlots: Number }],
  }, { timestamps: true });

  const LicenseRequestSchema = new Schema({
    studentId: String,
    enrollmentPeriodId: String,
    busId: Types.ObjectId,
    universityId: Types.ObjectId,
    status: String,
    filaPosition: Number,
  }, { timestamps: true });

  const UniversityModel = mongoose.model('University_e2e', UniversitySchema);
  const EnrollmentPeriodModel = mongoose.model('EnrollmentPeriod_e2e', EnrollmentPeriodSchema);
  const StudentModel = mongoose.model('Student_e2e', StudentSchema);
  const BusModel = mongoose.model('Bus_e2e', BusSchema);
  const LicenseRequestModel = mongoose.model('LicenseRequest_e2e', LicenseRequestSchema);

  // create two universities
  const u1 = await UniversityModel.create({ name: 'Uni A', acronym: 'UNIA', address: 'Addr A' });
  const u2 = await UniversityModel.create({ name: 'Uni B', acronym: 'UNIB', address: 'Addr B' });

  // create enrollment period
  const period = await EnrollmentPeriodModel.create({
    startDate: new Date(Date.now() - 1000 * 60 * 60),
    endDate: new Date(Date.now() + 1000 * 60 * 60),
    totalSlots: 100,
    filledSlots: 0,
    waitlistSequence: 0,
    closedWaitlistCount: 0,
    licenseValidityMonths: 6,
    active: true,
    createdByAdminId: 'e2e-admin',
  });

  // create a bus with university slots: uni A priority=1 (filledSlots 2), uni B priority=2
  const bus = await BusModel.create({
    identifier: 'E2E-BUS',
    capacity: 3,
    filledSlots: 2,
    universitySlots: [
      { universityId: u1._id, priorityOrder: 1, filledSlots: 2 },
      { universityId: u2._id, priorityOrder: 2, filledSlots: 0 },
    ],
  });

  // create students
  const sA1 = await StudentModel.create({ name: 'A1', email: 'a1@example.com', cpfHash: 'cpa1', password: 'p', telephone: 't', institution: 'I1', universityId: u1._id });
  const sA2 = await StudentModel.create({ name: 'A2', email: 'a2@example.com', cpfHash: 'cpa2', password: 'p', telephone: 't', institution: 'I1', universityId: u1._id });
  const sB1 = await StudentModel.create({ name: 'B1', email: 'b1@example.com', cpfHash: 'cpb1', password: 'p', telephone: 't', institution: 'I2', universityId: u2._id });

  // Create license requests to reproduce scenario:
  // - Uni A: 1 PENDING, 1 WAITLISTED
  // - Uni B: 1 WAITLISTED
  const pendingA = await LicenseRequestModel.create({
    studentId: sA1._id.toString(),
    enrollmentPeriodId: period._id.toString(),
    busId: bus._id,
    universityId: u1._id,
    status: 'PENDING',
    createdAt: new Date(Date.now() - 1000 * 60 * 60),
  });

  const waitA1 = await LicenseRequestModel.create({
    studentId: sA2._id.toString(),
    enrollmentPeriodId: period._id.toString(),
    busId: bus._id,
    universityId: u1._id,
    status: 'WAITLISTED',
    filaPosition: 1,
    createdAt: new Date(Date.now() - 1000 * 60 * 30),
  });

  const waitB1 = await LicenseRequestModel.create({
    studentId: sB1._id.toString(),
    enrollmentPeriodId: period._id.toString(),
    busId: bus._id,
    universityId: u2._id,
    status: 'WAITLISTED',
    filaPosition: 1,
    createdAt: new Date(Date.now() - 1000 * 60 * 20),
  });

  // helper: aggregate counts by university
  async function aggregateCounts(enrollmentPeriodId: string, busId: Types.ObjectId) {
    const all = await LicenseRequestModel.find({ enrollmentPeriodId, busId }).lean().exec();
    const map: Record<string, { pending: number; waitlisted: number }> = {};
    all.forEach((r: any) => {
      const key = r.universityId.toString();
      if (!map[key]) map[key] = { pending: 0, waitlisted: 0 };
      if (r.status === 'PENDING') map[key].pending++;
      if (r.status === 'WAITLISTED') map[key].waitlisted++;
    });
    return map;
  }

  console.log('Initial license requests:');
  const before = await LicenseRequestModel.find({ enrollmentPeriodId: period._id.toString(), busId: bus._id }).lean().exec();
  console.table(before.map((r: any) => ({ id: r._id.toString(), status: r.status, universityId: r.universityId.toString(), filaPosition: r.filaPosition })));

  // Simulate releaseSlotsForBus logic (quantity = 1)
  async function releaseSlotsForBusSim(busDoc: any, enrollmentPeriodId: string, quantity = 1) {
    const countsMap = await aggregateCounts(enrollmentPeriodId, busDoc._id);
    const sortedSlots = (busDoc.universitySlots || []).slice().sort((a: any, b: any) => a.priorityOrder - b.priorityOrder);
    const sortedUniIds = sortedSlots.map((s: any) => s.universityId.toString());

    // find first active priority (pending OR waitlisted)
    let startIndex = -1;
    for (let i = 0; i < sortedUniIds.length; i++) {
      const key = sortedUniIds[i];
      const c = countsMap[key] || { pending: 0, waitlisted: 0 };
      if (c.pending + c.waitlisted > 0) {
        startIndex = i;
        break;
      }
    }
    if (startIndex === -1) return { promoted: 0 };

    let remaining = quantity;
    for (let i = startIndex; i < sortedUniIds.length && remaining > 0; i++) {
      const uniId = sortedUniIds[i];
      const counts = countsMap[uniId] || { pending: 0, waitlisted: 0 };

      // promote from this uni's waitlist if any
      if (counts.waitlisted > 0) {
        const candidates = await LicenseRequestModel.find({ enrollmentPeriodId, busId: busDoc._id, universityId: new Types.ObjectId(uniId), status: 'WAITLISTED' }).sort({ filaPosition: 1, createdAt: 1 }).limit(remaining).exec();
        const promoteIds = candidates.map((c: any) => c._id);
        if (promoteIds.length > 0) {
          await LicenseRequestModel.updateMany({ _id: { $in: promoteIds } }, { $set: { status: 'PENDING', filaPosition: null } }).exec();
          remaining -= promoteIds.length;
        }
      }

      // after promoting, recompute counts for this uni to decide whether to continue
      const afterCounts = await aggregateCounts(enrollmentPeriodId, busDoc._id);
      const thisCounts = afterCounts[uniId] || { pending: 0, waitlisted: 0 };
      if (thisCounts.pending + thisCounts.waitlisted > 0) {
        // still has demand in this uni -> stop and do not fallthrough
        break;
      }
      // else continue to next uni
    }
    return { promoted: quantity - remaining };
  }

  console.log('\nCalling simulated releaseSlotsForBus(quantity=1)');
  const res = await releaseSlotsForBusSim(bus, period._id.toString(), 1);
  console.log('Promoted count:', res.promoted);

  console.log('\nAfter simulated release, license requests:');
  const after = await LicenseRequestModel.find({ enrollmentPeriodId: period._id.toString(), busId: bus._id }).lean().exec();
  console.table(after.map((r: any) => ({ id: r._id.toString(), status: r.status, universityId: r.universityId.toString(), filaPosition: r.filaPosition })));

  await mongoose.disconnect();
  await mongod.stop();
  console.log('\nE2E dynamic-priority (simulation): finished');
}

main().catch((err) => {
  console.error('E2E script error', err);
  process.exit(1);
});
