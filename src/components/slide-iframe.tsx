"use client";

import React, { forwardRef } from 'react';

interface SlideIframeProps {
  content: string;
  title: string;
}

export const SlideIframe = forwardRef<HTMLIFrameElement, SlideIframeProps>(({ content, title }, ref) => {
  const fullHtml = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" integrity="sha384-n8MVd4RsNIU0KOVwMdaWchfnUqk1oTRClBpsJÁBDEa9r+ppPHzSMDBwdLddDqM2A" crossorigin="anonymous">
          <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js" integrity="sha384-XjKyOOlGwcjNTAIQHIpgOno0Hl1YQqzOKmrUxK3RETHeao1Nc_ahaxKMLvilv8yG" crossorigin="anonymous"></script>
          <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js" integrity="sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05" crossorigin="anonymous"></script>
          <style>
            *, *::before, *::after {
              box-sizing: border-box;
            }
            html {
              overflow: auto;
            }
            body { 
              margin: 0;
              padding: 1.5rem;
              background-color: #111827; 
              color: #E5E7EB;
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6;
            }
            * {
              max-width: 100%;
            }
            a { color: #60A5FA; }
            a:visited { color: #A78BFA; }
          </style>
          <script>
              document.addEventListener("DOMContentLoaded", function() {
                  renderMathInElement(document.body, {
                      delimiters: [
                          {left: '$$', right: '$$', display: true},
                          {left: '$', right: '$', display: false},
                          {left: '\\(', right: '\\)', display: false},
                          {left: '\\[', right: '\\]', display: true}
                      ],
                      throwOnError : false
                  });
              });
          </script>
      </head>
      <body>
          ${content}
      </body>
      </html>
  `;

  return (
    <iframe
      ref={ref}
      srcDoc={fullHtml}
      title={title}
      className="w-full h-full border-0"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
    />
  );
});
SlideIframe.displayName = "SlideIframe";
