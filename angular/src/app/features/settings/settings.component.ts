import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Раздел «Настройки» (сид; наполняется в F3.7). */
@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.component.html',
})
export class SettingsComponent {}
