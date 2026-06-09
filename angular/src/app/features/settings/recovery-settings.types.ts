// Зеркало подмножества контракта recovery-settings (не шарится с бэком).

/** Секретный вопрос (`GET /recovery/questions`) — без ответа/хеша. */
export interface SecretQaView {
  /** PK вопроса. */
  id: string;
  /** Текст вопроса. */
  question: string;
}
