import { expect, test } from '@playwright/experimental-ct-react';
import { SetupServer } from 'msw/node';
import EthersAddressLabel from '../Label/EthersAddressLabel/EthersAddressLabel';
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

test.describe('EthersAddressLabel', () => {
  test('should render EthersAddressLabel when logged in', async ({ mount }) => {
    const component = await mount(
      <IntegrationWrapper shouldConnectWallet>
        <EthersAddressLabel />
      </IntegrationWrapper>,
    );

    await expect(component).toHaveScreenshot();
  });

  test('should render EthersAddressLabel when in guest mode', async ({ mount }) => {
    const component = await mount(
      <IntegrationWrapper>
        <EthersAddressLabel />
      </IntegrationWrapper>,
    );

    await expect(component).toHaveScreenshot();
  });
});
