import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MonthlyAvg } from './profile.types';

interface ChartPoint { x: number; y: number; }
interface MonthLabel { label: string; pct: number; }

@Component({
  selector: 'app-profile-trend-chart',
  templateUrl: './profile-trend-chart.component.html',
  styleUrls: ['./profile-trend-chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileTrendChartComponent {
  @Input() isLoading = false;

  @Input() set data(value: MonthlyAvg[]) {
    this._data = value ?? [];
    this.buildChart();
  }
  private _data: MonthlyAvg[] = [];

  linePoints = '';
  areaPoints = '';
  chartPoints: ChartPoint[] = [];
  monthLabels: MonthLabel[] = [];

  get hasEnoughData(): boolean {
    return this._data.length >= 2;
  }

  private buildChart(): void {
    const n = this._data.length;
    if (n < 2) {
      this.chartPoints = [];
      this.linePoints = '';
      this.areaPoints = '';
      this.monthLabels = [];
      return;
    }

    // SVG viewBox is 0 0 310 86
    // Y: 10.0 maps to y=0 (top), 0.0 maps to y=86 (bottom)
    const xOf = (i: number) => parseFloat(((i / (n - 1)) * 310).toFixed(2));
    const yOf = (s: number) => parseFloat((86 - (s / 10) * 86).toFixed(2));

    this.chartPoints = this._data.map((d, i) => ({ x: xOf(i), y: yOf(d.avgScore) }));
    this.linePoints = this.chartPoints.map(p => `${p.x},${p.y}`).join(' ');

    const first = this.chartPoints[0];
    const last  = this.chartPoints[n - 1];
    this.areaPoints = [
      `${first.x},86`,
      ...this.chartPoints.map(p => `${p.x},${p.y}`),
      `${last.x},86`,
    ].join(' ');

    this.monthLabels = this._data.map((d, i) => ({
      label: d.label,
      pct: i / (n - 1),
    }));
  }
}
