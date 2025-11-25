export interface Reminder {
  readonly id: string;
  readonly title: string;
  readonly scheduledAt: Date;
  readonly note?: string;
}

export interface ReminderInput {
  readonly title: string;
  readonly scheduledAt: Date;
  readonly note?: string;
}
