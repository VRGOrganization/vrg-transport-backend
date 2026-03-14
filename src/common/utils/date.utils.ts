const TZ_OFFSET = -3; // UTC-3 (America/Sao_Paulo)

export const nowInBR = (): Date => {
  const now = new Date();
  return new Date(now.getTime() + TZ_OFFSET * 60 * 60 * 1000);
};

export const addMonthsBR = (date: Date, months: number): Date => {
  const brDate = new Date(date.getTime() + TZ_OFFSET * 60 * 60 * 1000);
  brDate.setUTCMonth(brDate.getUTCMonth() + months);
  return brDate;
};