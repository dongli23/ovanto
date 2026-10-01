/**
 * Boundary consumed by the paid generation worker. The worker supplies the
 * authenticated account and optional checkout scope; this module owns all
 * credit/account SQL and never exposes email or payment details to jobs.
 */
export {
  finalizePaidCredit,
  getPaidJob,
  getPaidSessionByToken,
  releasePaidCredit,
  reservePaidCredit,
  updatePaidJobProvider,
  type PaidBalance,
  type PaidJobRecord,
  type PaidSession,
  type ReservePaidResult,
} from "./store";
export { getPaidSession } from "../accounts/store";

