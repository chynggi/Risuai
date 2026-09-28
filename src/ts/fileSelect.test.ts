import { describe, it, expect, vi, beforeEach } from 'vitest'
import { open } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'

// Mock the Tauri APIs so the file selection routing can be tested in isolation.
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn() }))
vi.mock('@tauri-apps/plugin-fs', () => ({ readFile: vi.fn() }))
vi.mock('@tauri-apps/api/path', () => ({
    basename: vi.fn(async (p: string) => String(p).split('/').pop()),
}))
vi.mock('@tauri-apps/api/webviewWindow', () => ({ getCurrentWebviewWindow: () => ({}) }))
vi.mock('./storage/database.svelte', () => ({
    getDatabase: () => ({ allowAllExtentionFiles: false }),
}))
vi.mock('./stores.svelte', () => ({ DBState: { db: {} }, selectedCharID: {} }))
vi.mock('./characters', () => ({ createBlankChar: () => ({}), getCharImage: () => '' }))
vi.mock('src/lib/UI/PopupList.svelte', () => ({ default: {} }))

async function loadUtil(isTauri: boolean) {
    vi.resetModules()
    vi.doMock('src/ts/platform', () => ({
        isTauri,
        isIOS: () => false,
        isNodeServer: false,
        isWeb: false,
        isMobile: false,
        isFirefox: false,
    }))
    return await import('./util')
}

describe('file selection routing', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('uses the Tauri dialog for selectSingleFile when running in Tauri', async () => {
        const { selectSingleFile } = await loadUtil(true)
        ;(open as any).mockResolvedValue('/home/user/card.json')
        ;(readFile as any).mockResolvedValue(new Uint8Array([1, 2, 3]))

        const result = await selectSingleFile(['json', 'png'])

        expect(open).toHaveBeenCalledWith(
            expect.objectContaining({
                filters: [expect.objectContaining({ extensions: ['json', 'png'] })],
            }),
        )
        expect(result?.name).toBe('card.json')
        expect(Array.from(result!.data)).toEqual([1, 2, 3])
    })

    it('uses the Tauri dialog for selectFileByDom (character import path) in Tauri', async () => {
        const { selectFileByDom } = await loadUtil(true)
        ;(open as any).mockResolvedValue(['/a/one.risum', '/b/two.png'])
        ;(readFile as any).mockResolvedValue(new Uint8Array([9]))

        const files = await selectFileByDom(['*'], 'multiple')

        expect(open).toHaveBeenCalledWith(
            expect.objectContaining({ multiple: true, filters: [] }),
        )
        expect(files?.map((f) => f.name)).toEqual(['one.risum', 'two.png'])
    })

    it('does not call the Tauri dialog outside Tauri (web/DOM path)', async () => {
        const { selectSingleFile } = await loadUtil(false)

        // The DOM path appends an <input type=file> and waits for `change`,
        // which never fires in happy-dom; we only assert the native dialog
        // API is not used outside Tauri.
        void selectSingleFile(['json'])
        expect(open).not.toHaveBeenCalled()
    })
})