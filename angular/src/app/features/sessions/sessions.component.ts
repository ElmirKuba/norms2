import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Раздел «Устройства/сессии» (сид; наполняется в F3.6). */
@Component({
  selector: 'app-sessions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sessions.component.html',
})
export class SessionsComponent {}
