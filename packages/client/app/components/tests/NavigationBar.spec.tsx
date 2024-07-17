import { expect, test } from '@playwright/experimental-ct-react';
import { SetupServer } from 'msw/node';
import NavigationBar from '../NavigationBar/NavigationBar';
import { integrationSuiteSetup, integrationTestSetup } from './integration-test.setup';
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

test.describe('NavigationBar', () => {
  test('should render NavigationBar', async ({ mount }) => {
    const component = await mount(
      <IntegrationWrapper>
        <NavigationBar setThemeMode={() => {}} themeMode="dark" />
      </IntegrationWrapper>,
    );

    await expect(component).toHaveScreenshot();
  });

  test('should go to "/balance" when clicking "Balance"', async ({ mount, page }) => {
    const component = await mount(
      <IntegrationWrapper>
        <NavigationBar setThemeMode={() => {}} themeMode="dark" />
      </IntegrationWrapper>,
    );

    await component.getByRole('tab', { name: 'Balance' }).click();

    expect(page.url()).toBe('http://localhost:3100/balance');
  });

  test('should go to "/spot" when clicking "Spot"', async ({ mount, page }) => {
    const component = await mount(
      <IntegrationWrapper>
        <NavigationBar setThemeMode={() => {}} themeMode="dark" />
      </IntegrationWrapper>,
    );

    await component.getByRole('tab', { name: 'Spot' }).click();

    expect(page.url()).toBe('http://localhost:3100/spot');
  });

  test('should go to "/pools" when clicking "Pools"', async ({ mount, page }) => {
    const component = await mount(
      <IntegrationWrapper>
        <NavigationBar setThemeMode={() => {}} themeMode="dark" />
      </IntegrationWrapper>,
    );

    await component.getByRole('tab', { name: 'Pools' }).click();

    expect(page.url()).toBe('http://localhost:3100/pools');
  });
});
