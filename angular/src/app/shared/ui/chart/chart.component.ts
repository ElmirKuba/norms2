import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input } from '@angular/core';
import {
  NgApexchartsModule,
  type ApexAnnotations,
  type ApexAxisChartSeries,
  type ApexChart,
  type ApexDataLabels,
  type ApexGrid,
  type ApexMarkers,
  type ApexStroke,
  type ApexTooltip,
  type ApexXAxis,
  type ApexYAxis,
} from 'ng-apexcharts';

/** Точка ряда: x (метка/дата/число) + y (значение). */
export interface ChartPoint {
  /** Ось X: ISO-дата `YYYY-MM-DD`, число или категория. */
  x: string | number;
  /** Ось Y: значение. */
  y: number;
}

/**
 * Обёртка над ApexCharts (ADR-0055) — ЕДИНСТВЕННОЕ место, знающее про `apexcharts`/
 * `ng-apexcharts`. Остальной код работает только с нашим контрактом (`points`/`unit`/`type`),
 * поэтому движок заменяем без касания вызывающих экранов. Тема берётся из наших CSS-переменных
 * (линия — `--color-accent`, оси/сетка — `--color-border`/`--color-text-muted`), чтобы график
 * не разъезжался с дизайн-языком (ADR-0025) и работал в обеих темах.
 */
