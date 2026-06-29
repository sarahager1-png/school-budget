import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Per-school branding: one codebase, one build per school.
// The school display name is injected at build time from VITE_SCHOOL_NAME
// into both the <title> (index.html) and the PWA manifest, replacing the
// __SCHOOL_NAME__ token. Default keeps the original מזכרת בתיה behaviour so a
// plain `vite build` is unchanged.
function schoolBranding(schoolName) {
  return {
    name: 'school-branding',
    transformIndexHtml(html) {
      return html.split('__SCHOOL_NAME__').join(schoolName);
    },
    closeBundle() {
      const manifestPath = path.resolve('dist/manifest.webmanifest');
      if (fs.existsSync(manifestPath)) {
        const updated = fs
          .readFileSync(manifestPath, 'utf8')
          .split('__SCHOOL_NAME__')
          .join(schoolName);
        fs.writeFileSync(manifestPath, updated);
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const schoolName = env.VITE_SCHOOL_NAME || 'שלהבות מזכרת בתיה';
  return {
    plugins: [react(), schoolBranding(schoolName)],
    base: './',
  };
});
