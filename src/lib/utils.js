// src/lib/utils.js
export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export function dateToPosition(date, startDate, endDate, timelineWidth) {
  const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24)
  const daysSinceStart = (date - startDate) / (1000 * 60 * 60 * 24)
  return (daysSinceStart / totalDays) * timelineWidth
}

export function positionToDate(position, startDate, endDate, timelineWidth) {
  const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24)
  const ratio = position / timelineWidth
  const daysFromStart = ratio * totalDays
  return new Date(startDate.getTime() + (daysFromStart * 24 * 60 * 60 * 1000))
}