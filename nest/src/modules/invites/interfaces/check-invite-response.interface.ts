/** Ответ POST /invites/check — валиден ли код. */
export interface CheckInviteResponse {
  /** true, если код существует и не истёк. */
  valid: boolean;
}
