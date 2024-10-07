import { inject, Injectable, NgZone } from '@angular/core';
import geojson2h3 from 'geojson2h3';
import { Feature } from 'geojson';

@Injectable({
  providedIn: 'root'
})
export class CoordinateCacheService {
  commonZoom: Map<number, Feature[]> = new Map();

  private readonly _zone: NgZone = inject(NgZone);

  processCache(convertedGeoJson: Feature[]): void {
    this._zone.runOutsideAngular(() => {
      for (let a = 0; a < 5; a++) {
        let set: any[] = [];

        convertedGeoJson.forEach((el: Feature) => {
          const hexagons = geojson2h3.featureToH3Set(el, a+1);
          let feature = geojson2h3.h3SetToMultiPolygonFeature(hexagons);

          feature = {
            ...feature, properties: el.properties,
          }

          set = [...set, feature];
        })

        this.commonZoom.set(a, set);
      }
    });
  }
}
