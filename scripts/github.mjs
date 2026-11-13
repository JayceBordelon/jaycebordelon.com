const month = date => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

export function renderGitHub(data) {
  const start = data.days[0].date
  const end = data.days.at(-1).date
  const summary = `${data.total.toLocaleString('en-US')} contributions across both profiles from ${month(start)} to ${month(end)}.`
  const offset = new Date(`${start}T12:00:00Z`).getUTCDay()
  const weeks = Math.ceil((data.days.length + offset) / 7)
  const emptyDays = '<span aria-hidden="true"></span>'.repeat(offset)
  const days = data.days.map(day => {
    const breakdown = data.accounts.map(account => `${account.username}: ${day.counts[account.username]}`).join(', ')
    return `<span class="contribution-day" data-level="${day.level}" title="${day.date}: ${day.count} ${day.count === 1 ? 'contribution' : 'contributions'} (${breakdown})" aria-hidden="true"></span>`
  }).join('')
  return `<div class="github-activity">
    <p class="github-summary">${summary}</p>
    <div class="contribution-calendar" style="--weeks: ${weeks}" role="img" aria-label="${summary} Each square represents one day. Darker blue means more contributions.">${emptyDays}${days}</div>
  </div>`
}