@Component({
  selector: 'app-chart',
  imports: [NgApexchartsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <apx-chart
      [series]="series()"
      [chart]="chart()"
      [xaxis]="xaxis()"
      [yaxis]="yaxis()"
      [colors]="colors()"
      [stroke]="stroke"
      [markers]="markers"
      [grid]="grid()"
      [annotations]="annotations()"
      [tooltip]="tooltip()"
      [dataLabels]="dataLabels"
    />
  `,
})
export class ChartComponent {
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Точки ряда (по возрастанию X). */
  public readonly points = input.required<ChartPoint[]>();
  /** Единица значения (для подписи оси Y и тултипа). */
  public readonly unit = input('');
  /** Имя ряда (легенда/тултип). */
  public readonly seriesName = input('Прогресс');
  /** Тип графика. */
  public readonly type = input<'line' | 'area'>('line');
  /** Высота, px. */
  public readonly height = input(220);
  /** Тип оси X. */
  public readonly xType = input<'datetime' | 'category' | 'numeric'>('datetime');
  /** Коридор (для «Удерживать»): закрашенная зона между нижней/верхней границей. null — нет. */
  public readonly corridor = input<{ lower: number; upper: number } | null>(null);

  /**
   * Ряд для ApexCharts. Для `category`-оси — ПРОСТЫЕ y-значения (разнос по индексу; метки-даты
   * в `xaxis.categories`), иначе точки `{x,y}` схлопнулись бы при одинаковых датах. Для
   * datetime/numeric — пары `{x,y}`.
   */
  protected readonly series = computed<ApexAxisChartSeries>(() => {
    const pts = this.points();
    if (this.xType() === 'category') {
      return [{ name: this.seriesName(), data: pts.map((p) => p.y) }];
    }
    return [{ name: this.seriesName(), data: pts.map((p) => ({ x: p.x, y: p.y })) }];
  });

  /** Опции холста (зум/тулбар, прозрачный фон, наш шрифт). */
  protected readonly chart = computed<ApexChart>(() => ({
    type: this.type(),
    height: this.height(),
    fontFamily: 'inherit',
    background: 'transparent',
    // Зум включён даже для line-графика (в demo ApexCharts он по умолчанию выключен): по X,
    // с авто-масштабом Y — удобно разглядывать участок динамики.
    zoom: { enabled: true, type: 'x', autoScaleYaxis: true },
    animations: { enabled: true },
    toolbar: {
      show: true,
      tools: { download: false, selection: true, pan: true, reset: true, zoomin: true, zoomout: true, zoom: true },
    },
  }));

  /** Цвет линии — наш акцент. */
  protected readonly colors = computed<string[]>(() => [this._cssVar('--color-accent', '#c2703d')]);

  /** Линия (прямая). */
  protected readonly stroke: ApexStroke = { curve: 'straight', width: 2 };
  /** Видимые точки-маркеры (чтобы при малом числе/одинаковых датах данные были видны). */
  protected readonly markers: ApexMarkers = { size: 4, strokeWidth: 0, hover: { sizeOffset: 2 } };
  /** Подписи значений на точках — выкл. */
  protected readonly dataLabels: ApexDataLabels = { enabled: false };

  /**
   * Ось X. Для `category` — метки берём из `categories` (по индексу, могут повторяться при
   * замерах в один день); даты `YYYY-MM-DD` сокращаем до `DD.MM`. Цвета — из темы.
   */
  protected readonly xaxis = computed<ApexXAxis>(() => {
    const base: ApexXAxis = {
      type: this.xType(),
      labels: {
        style: { colors: this._cssVar('--color-text-muted', '#888888') },
        hideOverlappingLabels: true,
        formatter: (value: string): string => this._fmtX(value),
      },
      axisBorder: { color: this._cssVar('--color-border', '#dddddd') },
      axisTicks: { color: this._cssVar('--color-border', '#dddddd') },
      tooltip: { enabled: false },
    };
    if (this.xType() === 'category') {
      base.categories = this.points().map((p) => String(p.x));
    }
    return base;
  });

  /** Ось Y с единицей. */
  protected readonly yaxis = computed<ApexYAxis>(() => ({
    labels: {
      style: { colors: this._cssVar('--color-text-muted', '#888888') },
      formatter: (v: number): string => this._withUnit(v),
    },
  }));

  /** Сетка пунктиром в цвет границы. */
  protected readonly grid = computed<ApexGrid>(() => ({
    borderColor: this._cssVar('--color-border', '#eeeeee'),
    strokeDashArray: 4,
  }));

  /**
   * Аннотации: для «Удерживать» — закрашенная зона-коридор между нижней/верхней границей
   * (видно, попадают ли замеры в коридор). Без коридора — пусто.
   */
  protected readonly annotations = computed<ApexAnnotations>(() => {
    const c = this.corridor();
    if (c === null) {
      return {};
    }
    const accent = this._cssVar('--color-accent', '#c2703d');
    return {
      yaxis: [
        {
          y: c.lower,
          y2: c.upper,
          fillColor: accent,
          opacity: 0.1,
          borderColor: this._cssVar('--color-border', '#dddddd'),
          label: {
            text: `коридор ${this._withUnit(c.lower)}–${this._withUnit(c.upper)}`,
            position: 'left',
            textAnchor: 'start',
            style: {
              color: this._cssVar('--color-text-muted', '#888888'),
              background: 'transparent',
              fontSize: '11px',
            },
          },
        },
      ],
    };
  });

  /** Тултип со значением + единицей. */
  protected readonly tooltip = computed<ApexTooltip>(() => ({
    theme: 'dark',
    y: { formatter: (v: number): string => this._withUnit(v) },
  }));

  /** Подпись оси X: дату `YYYY-MM-DD` сокращает до `DD.MM`, остальное — как есть. */
  private _fmtX(value: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return m ? `${m[3]}.${m[2]}` : value;
  }

  /** Добавляет единицу к числу (если задана). */
  private _withUnit(v: number): string {
    const n = Number.isInteger(v) ? String(v) : v.toFixed(1);
    return this.unit() ? `${n} ${this.unit()}` : n;
  }

  /** Читает CSS-переменную темы с хоста (фолбэк — на случай отсутствия). */
  private _cssVar(name: string, fallback: string): string {
    const value = getComputedStyle(this._host.nativeElement).getPropertyValue(name).trim();
    return value || fallback;
  }
}
