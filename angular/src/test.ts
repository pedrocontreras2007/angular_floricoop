import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

beforeAll(() =>
  getTestBed().initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting(),
  ),
);

const context = (import.meta as unknown as {
  webpackContext: (
    request: string,
    options: { recursive: boolean; regExp: RegExp }
  ) => {
    keys(): string[];
    <T>(id: string): T;
  };
}).webpackContext('./', { recursive: true, regExp: /\.spec\.ts$/ });

// Carga de forma explícita todos los archivos *.spec.ts para que Jasmine registre los tests.
context.keys().forEach(context);
