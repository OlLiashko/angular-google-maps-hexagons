import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { CoordinateCacheService } from './coordinate-cache.service';
import { Feature } from 'geojson';

@Injectable()
export class CoordinateConversionService {
  private readonly _http: HttpClient = inject(HttpClient);
  private readonly _coordinateCacheService: CoordinateCacheService = inject(CoordinateCacheService);

  aggregatedData: BehaviorSubject<Feature[]> = new BehaviorSubject([] as Feature[]);

  getData():Observable<Feature[]> {
    return this._http.get<Feature[]>('/assets/data.json')
      .pipe(
        tap(res => this.convertGeoJSON(res))
      );
  }

  convertGeoJSON(geoData: Feature[]) {
    if (typeof Worker !== 'undefined') {
      const worker = new Worker(new URL('./../convert.worker', import.meta.url));

      worker.postMessage(geoData);

      worker.onmessage = ({ data }) => {
        const convertedGeoJson: Feature[] = data.features;

        this._coordinateCacheService.processCache(convertedGeoJson);
        this.aggregatedData.next(convertedGeoJson);
      };
    } else {
      console.error('Web Workers are not supported in this environment.');
    }
  }
}
