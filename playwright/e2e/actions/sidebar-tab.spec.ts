/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Page } from '@playwright/test'

import { expect, setupFilesPage, test } from '../../support/fixtures.ts'
import { openFile } from '../../support/filesUtils.ts'
import { getSidebar, getSidebarName, openSidebarFromViewer } from '../../support/sidebarUtils.ts'
import { expectViewerLoaded, goNext } from '../../support/viewerUtils.ts'

const getTab = (page: Page, name: string) => getSidebar(page).getByRole('tab', { name })

test.describe.serial('Sidebar opened from the viewer starts on the Activity tab', () => {
	let page: Page

	test.beforeAll(async ({ browser }) => {
		({ page } = await setupFilesPage(browser, [1, 2].map((i) => ({
			fixture: `image${i}.jpg`,
			mimeType: 'image/jpeg',
		}))))
		// The test server has no activity app: register a stand-in tab with its id and order
		await page.evaluate(() => {
			customElements.define('e2e-activity-tab', class extends HTMLElement {})
			window._nc_files_scope.v4_0.filesSidebarTabs.set('activity', {
				id: 'activity',
				displayName: 'Activity',
				iconSvgInline: '<svg viewBox="0 0 24 24"></svg>',
				order: 50,
				tagName: 'e2e-activity-tab',
			})
		})
	})

	test.afterAll(async () => {
		await page.close()
	})

	test('Opens the sidebar on the Activity tab', async () => {
		await openFile(page, 'image1.jpg')
		await expectViewerLoaded(page)
		await openSidebarFromViewer(page)
		await expect(getSidebarName(page)).toContainText('image1.jpg')
		await expect(getTab(page, 'Activity')).toHaveAttribute('aria-selected', 'true')
		await expect(getTab(page, 'Sharing')).toHaveAttribute('aria-selected', 'false')
	})

	test('Keeps the chosen tab on next', async () => {
		await getTab(page, 'Versions').click()
		await expect(getTab(page, 'Versions')).toHaveAttribute('aria-selected', 'true')
		await goNext(page)
		await expect(getSidebarName(page)).toContainText('image2.jpg')
		await expect(getTab(page, 'Versions')).toHaveAttribute('aria-selected', 'true')
	})
})
