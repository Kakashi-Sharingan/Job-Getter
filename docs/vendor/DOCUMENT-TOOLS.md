# Document dependency provenance

- jsPDF 3.0.4, bundled as ESM with esbuild 0.25.12 from its npm package (`dist/jspdf.es.min.js`). jsPDF's MIT notice: JSPDF-LICENSE.txt. Transitive notices: jspdf.bundle.mjs.LEGAL.txt.
- PDF.js 4.10.38 (`pdfjs-dist/build/pdf.min.mjs` and `pdf.worker.min.mjs`), Apache 2.0: PDFJS-LICENSE.txt.
- Liberation Sans regular/bold TrueType fonts distributed as base64 for in-browser embedding. Source filenames LiberationSans-Regular.ttf / LiberationSans-Bold.ttf. Full distribution notice and embedding terms: LIBERATION-LICENSE.txt.

These assets are served from this repository. No resume data is sent to their upstream projects or a CDN at runtime. The source lockfiles for the document toolchain are in integrations/document-tools/.
