import test from 'node:test'
import assert from 'node:assert/strict'
import { combineCalendars } from './github-data.mjs'

test('adds both accounts on overlapping dates and preserves each account total', () => {
  const result = combineCalendars([
    { username: 'personal', days: [{ date: '2026-01-02', count: 3 }, { date: '2026-01-01', count: 2 }] },
    { username: 'work', days: [{ date: '2026-01-02', count: 4 }, { date: '2026-01-03', count: 1 }] },
  ])
  assert.equal(result.total, 10)
  assert.deepEqual(result.accounts.map(account => account.total), [5, 5])
  assert.deepEqual(result.days.map(day => [day.date, day.count, day.level]), [
    ['2026-01-01', 2, 2], ['2026-01-02', 7, 4], ['2026-01-03', 1, 1],
  ])
  assert.deepEqual(result.days[1].counts, { personal: 3, work: 4 })
})

test('fills missing dates and handles two accounts with no activity', () => {
  const result = combineCalendars([
    { username: 'personal', days: [{ date: '2026-01-01', count: 0 }] },
    { username: 'work', days: [{ date: '2026-01-03', count: 0 }] },
  ])
  assert.equal(result.total, 0)
  assert.equal(result.days.length, 3)
  assert.deepEqual(result.days.map(day => day.level), [0, 0, 0])
  assert.deepEqual(result.days[1].counts, { personal: 0, work: 0 })
})

test('rejects repeated accounts or dates instead of counting them twice', () => {
  const calendar = { username: 'personal', days: [{ date: '2026-01-01', count: 2 }] }
  assert.throws(() => combineCalendars([calendar, calendar]), /appear once/)
  assert.throws(() => combineCalendars([{ ...calendar, days: [...calendar.days, ...calendar.days] }]), /Duplicate contribution date/)
})
