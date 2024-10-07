import { Component, DestroyRef, inject, NgZone, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GoogleMap } from '@angular/google-maps';
import { CoordinateConversionService } from './services/coordinate-conversion.service';
import { debounceTime, distinctUntilChanged, filter, Observable, tap } from 'rxjs';
import geojson2h3 from 'geojson2h3';
import { CoordinateCacheService } from './services/coordinate-cache.service';
import { NgxLoadingModule } from '@dchtools/ngx-loading-v18';
import { Feature, GeoJsonProperties, MultiPolygon, Polygon } from 'geojson';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, GoogleMap, NgxLoadingModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  options: google.maps.MapOptions = {
    mapId: 'DEMO_MAP_ID',
    center: { lat: 39, lng: 26 },
    zoom: 4,
    maxZoom: 7
  };

  map!: google.maps.Map;
  items: Feature[] = [];
  zoom?: number;
  layers: google.maps.Polygon[] = [];
  removedPolygons: google.maps.Polygon[] = [];
  loading = true;

  private readonly _coordinateConversion = inject(CoordinateConversionService);
  private readonly _cacheService = inject(CoordinateCacheService);
  private readonly _zone = inject(NgZone);
  private readonly _destroy: DestroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this._coordinateConversion.getData().subscribe();
  }

  onMapReady(map: google.maps.Map): void {
    this.map = map;

    this._coordinateConversion.aggregatedData
      .pipe(
        filter(data => data?.length > 0),
        takeUntilDestroyed(this._destroy)
      )
      .subscribe(res => {
        this.items = res;
        this.zoom = map.getZoom();
        this.renderHexagons(this.items);
      });

    this.handleZoomChanges();
    this.handlePolygonVisibilityChanges();
  }

  private handleZoomChanges() {
    const zoomChanged$ = new Observable(observer => {
      const listener = this.map.addListener('zoom_changed', () => {
        this.removedPolygons = [];
        this.zoom = this.map.getZoom();
        observer.next(this.zoom);
      });
      return () => listener.remove();
    });

    zoomChanged$
      .pipe(
        tap(() => this.removeLayers()),
        distinctUntilChanged(),
        debounceTime(800),
        tap(() => this.renderHexagons(this.items)),
        takeUntilDestroyed(this._destroy)
      )
      .subscribe();
  }

  private handlePolygonVisibilityChanges() {
    const polygonChanged$ = new Observable(observer => {
      const listener = this.map.addListener('bounds_changed', () => {
        observer.next();
      });
      return () => listener.remove();
    });

    polygonChanged$
      .pipe(
        tap(() => this.checkPolygonVisibility()),
        takeUntilDestroyed(this._destroy)
      )
      .subscribe();
  }

  private renderHexagons(elements: Feature[]): void {
    const currentZoom = this.zoom && this.zoom >= 2 ? this.zoom - 2 : 0;

    this._zone.runOutsideAngular(() => {
      const cachedZoomData = this._cacheService.commonZoom.get(currentZoom);

      if (cachedZoomData?.length) {
        this.loadCachedPolygons(cachedZoomData);
      } else {
        const cache: Feature[] = [];

        elements.forEach((response: Feature) => {
          const hexagons = geojson2h3.featureToH3Set(response, currentZoom);
          const feature = geojson2h3.h3SetToMultiPolygonFeature(hexagons);
          const cachedFeature = { ...feature, properties: response.properties };

          cache.push(cachedFeature);
          this.createPolygonFromFeature(feature, response.properties);
        });

        this._cacheService.commonZoom.set(currentZoom, cache);
        this.loading = false;
      }
    });
  }

  private createPolygonFromFeature(feature: Feature, properties: GeoJsonProperties): void {
    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
      const polygonGeometry = feature.geometry as Polygon | MultiPolygon;

      polygonGeometry.coordinates.forEach((polygonCoords: any) => {
        const paths = polygonCoords[0].map((coord: any) => ({ lat: coord[1], lng: coord[0] }));

        // @ts-ignore
        const color = properties['COLOR_HEX'];

        const hexagonPolygon = new google.maps.Polygon({
          paths,
          strokeColor: '#000000',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#' + color,
          fillOpacity: 0.4,
        });

        hexagonPolygon.setMap(this.map);
        this.layers.push(hexagonPolygon);
        this.loading = false;
      });
    }
  }

  private loadCachedPolygons(cachedData: any[]): void {
    cachedData.forEach(feature => {
      feature.geometry.coordinates.forEach((polygonCoords: any) => {
        const paths = polygonCoords[0].map((coord: any) => ({ lat: coord[1], lng: coord[0] }));

        const polygon = new google.maps.Polygon({
          paths,
          strokeColor: '#000000',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#' + feature.properties.COLOR_HEX,
          fillOpacity: 0.6,
        });

        polygon.setMap(this.map);
        this.layers.push(polygon);
        this.loading = false;
      });
    });
  }

  private removeLayers(): void {
    this.layers.forEach(layer => layer.setMap(null));
    this.layers = [];
  }

  private checkPolygonVisibility(): void {
    const bounds = this.map.getBounds();
    if (!bounds) return;

    this.layers.forEach((polygon) => {
      const polygonBounds = new google.maps.LatLngBounds();
      polygon.getPath().forEach(latLng => polygonBounds.extend(latLng));

      if (!bounds.intersects(polygonBounds)) {
        polygon.setMap(null);
        this.removedPolygons.push(polygon);
      }
    });

    this.removedPolygons.forEach((polygon, index) => {
      const polygonBounds = new google.maps.LatLngBounds();
      polygon.getPath().forEach(latLng => polygonBounds.extend(latLng));

      if (bounds.intersects(polygonBounds)) {
        polygon.setMap(this.map);
        this.removedPolygons.splice(index, 1);  // Remove from removed array
      }
    });
  }
}
