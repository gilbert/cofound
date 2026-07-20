import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { jsonStorage, mediaId, memoryStorage, openLibrary, weakFingerprint } from '../index.js'

test('openLibrary requires explicit storage and roots', async () => {
  await assert.rejects(() => openLibrary({ roots: ['media'] }), /storage/)
  await assert.rejects(() => openLibrary({ storage: memoryStorage() }), /root/)
})

test('scan indexes media files and persists changed records', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'co-media-library-'))
  await mkdir(path.join(root, 'Shows'))
  await writeFile(path.join(root, 'Movie (2026).mp4'), 'movie')
  await writeFile(path.join(root, 'Shows', 'Show S01E01 - Pilot.mkv'), 'episode')
  await writeFile(path.join(root, 'poster.png'), 'ignored')

  const storage = recordingStorage()
  const library = await openLibrary({ roots: [root], storage })
  const result = await library.scan()
  const items = library.items()

  assert.deepEqual(result, { added: 3, changed: 0, unchanged: 0, moved: 0, deleted: 0, total: 3 })
  assert.equal(items.length, 3)
  assert.deepEqual(items.map(item => item.rel), ['Movie (2026).mp4', 'poster.png', 'Shows/Show S01E01 - Pilot.mkv'])
  assert.equal(items[0].id, mediaId(root, 'Movie (2026).mp4'))
  assert.equal(items[0].pathId, mediaId(root, 'Movie (2026).mp4'))
  assert.equal(items[1].type, 'image')
  assert.equal(storage.saved.length, 3)
})

test('indexFile adds one file without a full scan, probing only it', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'co-media-library-'))
  await writeFile(path.join(root, 'Existing (2020).mp4'), 'existing')

  const probes = []
  const storage = recordingStorage()
  const library = await openLibrary({
    roots: [root],
    storage,
    probe: async file => (probes.push(file), { ok: true }),
  })
  await library.scan()
  probes.length = 0
  storage.saved.length = 0

  // A fresh upload lands on disk; index just that file.
  const dest = path.join(root, 'IMG_1234.jpg')
  await writeFile(dest, 'jpeg-bytes')
  const record = await library.indexFile(dest)

  assert.ok(record)
  assert.equal(record.rel, 'IMG_1234.jpg')
  assert.equal(record.type, 'image')
  assert.equal(record.id, mediaId(root, 'IMG_1234.jpg'))
  assert.deepEqual(probes, [dest])        // only the new file was probed
  assert.equal(storage.saved.length, 1)   // only one record persisted
  assert.equal(library.get(record.id).rel, 'IMG_1234.jpg')
  assert.equal(library.items().length, 2) // existing + new, no rescan needed

  // Non-media files are skipped; paths outside a root are rejected.
  await writeFile(path.join(root, 'notes.txt'), 'x')
  assert.equal(await library.indexFile(path.join(root, 'notes.txt')), null)
  await assert.rejects(() => library.indexFile('/etc/hostname'), /under a library root/)
})

test('scan reuses probe data for unchanged files and reprobes changed files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'co-media-library-'))
  const file = path.join(root, 'Movie (2026).mp4')
  await writeFile(file, 'movie')

  const probes = []
  const storage = recordingStorage()
  const library = await openLibrary({
    roots: [root],
    storage,
    probe: async file => {
      probes.push(file)
      return { duration: probes.length }
    },
  })

  await library.scan()
  await library.scan()
  assert.equal(probes.length, 1)
  assert.equal(library.items()[0].probe.duration, 1)

  await writeFile(file, 'movie changed')
  const changed = await library.scan()
  assert.equal(changed.changed, 1)
  assert.equal(probes.length, 2)
  assert.equal(library.items()[0].probe.duration, 2)
})

test('update persists deep-merged metadata', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'co-media-library-'))
  await writeFile(path.join(root, 'Movie (2026).mp4'), 'movie')

  const storage = recordingStorage()
  const library = await openLibrary({ roots: [root], storage })
  await library.scan()
  const id = library.items()[0].id

  await library.update(id, {
    metadata: {
      thumbnail: {
        status: 'queued',
        sourceFingerprint: 'one',
      },
    },
  })
  const updated = await library.update(id, {
    metadata: {
      thumbnail: {
        status: 'ready',
        href: '/thumbs/a.jpg',
      },
    },
  })

  assert.deepEqual(updated.metadata.thumbnail, {
    status: 'ready',
    sourceFingerprint: 'one',
    href: '/thumbs/a.jpg',
  })
  assert.deepEqual(storage.saved.at(-1).metadata.thumbnail, updated.metadata.thumbnail)
})

