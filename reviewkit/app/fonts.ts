import localFont from "next/font/local";

/**
 * Fonts are self-hosted, not loaded from Google. That keeps UK and EEA visitors'
 * IP addresses out of a third party's logs, which is one less thing the privacy
 * policy has to disclose, and it removes a render-blocking third-party request.
 *
 * Files came from the Fontsource npm packages and are licensed under the SIL Open
 * Font Licence. The licence texts sit beside them in app/fonts/ and must stay there.
 * To refresh:
 *   npm i --no-save @fontsource-variable/instrument-sans @fontsource-variable/newsreader
 *   cp node_modules/@fontsource-variable/<name>/files/<name>-latin-wght-*.woff2 app/fonts/
 */

/** Instrument Sans. Headlines, numbers, interface. Weight axis 400 to 700. */
export const sans = localFont({
  src: [
    {
      path: "./fonts/instrument-sans-latin-variable.woff2",
      weight: "400 700",
      style: "normal",
    },
  ],
  variable: "--font-sans-local",
  display: "swap",
  preload: true,
  fallback: [
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
});

/** Newsreader. Long-form review prose. Weight axis 200 to 800, with true italics. */
export const serif = localFont({
  src: [
    {
      path: "./fonts/newsreader-latin-variable.woff2",
      weight: "200 800",
      style: "normal",
    },
    {
      path: "./fonts/newsreader-latin-variable-italic.woff2",
      weight: "200 800",
      style: "italic",
    },
  ],
  variable: "--font-serif-local",
  display: "swap",
  preload: true,
  fallback: ["Iowan Old Style", "Palatino", "Georgia", "serif"],
});
