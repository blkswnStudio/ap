import { expect, test } from '@playwright/experimental-ct-react';
import { SetupServer } from 'msw/node';
import Assets from '../Features/Assets/Assets';
import { integrationSuiteSetup, integrationTestSetup } from './integration-test.setup';
import MockedPoolsData from './mockedResponses/GetAllPools.mocked.json';
import MockedDebtTokens from './mockedResponses/GetBorrowerDebtTokens.mocked.json';
import { IntegrationWrapper } from './test-utils';

let server: SetupServer;

test.beforeAll(() => {
  server = integrationSuiteSetup();
});

test.beforeEach(async ({ page }) => {
  await integrationTestSetup(page);
});

test.afterEach(() => {
  server.resetHandlers();
});

test.afterAll(() => {
  server.close();
});

test.describe('Assets', () => {
  test('should render Assets with mocked data', async ({ mount, page }) => {
    // We need to mock the exact same data to generate the exact same snapshot
    await page.route('http://localhost:8000/subgraphs/name/subgraph', async (route) => {
      if (JSON.parse(route.request().postData()!).operationName === 'GetAllPools') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(MockedPoolsData),
        });
      } else if (JSON.parse(route.request().postData()!).operationName === 'GetBorrowerDebtTokens') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(MockedDebtTokens),
        });
      } else {
        return route.abort();
      }
    });

    const component = await mount(
      <IntegrationWrapper>
        <Assets />
      </IntegrationWrapper>,
    );

    await expect(component).toHaveScreenshot();
  });

  test('should show a loader if the data is not yet loaded', async ({ mount, page }) => {
    // We dont show any data so the loader is permanently visible.
    await page.route('http://localhost:8000/subgraphs/name/subgraph', async (route) => {
      return route.abort();
    });

    const component = await mount(
      <IntegrationWrapper>
        <Assets />
      </IntegrationWrapper>,
    );

    // Only the Table headers are shown
    await expect(component).toHaveText('AssetsType$SF %%');

    const element = page.getByTestId('apollon-assets-loader');
    await expect(element).toBeVisible();
  });

  test.describe('Selecting Asset', () => {
    test('should select the first row of 10 by default', async ({ mount, page }) => {
      await mount(
        <IntegrationWrapper>
          <Assets />
        </IntegrationWrapper>,
      );

      await page.waitForSelector('[data-testid="apollon-assets-row"]', {
        state: 'visible',
      });
      await page.waitForSelector('.Mui-selected', {
        state: 'visible',
      });

      const rows = page.getByTestId('apollon-assets-row');
      expect(await rows.count()).toBe(12);

      const selectedRow = page.locator('.Mui-selected');
      expect(await selectedRow.count()).toBe(1);

      const firstRow = rows.nth(0);
      await expect(firstRow).toHaveClass(/Mui-selected/);
    });

    test('should click on an assets and have a selected style then', async ({ mount, page }) => {
      await mount(
        <IntegrationWrapper>
          <Assets />
        </IntegrationWrapper>,
      );

      await page.waitForSelector('[data-testid="apollon-assets-row"]', {
        state: 'visible',
      });
      await page.waitForSelector('.Mui-selected', {
        state: 'visible',
      });

      const rows = page.getByTestId('apollon-assets-row');
      const secondRow = rows.nth(1);
      await secondRow.click();

      await page.waitForTimeout(500);
      const selectedRow = page.locator('.Mui-selected');
      expect(await selectedRow.count()).toBe(1);

      const secondRowAfterUpdate = page.getByTestId('apollon-assets-row').nth(1);
      await expect(secondRowAfterUpdate).toHaveClass(/Mui-selected/);
    });
  });

  test.describe("Favorite Asset's", () => {
    test('should favorite an asset and shift it to the start. unfavorite returns it to the previous position.', async ({
      mount,
      page,
    }) => {
      await mount(
        <IntegrationWrapper>
          <Assets />
        </IntegrationWrapper>,
      );

      await page.waitForSelector('[data-testid="apollon-assets-row"]', {
        state: 'visible',
      });
      const rows = page.getByTestId('apollon-assets-row');
      const secondRow = rows.nth(1);
      const textSecondRow = await secondRow.textContent();

      const favoriteButtonSecondRow = page.getByTestId('apollon-assets-favorite').nth(1);
      const unfavoritedImage = favoriteButtonSecondRow.getByAltText('a grey pin icon with a transparent body');
      await unfavoritedImage.click();

      const firstRow = page.getByTestId('apollon-assets-row').nth(0);
      const textFirstRow = await firstRow.textContent();

      expect(textFirstRow).toBe(textSecondRow);

      const favoritedImage = firstRow.getByAltText('a white pin icon with a transparent body');
      await favoritedImage.click();

      const secondRowAfterUpdate = page.getByTestId('apollon-assets-row').nth(1);
      const textSecondRowAfterUpdate = await secondRowAfterUpdate.textContent();
      expect(textSecondRow).toBe(textSecondRowAfterUpdate);
    });

    // TODO: flaky on firefox
    test.skip('should favorite an asset, write to local storage and persist the changes for a reload', async ({
      mount,
      page,
    }) => {
      await page.route('http://localhost:8000/subgraphs/name/subgraph', async (route) => {
        if (JSON.parse(route.request().postData()!).operationName === 'GetAllPools') {
          return route.fulfill({
            status: 200,
            body: JSON.stringify(MockedPoolsData),
          });
        } else if (JSON.parse(route.request().postData()!).operationName === 'GetBorrowerDebtTokens') {
          return route.fulfill({
            status: 200,
            body: JSON.stringify(MockedDebtTokens),
          });
        } else {
          return route.abort();
        }
      });

      await mount(
        <IntegrationWrapper>
          <Assets />
        </IntegrationWrapper>,
      );

      await page.waitForSelector('[data-testid="apollon-assets-row"]', {
        state: 'visible',
      });

      const rows = page.getByTestId('apollon-assets-row');
      const secondRow = rows.nth(1);
      const textSecondRow = await secondRow.textContent();

      const favoriteButtonSecondRow = page.getByTestId('apollon-assets-favorite').nth(1);
      const unfavoritedImage = favoriteButtonSecondRow.getByAltText('a grey pin icon with a transparent body');
      await unfavoritedImage.click();

      const favoritedEntryLS = await page.evaluate((key) => localStorage.getItem(key), 'favoriteAssets');
      const listOfFavoritedAssets = JSON.parse(favoritedEntryLS!);

      expect(Array.isArray(listOfFavoritedAssets)).toBeTruthy();
      expect(listOfFavoritedAssets).toHaveLength(1);

      await page.reload();
      await mount(
        <IntegrationWrapper>
          <Assets />
        </IntegrationWrapper>,
      );
      await page.waitForSelector('[data-testid="apollon-assets-row"]', {
        state: 'visible',
      });

      const rowsAfterReload = page.getByTestId('apollon-assets-row');
      const firstRowAfterReload = rowsAfterReload.nth(0);
      const textFirstRowAfterReload = await firstRowAfterReload.textContent();
      expect(textFirstRowAfterReload).toBe(textSecondRow);

      const favoritedImage = firstRowAfterReload.getByAltText('a white pin icon with a transparent body');
      await expect(favoritedImage).toBeVisible();
    });
  });
});
