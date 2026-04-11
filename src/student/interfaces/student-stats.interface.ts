export interface ShiftStats {
  morning: number;   // Manhã
  afternoon: number; // Tarde
  night: number;     // Noite
  fullTime: number;  // Integral (usa mais de um turno)
}

export interface DayUsageStats {
  SEG: number;
  TER: number;
  QUA: number;
  QUI: number;
  SEX: number;
}

export interface StudentDashboardStats {
  // Totais gerais
  totalStudents: number;

  // Status de carteirinha
  studentsWithCard: number;       // Têm photo (carteirinha emitida)
  studentsWithoutCard: number;    // Não têm photo nem schedule
  studentsWithPendingRequest: number; // Têm schedule mas não têm photo

  // Utilização do transporte
  transport: {
    byShift: ShiftStats;
    byDay: DayUsageStats;
    totalUsing: number; // Estudantes com ao menos um período no schedule
  };

  // Meta
  generatedAt: Date;
}