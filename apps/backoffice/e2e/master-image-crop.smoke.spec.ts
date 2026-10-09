import { expect, test, type Page, type Route } from '@playwright/test'

const admin = {
  id: 1, email: 'master-images@soulcuts.test', full_name: 'Images Admin', role: 'admin',
  master_id: null, is_active: true, is_superuser: true,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}

type Upload = { kind: string; multipart: Uint8Array }
type Backend = { uploads: Upload[]; writes: string[]; unexpected: string[]; errors: string[] }

const makeWebp = async (page: Page, palette: 'bands' | 'purple' | 'orange' = 'bands') => {
  const image = await page.evaluate((colors) => {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 400
    const context = canvas.getContext('2d')!
    if (colors === 'bands') {
      context.fillStyle = '#05cf2c'
      context.fillRect(0, 0, 640, 400)
      context.fillStyle = '#e01922'
      context.fillRect(120, 0, 200, 400)
      context.fillStyle = '#1753e6'
      context.fillRect(320, 0, 200, 400)
    } else {
      context.fillStyle = colors === 'purple' ? '#9c23cf' : '#f59a19'
      context.fillRect(0, 0, 640, 400)
      context.fillStyle = '#fff'
      context.fillRect(200, 120, 240, 160)
    }
    const dataUrl = canvas.toDataURL('image/webp', 0.95)
    const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]!), character => character.charCodeAt(0))
    return { dataUrl, bytes: Array.from(bytes) }
  }, palette)
  expect(image.dataUrl).toMatch(/^data:image\/webp;base64,/)
  return { dataUrl: image.dataUrl, bytes: new Uint8Array(image.bytes) }
}

const imageStats = async (page: Page, webp: Uint8Array) => page.evaluate(async (bytes) => {
  const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/webp' }))
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d')!
  context.drawImage(bitmap, 0, 0)
  const row = context.getImageData(0, Math.floor(canvas.height / 2), canvas.width, 1).data
  let green = 0
  for (let x = 0; x < canvas.width; x += 4) {
    const offset = x * 4
    if (row[offset + 1]! > 80 && row[offset + 1]! > row[offset]! * 1.4 && row[offset + 1]! > row[offset + 2]! * 1.4) green++
  }
  return { width: canvas.width, height: canvas.height, greenFraction: green / Math.ceil(canvas.width / 4) }
}, Array.from(webp))

const extractWebp = (multipart: Uint8Array) => {
  const start = multipart.findIndex((value, index) => value === 82 && multipart[index + 1] === 73 && multipart[index + 2] === 70 && multipart[index + 3] === 70)
  expect(start, 'Multipart body contains WebP RIFF bytes').toBeGreaterThanOrEqual(0)
  const length = new DataView(multipart.buffer, multipart.byteOffset + start + 4, 4).getUint32(0, true) + 8
  const webp = multipart.slice(start, start + length)
  expect(String.fromCharCode(...webp.slice(8, 12))).toBe('WEBP')
  return webp
}
const sameBytes = (left: Uint8Array, right: Uint8Array) => left.length === right.length && left.every((value, index) => value === right[index])

async function installBackend(page: Page, originals: { photo: string; avatar: string; passport: string }, theme: 'light' | 'dark' = 'light'): Promise<Backend> {
  const master = {
    id: 7, admin_user_id: 77, first_name_uk: 'Тест', last_name_uk: 'Майстер',
    first_name_en: 'Test', last_name_en: 'Master', full_name: 'Тест Майстер', full_name_uk: 'Тест Майстер',
    position: 'master', position_uk: 'Майстер', email: 'master@soulcuts.test', phone: null,
    photo: originals.photo, avatar: originals.avatar, passport_photo: originals.passport,
    is_active: true, showOnMasterBlock: true, services: [],
  }
  await page.addInitScript(({ theme, user }) => {
    localStorage.setItem('soulcuts-backoffice-theme', theme)
    localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'master-images-local-only', refreshToken: 'unused', user }))
  }, { theme, user: admin })
  const uploads: Upload[] = []
  const writes: string[] = []
  const unexpected: string[] = []
  const errors: string[] = []
  page.on('pageerror', error => errors.push(`Page error: ${error.message}`))
  page.on('console', message => { if (message.type() === 'error') errors.push(`Console error: ${message.text()}`) })
  page.on('requestfailed', request => { if (request.url().includes('/api/v1/')) errors.push(`Failed API request: ${request.url()} ${request.failure()?.errorText}`) })
  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace(/^\/api\/v1/, '')
    const method = request.method()
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', json: body })
    if (method === 'GET' && path === '/backoffice/auth/me') return json(admin)
    if (method === 'GET' && path === '/backoffice/masters') return json({ items: [master], total: 1, page: Number(url.searchParams.get('page') || 1), page_size: Number(url.searchParams.get('page_size') || 100) })
    if (method === 'GET' && path === '/public/masters') return json([master])
    if (method === 'GET' && path === '/backoffice/reviews/masters/statistics') return json([])
    if (method === 'PUT' && path === '/backoffice/masters/7') {
      writes.push(`${method} ${path}`)
      return json(master)
    }
    const imageKind = /^\/backoffice\/masters\/7\/(photo|avatar|passport-photo)$/.exec(path)?.[1]
    if (method === 'POST' && imageKind) {
      const multipart = request.postDataBuffer()
      if (!multipart) throw new Error(`Missing multipart body for ${imageKind}`)
      uploads.push({ kind: imageKind, multipart: new Uint8Array(multipart) })
      writes.push(`${method} ${path}`)
      return json(master)
    }
    unexpected.push(`${method} ${url.href}`)
    return json({ detail: 'Unexpected request in master image crop smoke test' }, 599)
  })
  return { uploads, writes, unexpected, errors }
}

