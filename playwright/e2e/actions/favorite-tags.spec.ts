/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Page } from '@playwright/test'

import { expect, setupFilesPage, test } from '../../support/fixtures.ts'
import { openFile } from '../../support/filesUtils.ts'
import { expectViewerLoaded, getActiveMedia, getViewer, getViewerName, goNext, goPrev } from '../../support/viewerUtils.ts'

const getFavoriteButton = (page: Page) => getViewer(page).getByRole('button', { name: /^(Add to|Remove from) favorites$/ })
const getTagsButton = (page: Page) => getViewer(page).getByRole('button', { name: 'Manage tags' })
// System tags are global, keep the name unique across runs on a reused server
const tagName = `st-viewer-${Date.now()}`

const getTagPicker = (page: Page) => page.locator('[data-cy-systemtags-picker]')

/**
 * Read the favorite flag and the tag names of a file over WebDAV, as the logged in user.
 *
 * @param page the page
 * @param fileName the file name in the user root
 */
async function getFileState(page: Page, fileName: string): Promise<{ favorite: string, tags: string[] }> {
	return page.evaluate(async (fileName) => {
		const user = window.OC.getCurrentUser().uid
		const response = await fetch(`${window.OC.getRootPath()}/remote.php/dav/files/${user}/${fileName}`, {
			method: 'PROPFIND',
			headers: { Depth: '0', requesttoken: window.OC.requestToken, 'Content-Type': 'application/xml' },
			body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns" xmlns:nc="http://nextcloud.org/ns"><d:prop><oc:favorite/><nc:system-tags/></d:prop></d:propfind>',
		})
		const xml = new DOMParser().parseFromString(await response.text(), 'application/xml')
		return {
			favorite: xml.getElementsByTagNameNS('http://owncloud.org/ns', 'favorite')[0]?.textContent ?? '',
			tags: Array.from(xml.getElementsByTagNameNS('http://nextcloud.org/ns', 'system-tag')).map(tag => tag.textContent ?? ''),
		}
	}, fileName)
}

test.describe.serial('Favorite and tags inline actions in viewer', () => {
	let page: Page

	test.beforeAll(async ({ browser }) => {
		({ page } = await setupFilesPage(browser, [
			{ fixture: 'image1.jpg', mimeType: 'image/jpeg' },
			{ fixture: 'image2.jpg', mimeType: 'image/jpeg' },
		]))
	})

	test.afterAll(async () => {
		await page.close()
	})

	test('Shows the favorite and tags buttons inline in the header', async () => {
		await openFile(page, 'image1.jpg')
		await expectViewerLoaded(page)
		await expect(getFavoriteButton(page)).toBeVisible()
		await expect(getFavoriteButton(page)).toHaveAccessibleName('Add to favorites')
		await expect(getTagsButton(page)).toBeVisible()
	})

	test('Favorites the file on click', async () => {
		await getFavoriteButton(page).click()
		await expect(getFavoriteButton(page)).toHaveAccessibleName('Remove from favorites')
		await expect.poll(async () => (await getFileState(page, 'image1.jpg')).favorite).toBe('1')
	})

	test('Favorites the next file with the S hotkey', async () => {
		await goNext(page)
		await expect(getViewerName(page)).toContainText('image2')
		await expect(getFavoriteButton(page)).toHaveAccessibleName('Add to favorites')
		await page.keyboard.press('s')
		await expect(getFavoriteButton(page)).toHaveAccessibleName('Remove from favorites')
		await expect.poll(async () => (await getFileState(page, 'image2.jpg')).favorite).toBe('1')
	})

	test('Still opens the previous file after it was favorited', async () => {
		await goPrev(page)
		await expect(getViewerName(page)).toContainText('image1')
		await expect(getActiveMedia(page, 'img')).toHaveAttribute('alt', 'image1.jpg')
		await expect(getActiveMedia(page, 'img')).toHaveClass(/loaded/)
		await expect(getFavoriteButton(page)).toHaveAccessibleName('Remove from favorites')
	})

	test('Unfavorites the file with the S hotkey', async () => {
		await page.keyboard.press('s')
		await expect(getFavoriteButton(page)).toHaveAccessibleName('Add to favorites')
		await expect.poll(async () => (await getFileState(page, 'image1.jpg')).favorite).toBe('0')
	})

	test('Opens the tag picker with the T hotkey and tags the file', async () => {
		await page.keyboard.press('t')
		await expect(getTagPicker(page)).toBeVisible()

		// Typing in the picker must not trigger the viewer hotkeys
		await getTagPicker(page).getByRole('textbox', { name: 'Search or create tag' }).fill(tagName)
		await page.locator('[data-cy-systemtags-picker-button-create]').click()
		await page.locator('[data-cy-systemtags-picker-button-submit]').click()
		await expect(getTagPicker(page)).toHaveCount(0)

		await expect.poll(async () => (await getFileState(page, 'image1.jpg')).tags).toEqual([tagName])
		expect((await getFileState(page, 'image1.jpg')).favorite).toBe('0')
		await expect(getViewer(page)).toBeVisible()
	})

	test('Opens the tag picker from the header button', async () => {
		await getTagsButton(page).click()
		await expect(getTagPicker(page)).toBeVisible()
		await page.locator('[data-cy-systemtags-picker-button-cancel]').click()
		await expect(getTagPicker(page)).toHaveCount(0)
	})
})
