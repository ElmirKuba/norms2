import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Раздел «Профиль» (сид; наполняется в F3.2/F3.3). */
@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.component.html',
})
export class ProfileComponent {}
