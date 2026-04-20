import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.component.config';
import { AppComponent } from './app/app.component';

const faviconHref = 'favicon.ico?v=8';
document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']").forEach((icon) => {
  icon.parentNode?.removeChild(icon);
});

[
  { rel: 'icon', type: 'image/x-icon' },
  { rel: 'shortcut icon', type: 'image/x-icon' },
  { rel: 'apple-touch-icon', type: 'image/x-icon' },
].forEach(({ rel, type }) => {
  const link = document.createElement('link');
  link.rel = rel;
  link.type = type;
  link.href = faviconHref;
  document.head.appendChild(link);
});

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
