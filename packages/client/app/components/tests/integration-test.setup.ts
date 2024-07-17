import { Page } from '@playwright/test';
import { setupServer } from 'msw/node';
import 'whatwg-fetch';
import { handlers } from '../../../mocks/handlers';

export const makeFetchToMSW = async (
  postData: string | null,
  headers: {
    [key: string]: string;
  },
) => {
  try {
    const response = await fetch('https://flyby-router-demo.herokuapp.com/', {
      body: postData,
      method: 'POST',
      headers,
    });

    return response;
  } catch (error) {
    // FIXME: This currently fails in Debug mode because the server doesnt seem to be set up properly
    console.error(error);
  }
};

export const integrationSuiteSetup = () => {
  const server = setupServer(...handlers);
  server.listen();

  return server;
};

export const integrationTestSetup = async (page: Page) => {
  await page.route('http://localhost:8000/subgraphs/name/subgraph', async (route) => {
    const mswResponse = await makeFetchToMSW(route.request().postData(), route.request().headers());

    // FIXME: This currently fails in Debug mode because the server doesnt seem to be set up properly
    if (!mswResponse) {
      return route.abort();
    }

    return route.fulfill({
      status: mswResponse!.status,
      body: await mswResponse!.text(),
    });
  });
};
