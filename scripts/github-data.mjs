export function combineCalendars(calendars) {
  if (!calendars.length || new Set(calendars.map(calendar => calendar.username)).size !== calendars.length) {
    throw new Error('Each GitHub account must appear once.')
  }
  const contributions = new Map()
  const accounts = calendars.map(({ username, days }) => {
    const seen = new Set()
    for (const day of days) {
      if (seen.has(day.date)) throw new Error(`Duplicate contribution date for ${username}: ${day.date}`)
      seen.add(day.date)
      const counts = contributions.get(day.date) ?? {}
      counts[username] = day.count
      contributions.set(day.date, counts)
    }
    return { username, url: `https://github.com/${username}`, total: days.reduce((sum, day) => sum + day.count, 0) }
  })
  const dates = [...contributions.keys()].sort()
  if (!dates.length) throw new Error('No contribution dates were returned.')
  const days = []
  const lastDate = Date.parse(`${dates.at(-1)}T00:00:00Z`)
  for (let timestamp = Date.parse(`${dates[0]}T00:00:00Z`); timestamp <= lastDate; timestamp += 86400000) {
    const date = new Date(timestamp).toISOString().slice(0, 10)
    const counts = Object.fromEntries(accounts.map(account => [account.username, contributions.get(date)?.[account.username] ?? 0]))
    days.push({ date, count: Object.values(counts).reduce((sum, count) => sum + count, 0), counts })
  }
  const maximum = Math.max(...days.map(day => day.count))
  return {
    accounts,
    total: days.reduce((sum, day) => sum + day.count, 0),
    days: days.map(day => ({ ...day, level: day.count === 0 ? 0 : Math.ceil(day.count / maximum * 4) })),
  }
}