test('scan preserves metadata on unchanged, changed, and moved records', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'co-media-library-'))
  const file = path.join(root, 'Movie (2026).mp4')
  const moved = path.join(root, 'Moved (2026).mp4')
  await writeFile(file, 'movie')

  const library = await openLibrary({ roots: [root], storage: memoryStorage() })
  await library.scan()
  const id = library.items()[0].id
  await library.update(id, {
    metadata: {
      thumbnail: {
        status: 'ready',
        href: '/thumbs/a.jpg',
      },
    },
  })

  await library.scan()
  assert.equal(library.get(id).metadata.thumbnail.status, 'ready')

  await writeFile(file, 'movie changed')
  await library.scan()
  assert.equal(library.get(id).metadata.thumbnail.href, '/thumbs/a.jpg')

  await rename(file, moved)
  await library.scan()
  assert.equal(library.get(id).rel, 'Moved (2026).mp4')
  assert.equal(library.get(id).metadata.thumbnail.status, 'ready')
})

test('scan saves deleted files as tombstones', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'co-media-library-'))
  const file = path.join(root, 'Movie (2026).mp4')
  await writeFile(file, 'movie')

  const storage = recordingStorage()
  const library = await openLibrary({ roots: [root], storage })
  await library.scan()
  await rm(file)

  const result = await library.scan()
  assert.equal(result.deleted, 1)
  assert.equal(library.items().length, 0)
  assert.equal(library.items({ deleted: true })[0].deleted, true)
  assert.equal(storage.saved.at(-1).deleted, true)
})

test('scan preserves ids for recent unambiguous renames', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'co-media-library-'))
  const file = path.join(root, 'Movie (2026).mp4')
  const renamed = path.join(root, 'Renamed (2026).mp4')
  await writeFile(file, 'movie')

  const storage = recordingStorage()
  const library = await openLibrary({ roots: [root], storage })
  await library.scan()
  const id = library.items()[0].id

  await rename(file, renamed)
  const result = await library.scan()
  const item = library.items()[0]

  assert.equal(result.moved, 1)
  assert.equal(result.deleted, 0)
  assert.equal(item.id, id)
  assert.equal(item.pathId, mediaId(root, 'Renamed (2026).mp4'))
  assert.equal(item.rel, 'Renamed (2026).mp4')
  assert.equal(item.movedFrom, 'Movie (2026).mp4')
})

test('scan does not match deleted tombstones', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'co-media-library-'))
  const file = path.join(root, 'Movie (2026).mp4')
  await writeFile(file, 'movie')

  const storage = recordingStorage()
  const library = await openLibrary({ roots: [root], storage })
  await library.scan()
  const oldId = library.items()[0].id

  await rm(file)
  await library.scan()

  const tombstone = library.items({ deleted: true })[0]
  const staleStorage = memoryStorage([tombstone])
  const next = await openLibrary({ roots: [root], storage: staleStorage })
  await writeFile(path.join(root, 'Renamed (2026).mp4'), 'movie')
  const result = await next.scan()
  const item = next.items()[0]

  assert.equal(result.added, 1)
  assert.equal(result.moved, 0)
  assert.notEqual(item.id, oldId)
  assert.equal(item.id, mediaId(root, 'Renamed (2026).mp4'))
})

test('scan does not match ambiguous fingerprints', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'co-media-library-'))
  await writeFile(path.join(root, 'One (2026).mp4'), 'same')
  await writeFile(path.join(root, 'Two (2026).mp4'), 'same')

  const storage = recordingStorage()
  const library = await openLibrary({ roots: [root], storage })
  await library.scan()

  await rm(path.join(root, 'One (2026).mp4'))
  await rm(path.join(root, 'Two (2026).mp4'))
  await writeFile(path.join(root, 'Three (2026).mp4'), 'same')
  const result = await library.scan()
  const item = library.items()[0]

  assert.equal(result.added, 1)
  assert.equal(result.moved, 0)
  assert.equal(result.deleted, 2)
  assert.equal(item.id, mediaId(root, 'Three (2026).mp4'))
})

