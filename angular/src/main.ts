import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((error: unknown): void => {
  // Точка входа приложения: ошибку bootstrap логируем в консоль браузера.
  console.error(error);
});
