
import { Injectable } from '@nestjs/common';
import { Student } from '../schemas/student.schema';
import {
  StudentDashboardStats,
  ShiftStats,
  DayUsageStats,
} from '../interfaces/student-stats.interface';
import { Shift } from '../../common/interfaces/student-attributes.enum';


@Injectable()
export class StudentStatsVisitor {
  // ── Contadores internos ──────────────────────────────────────
  private total = 0;
  private withCard = 0;
  private pendingRequest = 0;

  private shiftCounts: Record<string, number> = {
    [Shift.MORNING]: 0,
    [Shift.AFTERNOON]: 0,
    [Shift.NIGHT]: 0,
    [Shift.FULL_TIME]: 0,
  };

  private dayCounts: DayUsageStats = {
    SEG: 0,
    TER: 0,
    QUA: 0,
    QUI: 0,
    SEX: 0,
  };

  private totalUsingTransport = 0;

  // ────────────────────────────────────────────────────────────

  /**
   * Visita um estudante e acumula suas estatísticas.
   * Deve ser chamado uma vez por estudante.
   */
  visit(student: Student): void {
    this.total++;
    this.accumulateCardStatus(student);
    this.accumulateTransportUsage(student);
  }

  // ── Carteirinha ──────────────────────────────────────────────

  private accumulateCardStatus(student: Student): void {
    const hasPhoto = !!student.photo;
    const hasSchedule = student.schedule?.length > 0;

    if (hasPhoto) {
      // Carteirinha já emitida
      this.withCard++;
    } else if (hasSchedule) {
      // Solicitou (enviou grade) mas ainda não tem foto/carteirinha
      this.pendingRequest++;
    }
    // Caso contrário: sem carteirinha e sem solicitação — contado via "withoutCard" no getter
  }

  // ── Transporte ───────────────────────────────────────────────

  private accumulateTransportUsage(student: Student): void {
    const schedule = student.schedule;
    if (!schedule?.length) return;

    this.totalUsingTransport++;
    this.accumulateShift(student.shift);
    this.accumulateDays(schedule);
  }

  private accumulateShift(shift: Shift | undefined): void {
    if (!shift || !(shift in this.shiftCounts)) return;
    this.shiftCounts[shift]++;
  }

  private accumulateDays(
    schedule: { day: string; period: string }[],
  ): void {
    // Dias únicos por estudante (evita contar o mesmo dia duas vezes
    // caso o estudante use manhã e tarde num mesmo dia)
    const uniqueDays = new Set(schedule.map((s) => s.day));

    for (const day of uniqueDays) {
      if (day in this.dayCounts) {
        this.dayCounts[day as keyof DayUsageStats]++;
      }
    }
  }

  // ── Resultado ────────────────────────────────────────────────

  /**
   * Retorna o snapshot consolidado das estatísticas.
   * Pode ser chamado a qualquer momento após uma ou mais visitas.
   */
  getResult(): StudentDashboardStats {
    const withoutCard = this.total - this.withCard - this.pendingRequest;

    const byShift: ShiftStats = {
      morning: this.shiftCounts[Shift.MORNING],
      afternoon: this.shiftCounts[Shift.AFTERNOON],
      night: this.shiftCounts[Shift.NIGHT],
      fullTime: this.shiftCounts[Shift.FULL_TIME],
    };

    return {
      totalStudents: this.total,
      studentsWithCard: this.withCard,
      studentsWithoutCard: withoutCard,
      studentsWithPendingRequest: this.pendingRequest,
      transport: {
        byShift,
        byDay: { ...this.dayCounts },
        totalUsing: this.totalUsingTransport,
      },
      generatedAt: new Date(),
    };
  }

  /**
   * Reinicia todos os contadores.
   * Útil para reutilizar a instância em ciclos subsequentes
   * (ex.: jobs agendados).
   */
  reset(): void {
    this.total = 0;
    this.withCard = 0;
    this.pendingRequest = 0;
    this.totalUsingTransport = 0;

    for (const key of Object.keys(this.shiftCounts)) {
      this.shiftCounts[key] = 0;
    }

    const days: (keyof DayUsageStats)[] = ['SEG', 'TER', 'QUA', 'QUI', 'SEX'];
    for (const day of days) {
      this.dayCounts[day] = 0;
    }
  }
}