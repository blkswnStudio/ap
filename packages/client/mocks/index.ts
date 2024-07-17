export default async function initMocks() {
  // This mock is for the server side of next. It is probably not needed any time soon (maybe SSG) but we still do the correct setup now.
  if (typeof window === 'undefined') {
    // TODO: Transpile problem in playwright tests. Not needed now anyways, call it conditionally in dev later.
    // const { server } = await import('./server');
    // server.listen({ onUnhandledRequest: 'bypass' });
  } else {
    // Mocks all client side request via the service worker
    const { worker } = await import('./browser');
    worker.start();
  }
}

// FIXME: Before shipping this whole thing make sure that the mock server is not in the bundle unnecessarily.
// We definetly dont want to load it on the client but its not super trivial to exclude it from the bundle.
