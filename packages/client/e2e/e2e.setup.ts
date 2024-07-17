import { test as base, expect } from '@playwright/test';
import type { MockServiceWorker } from 'playwright-msw';
import { createWorkerFixture } from 'playwright-msw';
import { handlers } from '../mocks/handlers';

const test = base.extend<{
  worker: MockServiceWorker;
}>({
  worker: createWorkerFixture(handlers, { graphqlUrl: 'https://flyby-router-demo.herokuapp.com/' }),
});

export { expect, test };
