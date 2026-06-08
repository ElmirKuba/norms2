import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';

/** Данные, передаваемые в crop-модалку. */
export interface AvatarCropData {
  /** Исходный файл, выбранный пользователем. */
  file: File;
}

/** Сторона квадратного viewport (CSS-пиксели). */
const VIEWPORT = 320;
/** Сторона итогового квадрата (отправляется на бэк). */
const OUTPUT = 512;
/** Максимальный зум. */
const MAX_ZOOM = 4;
/** Качество JPEG на выходе. */
const JPEG_QUALITY = 0.9;

/**
 * Модалка кропа аватара (свой canvas, ADR-0042). Квадратный viewport под круглый
 * аватар: pan (drag pointer-ами) + zoom (слайдер, центр сохраняется). Изображение
 * всегда покрывает viewport (cover-scale × zoom + клэмп смещения). На «Сохранить»
 * рендерит видимый квадрат в `OUTPUT×OUTPUT` и закрывает диалог с `Blob` (jpeg);
 * отмена/закрытие — `null`.
 */
@Component({
  selector: 'app-avatar-crop-modal',
  imports: [ButtonComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './avatar-crop-modal.component.html',
  styleUrl: './avatar-crop-modal.component.scss',
})
export class AvatarCropModalComponent {
  private readonly _ref =
    inject<MatDialogRef<AvatarCropModalComponent, Blob | null>>(MatDialogRef);
  private readonly _data = inject<AvatarCropData>(MAT_DIALOG_DATA);
  private readonly _canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  /** Сторона viewport (для шаблона). */
  protected readonly viewport = VIEWPORT;
  /** Текущий зум (для слайдера). */
  protected readonly zoom = signal(1);
  /** Идёт декодирование изображения. */
  protected readonly loading = signal(true);
  /** Ошибка открытия файла. */
  protected readonly error = signal<string | null>(null);

  private readonly _img = new Image();
  private _naturalW = 0;
  private _naturalH = 0;
  private _coverScale = 1;
  private _offsetX = 0;
  private _offsetY = 0;
  private _dragging = false;
  private _lastX = 0;
  private _lastY = 0;
  private _imageReady = false;

  public constructor() {
    const url = URL.createObjectURL(this._data.file);
    this._img.onload = (): void => {
      this._naturalW = this._img.naturalWidth;
      this._naturalH = this._img.naturalHeight;
      this._coverScale = Math.max(VIEWPORT / this._naturalW, VIEWPORT / this._naturalH);
      this._centerImage();
      this._imageReady = true;
      this.loading.set(false);
      URL.revokeObjectURL(url);
      this._draw();
    };
    this._img.onerror = (): void => {
      this.error.set('Не удалось открыть изображение.');
      this.loading.set(false);
      URL.revokeObjectURL(url);
    };
    this._img.src = url;
    // Первый рендер canvas — на случай, если картинка уже декодировалась.
    afterNextRender(() => this._draw());
  }

  /** Начинает перетаскивание. */
  protected onPointerDown(event: PointerEvent): void {
    if (!this._imageReady) {
      return;
    }
    this._dragging = true;
    this._lastX = event.clientX;
    this._lastY = event.clientY;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  /** Двигает изображение. */
  protected onPointerMove(event: PointerEvent): void {
    if (!this._dragging) {
      return;
    }
    this._offsetX += event.clientX - this._lastX;
    this._offsetY += event.clientY - this._lastY;
    this._lastX = event.clientX;
    this._lastY = event.clientY;
    this._clamp();
    this._draw();
  }

  /** Завершает перетаскивание. */
  protected onPointerUp(): void {
    this._dragging = false;
  }

  /** Меняет зум, сохраняя точку в центре viewport. */
  protected onZoom(event: Event): void {
    const next = (event.target as HTMLInputElement).valueAsNumber;
    if (!this._imageReady || Number.isNaN(next)) {
      return;
    }
    const oldEff = this._coverScale * this.zoom();
    const centerX = (VIEWPORT / 2 - this._offsetX) / oldEff;
    const centerY = (VIEWPORT / 2 - this._offsetY) / oldEff;
    this.zoom.set(next);
    const newEff = this._coverScale * next;
    this._offsetX = VIEWPORT / 2 - centerX * newEff;
    this._offsetY = VIEWPORT / 2 - centerY * newEff;
    this._clamp();
    this._draw();
  }

  /** Максимум зума (для слайдера). */
  protected get maxZoom(): number {
    return MAX_ZOOM;
  }

  /** Рендерит видимый квадрат и закрывает модалку с Blob. */
  protected confirm(): void {
    if (!this._imageReady) {
      return;
    }
    const eff = this._coverScale * this.zoom();
    const sx = -this._offsetX / eff;
    const sy = -this._offsetY / eff;
    const sSize = VIEWPORT / eff;

    const out = document.createElement('canvas');
    out.width = OUTPUT;
    out.height = OUTPUT;
    const ctx = out.getContext('2d');
    if (ctx === null) {
      this._ref.close(null);
      return;
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);
    ctx.drawImage(this._img, sx, sy, sSize, sSize, 0, 0, OUTPUT, OUTPUT);
    out.toBlob((blob) => this._ref.close(blob), 'image/jpeg', JPEG_QUALITY);
  }

  /** Закрывает модалку без результата. */
  protected cancel(): void {
    this._ref.close(null);
  }

  /** Центрирует изображение в viewport при текущем эффективном масштабе. */
  private _centerImage(): void {
    const eff = this._coverScale * this.zoom();
    this._offsetX = (VIEWPORT - this._naturalW * eff) / 2;
    this._offsetY = (VIEWPORT - this._naturalH * eff) / 2;
  }

  /** Ограничивает смещение так, чтобы изображение всегда покрывало viewport. */
  private _clamp(): void {
    const eff = this._coverScale * this.zoom();
    const dw = this._naturalW * eff;
    const dh = this._naturalH * eff;
    this._offsetX = Math.min(0, Math.max(VIEWPORT - dw, this._offsetX));
    this._offsetY = Math.min(0, Math.max(VIEWPORT - dh, this._offsetY));
  }

  /** Перерисовывает canvas. */
  private _draw(): void {
    const canvasRef = this._canvas();
    if (canvasRef === undefined || !this._imageReady) {
      return;
    }
    const ctx = canvasRef.nativeElement.getContext('2d');
    if (ctx === null) {
      return;
    }
    const eff = this._coverScale * this.zoom();
    ctx.clearRect(0, 0, VIEWPORT, VIEWPORT);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, VIEWPORT, VIEWPORT);
    ctx.drawImage(this._img, this._offsetX, this._offsetY, this._naturalW * eff, this._naturalH * eff);
  }
}
