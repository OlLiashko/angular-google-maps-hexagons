import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { CoordinateConversionService } from './services/coordinate-conversion.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { CoordinateCacheService } from './services/coordinate-cache.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    CoordinateConversionService,
    CoordinateCacheService
  ]
};
