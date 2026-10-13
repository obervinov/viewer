/**
 * SPDX-FileCopyrightText: 2023 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { isPublicShare } from '@nextcloud/sharing/public'

/**
 * Sorting used by the Files list, so previous/next follow the same order.
 * The key is passed to `sortNodes` as is: it expects the Files sorting modes
 * (`basename`, `mtime`, `size`), not the DAV property names.
 *
 * @return {object}
 */
export default async function getSortingConfig() {
	if (isPublicShare()) {
		return { key: 'basename', asc: true, favoritesFirst: false }
	}

	const [viewConfigs, userConfig] = await Promise.all([getViewConfigs(), getUserConfig()])

	// Sorting is stored per Files view; the router knows which one is open
	const view = window.OCP?.Files?.Router?.params?.view
	const viewConfig = (view && viewConfigs?.[view]) || viewConfigs?.files || {}

	const key = viewConfig.sorting_mode || 'basename'
	const asc = viewConfig.sorting_direction === 'asc' || !viewConfig.sorting_direction
	// Server default for sort_favorites_first is true
	const favoritesFirst = userConfig?.sort_favorites_first !== false

	return { key, asc, favoritesFirst }
}

/**
 * @return {object}
 */
async function getViewConfigs() {
	const url = generateUrl('apps/files/api/v1/views')
	return await axios.get(url)
		.then((response) => {
			return response.data.data
		})
		.catch(() => {
			return null
		})
}

/**
 * @return {object}
 */
async function getUserConfig() {
	const url = generateUrl('apps/files/api/v1/configs')
	return await axios.get(url)
		.then((response) => {
			return response.data.data
		})
		.catch(() => {
			return null
		})
}
