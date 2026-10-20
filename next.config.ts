import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * La app es estática y no habla con ningún servicio externo, así que todo
 * puede quedarse en 'self'. Las fuentes las sirve el propio build
 * (`next/font/google` las descarga al compilar), y `/catalog/<sección>` es
 * del mismo origen, de modo que no hace falta abrir nada más.
 *
 * `script-src` necesita 'unsafe-inline' porque Next y `next-themes` inyectan
 * scripts en línea sin nonce —el nonce obligaría a renderizar en cada
 * petición y perderíamos el prerenderizado—. Con eso, lo que de verdad
 * aportan estas cabeceras es `frame-ancestors`, `object-src` y `base-uri`,
 * no tanto la protección contra XSS.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // Sólo se aplican cuando sirve el servidor de Next (`next start`); detrás de
  // un CDN o un hosting de archivos estáticos hay que configurarlas allí.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