const checkBackend = (backend: Backend) => {
  expect(backend.unexpected, 'Every API request must be explicitly mocked').toEqual([])
  expect(backend.errors, 'Browser exceptions, console errors and failed requests remain visible').toEqual([])
}
const editMaster = async (page: Page) => {
  await page.goto('/masters')
  await expect(page.getByRole('heading', { name: 'Майстри', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Редагувати майстра' }).click()
  const dialog = page.getByRole('dialog', { name: 'Діалогове вікно' })
  await expect(dialog.getByRole('heading', { name: 'Редагувати майстра' })).toBeVisible()
  return dialog
}
const uploadFile = async (page: Page, dialog: ReturnType<Page['getByRole']>, label: string, filename: string, bytes: Uint8Array) => {
  await dialog.locator('.base-file-field').filter({ has: page.getByText(label, { exact: true }) }).locator('input[type="file"]').evaluate((element, file) => {
    const input = element as HTMLInputElement
    const transfer = new DataTransfer()
    transfer.items.add(new File([new Uint8Array(file.bytes)], file.filename, { type: 'image/webp' }))
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, { filename, bytes: Array.from(bytes) })
}

test('square photo crop changes the saved WebP while preserving full preview', async ({ page }, testInfo) => {
  const original = await makeWebp(page)
  const other = await makeWebp(page, 'purple')
  const backend = await installBackend(page, { photo: original.dataUrl, avatar: other.dataUrl, passport: other.dataUrl })
  const form = await editMaster(page)
  await uploadFile(page, form, 'Фото', 'source-photo.webp', original.bytes)
  const crop = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Обрізати фото' }) })
  await expect(crop).toBeVisible()
  await crop.getByRole('button', { name: 'Квадрат' }).click()
  await crop.getByRole('group', { name: /Область обрізання/ }).focus()
  await page.keyboard.press('Equal')
  await expect(crop.getByText('110%')).toBeVisible()
  const cropImage = crop.getByRole('group', { name: /Область обрізання/ }).locator('img')
  const imageLeft = await cropImage.evaluate(image => (image as HTMLImageElement).style.left)
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => cropImage.evaluate(image => (image as HTMLImageElement).style.left)).not.toBe(imageLeft)
  await page.screenshot({ path: testInfo.outputPath('master-image-crop-light-desktop.png'), fullPage: true, animations: 'disabled' })
  await crop.getByRole('button', { name: 'Застосувати обрізання' }).click()
  await expect(crop).toHaveCount(0)
  await expect(form.getByText('Попередній перегляд фото', { exact: true })).toBeVisible()
  await form.getByRole('img', { name: 'Фото майстра' }).locator('..').click()
  const fullPreview = page.getByRole('dialog', { name: 'Фото майстра' })
  await expect(fullPreview.getByRole('img', { name: 'Фото майстра' })).toBeVisible()
  await fullPreview.getByRole('button', { name: 'Закрити перегляд' }).click()
  await form.getByRole('button', { name: 'Зберегти майстра' }).click()
  await expect.poll(() => backend.uploads.length).toBe(1)
  expect(backend.uploads.map(upload => upload.kind)).toEqual(['photo'])
  const sourceStats = await imageStats(page, original.bytes)
  const uploaded = extractWebp(backend.uploads[0]!.multipart)
  const uploadStats = await imageStats(page, uploaded)
  expect(sourceStats).toMatchObject({ width: 640, height: 400 })
  expect(uploadStats.width).toBe(uploadStats.height)
  expect(uploadStats.greenFraction).toBeLessThan(sourceStats.greenFraction * 0.5)
  expect(sameBytes(uploaded, original.bytes)).toBe(false)
  expect(backend.writes).toEqual(['PUT /backoffice/masters/7', 'POST /backoffice/masters/7/photo'])
  checkBackend(backend)
})

test('crop cancel retains original and photo, avatar, passport uploads stay independent', async ({ page }) => {
  const photo = await makeWebp(page)
  const avatar = await makeWebp(page, 'purple')
  const passport = await makeWebp(page, 'orange')
  const backend = await installBackend(page, { photo: photo.dataUrl, avatar: avatar.dataUrl, passport: passport.dataUrl })
  const form = await editMaster(page)
  await uploadFile(page, form, 'Фото', 'uncropped-photo.webp', photo.bytes)
  const photoCrop = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Обрізати фото' }) })
  await photoCrop.getByRole('button', { name: 'Скасувати', exact: true }).click()
  await expect(photoCrop).toHaveCount(0)
  await uploadFile(page, form, 'Avatar', 'avatar.webp', avatar.bytes)
  const avatarCrop = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Обрізати avatar' }) })
  await expect(avatarCrop.getByRole('button', { name: 'Квадрат' })).toHaveCount(0)
  await avatarCrop.getByRole('button', { name: 'Застосувати обрізання' }).click()
  await expect(avatarCrop).toHaveCount(0)
  const avatarPreviewSize = () => form.getByRole('img', { name: 'Avatar майстра' }).evaluate((image) => {
    const preview = image as HTMLImageElement
    return { width: preview.naturalWidth, height: preview.naturalHeight }
  })
  await expect.poll(async () => (await avatarPreviewSize()).width).toBeGreaterThan(0)
  const squarePreview = await avatarPreviewSize()
  expect(squarePreview.width, 'Avatar preview reflects the cropped output').toBe(squarePreview.height)
  await uploadFile(page, form, 'Фото паспорта', 'passport.webp', passport.bytes)
  const passportCrop = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Обрізати фото паспорта' }) })
  await passportCrop.getByRole('button', { name: 'Оригінальні пропорції' }).click()
  await passportCrop.getByRole('button', { name: 'Застосувати обрізання' }).click()
  await expect(passportCrop).toHaveCount(0)
  await form.getByRole('button', { name: 'Зберегти майстра' }).click()
  await expect.poll(() => backend.uploads.length).toBe(3)
  expect(backend.uploads.map(upload => upload.kind)).toEqual(['photo', 'avatar', 'passport-photo'])
  expect(sameBytes(extractWebp(backend.uploads[0]!.multipart), photo.bytes)).toBe(true)
  const avatarStats = await imageStats(page, extractWebp(backend.uploads[1]!.multipart))
  const passportStats = await imageStats(page, extractWebp(backend.uploads[2]!.multipart))
  expect(avatarStats.width).toBe(avatarStats.height)
  expect(passportStats).toMatchObject({ width: 640, height: 400 })
  expect(backend.writes).toEqual([
    'PUT /backoffice/masters/7', 'POST /backoffice/masters/7/photo',
    'POST /backoffice/masters/7/avatar', 'POST /backoffice/masters/7/passport-photo',
  ])
  checkBackend(backend)
})

test('closing and reopening the master form clears pending image changes', async ({ page }) => {
  const original = await makeWebp(page)
  const replacement = await makeWebp(page, 'purple')
  const backend = await installBackend(page, { photo: original.dataUrl, avatar: original.dataUrl, passport: original.dataUrl })
  const form = await editMaster(page)
  await uploadFile(page, form, 'Фото', 'pending.webp', replacement.bytes)
  const crop = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Обрізати фото' }) })
  await crop.getByRole('button', { name: 'Застосувати обрізання' }).click()
  await expect(crop).toHaveCount(0)
  await expect(form.getByText('pending.webp')).toBeVisible()
  await form.getByRole('button', { name: 'Закрити' }).click()
  await expect(form).toHaveCount(0)
  await page.getByRole('button', { name: 'Редагувати майстра' }).click()
  const reopened = page.getByRole('dialog', { name: 'Діалогове вікно' })
  await expect(reopened.getByText('pending.webp')).toHaveCount(0)
  await expect(reopened.getByRole('img', { name: 'Фото майстра' })).toBeVisible()
  expect(backend.writes).toEqual([])
  checkBackend(backend)
})

test('mobile dark crop dialog fits without horizontal overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const original = await makeWebp(page)
  const backend = await installBackend(page, { photo: original.dataUrl, avatar: original.dataUrl, passport: original.dataUrl }, 'dark')
  const form = await editMaster(page)
  await uploadFile(page, form, 'Avatar', 'mobile-avatar.webp', original.bytes)
  const crop = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Обрізати avatar' }) })
  await expect(crop).toBeVisible()
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1)
  await page.screenshot({ path: testInfo.outputPath('master-image-crop-dark-390.png'), fullPage: true, animations: 'disabled' })
  expect(backend.writes).toEqual([])
  checkBackend(backend)
})
