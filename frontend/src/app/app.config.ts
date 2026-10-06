import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  provideTaiga,
  tuiButtonOptionsProvider,
  tuiTextfieldOptionsProvider,
} from '@taiga-ui/core';

import { routes } from './app.routes';
import { errorInterceptor } from './core/api/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([errorInterceptor])),
    // Tema claro fixo: o app não tem modo escuro.
    provideTaiga({ mode: 'light' }),
    tuiButtonOptionsProvider({ size: 'm' }),
    // Sem botão de limpar: os campos voltam a vazio só apagando o texto, como antes.
    tuiTextfieldOptionsProvider({ cleaner: signal(false) }),
  ],
};