test('weakFingerprint samples across the file', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'co-media-library-'))
  const one = path.join(root, 'one.mp4')
  const two = path.join(root, 'two.mp4')
  const first = Buffer.alloc(2 * 1024 * 1024, 'a')
  const second = Buffer.from(first)
  second[1024 * 1024] = 'b'.charCodeAt(0)

  await writeFile(one, first)
  await writeFile(two, second)

  assert.notEqual(
    await weakFingerprint(one),
    await weakFingerprint(two),
  )
})

test('weakFingerprint hashes files smaller than the byte budget entirely', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'co-media-library-'))
  const one = path.join(root, 'one.mp4')
  const two = path.join(root, 'two.mp4')
  const first = Buffer.alloc(1024, 'a')
  const second = Buffer.from(first)
  second[700] = 'b'.charCodeAt(0)

  await writeFile(one, first)
  await writeFile(two, second)

  assert.notEqual(
    await weakFingerprint(one),
    await weakFingerprint(two),
  )
})

test('jsonStorage loads and upserts one record at a time', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'co-media-library-json-'))
  const file = path.join(dir, 'library.json')
  const storage = jsonStorage(file)

  assert.deepEqual(await storage.loadAll(), [])

  await storage.saveOne({ id: 'a', rel: 'one.mp4' })
  await storage.saveOne({ id: 'b', rel: 'two.mp4' })
  await storage.saveOne({ id: 'a', rel: 'one-new.mp4' })

  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), [
    { id: 'a', rel: 'one-new.mp4' },
    { id: 'b', rel: 'two.mp4' },
  ])
})

test('jsonStorage serializes concurrent saves', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'co-media-library-json-'))
  const file = path.join(dir, 'library.json')
  const storage = jsonStorage(file)

  await storage.loadAll()
  await Promise.all([
    storage.saveOne({ id: 'a', rel: 'one.mp4' }),
    storage.saveOne({ id: 'b', rel: 'two.mp4' }),
  ])

  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')).sort((a, b) => a.id.localeCompare(b.id)), [
    { id: 'a', rel: 'one.mp4' },
    { id: 'b', rel: 'two.mp4' },
  ])
})

test('relocate moves a file on disk and updates the record in place', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'co-media-library-'))
  await writeFile(path.join(root, 'Clip (2026).mp4'), 'clip-bytes')
  const storage = recordingStorage()
  const library = await openLibrary({ roots: [root], storage })
  await library.scan()
  const before = library.items()[0]

  const moved = await library.relocate(before.id, path.join(root, 'dirs', 'col-1', 'Clip (2026).mp4'))
  assert.equal(moved.id, before.id)   // identity survives the move
  assert.equal(moved.rel, 'dirs/col-1/Clip (2026).mp4')
  assert.equal(moved.name, 'Clip (2026).mp4')
  assert.equal(moved.pathId, mediaId(root, 'dirs/col-1/Clip (2026).mp4'))
  assert.equal(await readFile(moved.path, 'utf8'), 'clip-bytes')
  assert.equal(library.get(before.id).rel, 'dirs/col-1/Clip (2026).mp4')

  // A subsequent scan sees the moved file as already accounted for — no
  // tombstone, no new id.
  const result = await library.scan()
  assert.equal(result.deleted, 0)
  assert.equal(result.added, 0)
  assert.equal(library.items().length, 1)
  assert.equal(library.items()[0].id, before.id)

  // Guards: unknown id, destination outside every root, occupied destination.
  assert.equal(await library.relocate('nope', path.join(root, 'x.mp4')), null)
  await assert.rejects(() => library.relocate(before.id, path.join(os.tmpdir(), 'elsewhere.mp4')), /root/)
  await writeFile(path.join(root, 'occupied.mp4'), 'other')
  await library.indexFile(path.join(root, 'occupied.mp4'))
  await assert.rejects(() => library.relocate(before.id, path.join(root, 'occupied.mp4')), /exists/)
  assert.equal(library.get(before.id).rel, 'dirs/col-1/Clip (2026).mp4')
})

function recordingStorage(records = []) {
  const storage = memoryStorage(records)
  return {
    saved: [],
    loadAll: storage.loadAll,
    async saveOne(record) {
      await storage.saveOne(record)
      this.saved.push(record)
    },
  }
}
