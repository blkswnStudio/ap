// self.addEventListener('install', (event) => {
//   // Activate immediately after installation
//   self.skipWaiting();
// });

// self.addEventListener('activate', (event) => {
//   // Claim all clients immediately
//   event.waitUntil(self.clients.claim());
// });

// self.addEventListener('fetch', (event) => {
//   // Intercept requests and modify headers
//   if (event.request.url.includes('/fonts/') || event.request.url.includes('/charting_library/')) {
//     const modifiedHeaders = new Headers(event.request.headers);
//     modifiedHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');

//     const modifiedRequest = new Request(event.request, {
//       headers: modifiedHeaders,
//     });

//     event.respondWith(fetch(modifiedRequest));
//   } else {
//     event.respondWith(fetch(event.request));
//   }
// });
