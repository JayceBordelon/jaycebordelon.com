import { mkdir, writeFile } from 'node:fs/promises'
import { combineCalendars } from './github-data.mjs'

const usernames = ['JayceBordelon', 'jb-taste']
async function request(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'jaycebordelon.com', Accept: 'text/html' },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`GitHub request failed: HTTP ${response.status}`)
  return response.text()
}

function attribute(tag, name) {
  return tag.match(new RegExp(`${name}="([^"]+)"`))?.[1]
}

async function readCalendar(username) {
  const calendar = await request(`https://github.com/users/${username}/contributions`)
  const counts = new Map()
  for (const match of calendar.matchAll(/<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/g)) {
    const count = match[2].match(/(No|[\d,]+) contributions?/i)?.[1]
    if (count) counts.set(attribute(match[1], 'for'), count === 'No' ? 0 : Number(count.replaceAll(',', '')))
  }
  const days = [...calendar.matchAll(/<td\b[^>]*data-date="[^"]+"[^>]*>/g)].map(([tag]) => ({
    date: attribute(tag, 'data-date'),
    level: Number(attribute(tag, 'data-level')),
    count: counts.get(attribute(tag, 'id')),
  })).sort((a, b) => a.date.localeCompare(b.date))
  if (days.length < 350 || days.some(day => !Number.isInteger(day.count) || day.count < 0 || !Number.isInteger(day.level) || day.level < 0 || day.level > 4 || !/^\d{4}-\d{2}-\d{2}$/.test(day.date))) {
    throw new Error('GitHub returned an incomplete contribution calendar. The existing data was kept.')
  }
  return { username, days }
}

async function main() {
  const combined = combineCalendars(await Promise.all(usernames.map(readCalendar)))
  const data = {
    fetchedAt: new Date().toISOString(),
    ...combined,
  }
  const destination = new URL('../src/data/github.json', import.meta.url)
  await mkdir(new URL('../src/data/', import.meta.url), { recursive: true })
  await writeFile(destination, JSON.stringify(data, null, 2) + '\n')
  console.log(`Saved ${data.days.length} days and ${data.total} contributions across ${data.accounts.length} accounts.`)
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
