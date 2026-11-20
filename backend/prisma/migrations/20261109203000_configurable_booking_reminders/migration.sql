-- Expand only: retain legacy kinds and every existing reminder.
ALTER TYPE "BookingReminderKind" ADD VALUE 'NOTICE_1';
ALTER TYPE "BookingReminderKind" ADD VALUE 'NOTICE_2';
ALTER TYPE "BookingReminderKind" ADD VALUE 'NOTICE_3';
