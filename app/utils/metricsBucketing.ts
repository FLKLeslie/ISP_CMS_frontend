import type { DeviceMetric } from '~/types/api/devices'

export interface MetricBucket {
  label: string
  start: Date
  end: Date
  samples: DeviceMetric[]
}

/**
 * Builds evenly-spaced time buckets ending at "now" — the x-axis never
 * shows a time in the future, and never crams in more labels than the
 * selected range can meaningfully support.
 *
 *   - 24h range -> 2-hour buckets (12 points), labelled by clock time
 *     (e.g. "14:00")
 *   - 7-day range -> 1 bucket per calendar day (7 points), labelled by
 *     date (e.g. "Aug 15"), aligned to local midnight rather than a
 *     rolling 24h window — so labels read as recognisable dates, and the
 *     "today" bucket naturally only covers up to the current moment since
 *     there's no future data to fall into it.
 */
/**
 * Returns the exact lower boundary buildMetricBuckets will use for a given
 * range — the caller (the history page's API fetch) should use this as
 * its `timestamp_after` filter, NOT a naive `now - rangeHours*3600000`
 * subtraction. For the 7-day view specifically, buckets are aligned to
 * calendar-day midnight, which does not land exactly 168 hours before
 * "now" (the gap is up to just under 24 hours depending on the time of
 * day). Fetching with a naive rolling-168h window while bucketing on
 * calendar days would silently drop that gap's worth of otherwise-valid,
 * successfully-fetched data into no bucket at all, with no error - the
 * exact kind of silent data loss this project has already hit once with
 * pagination. Using the same boundary for both the fetch and the
 * bucketing eliminates the mismatch entirely.
 */
export function getBucketRangeStart(rangeHours: 24 | 168): Date {
  const now = new Date()
  if (rangeHours === 168) {
    const dayStart = new Date(now)
    dayStart.setHours(0, 0, 0, 0)
    dayStart.setDate(dayStart.getDate() - 6)
    return dayStart
  }
  return new Date(now.getTime() - 24 * 3600_000)
}

export function buildMetricBuckets(metrics: DeviceMetric[], rangeHours: 24 | 168): MetricBucket[] {
  const now = new Date()
  const buckets: MetricBucket[] = []

  if (rangeHours === 168) {
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now)
      dayStart.setHours(0, 0, 0, 0)
      dayStart.setDate(dayStart.getDate() - i)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)
      buckets.push({
        label: dayStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        start: dayStart,
        end: dayEnd,
        samples: [],
      })
    }
  } else {
    const bucketHours = 2
    const bucketCount = 24 / bucketHours // 12 buckets
    for (let i = bucketCount - 1; i >= 0; i--) {
      const end = new Date(now.getTime() - i * bucketHours * 3600_000)
      const start = new Date(end.getTime() - bucketHours * 3600_000)
      buckets.push({
        label: end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
        start,
        end,
        samples: [],
      })
    }
  }

  // Small bucket counts (max 12) make a linear scan per sample fine here —
  // no need for anything cleverer at this scale.
  for (const sample of metrics) {
    const ts = new Date(sample.timestamp)
    const bucket = buckets.find((b) => ts >= b.start && ts < b.end)
    if (bucket) bucket.samples.push(sample)
  }

  return buckets
}

/**
 * Averages a numeric field across a bucket's samples. Returns null (not
 * 0) when the bucket has no samples, so the chart renders a genuine gap
 * for periods with no data rather than a misleading flat line at zero.
 */
export function averageField(
  bucket: MetricBucket,
  field: (m: DeviceMetric) => number | string | null | undefined,
): number | null {
  const values = bucket.samples
    .map((m) => {
      const raw = field(m)
      return raw == null ? null : Number(raw)
    })
    .filter((v): v is number => v != null && !Number.isNaN(v))
  if (!values.length) return null
  const sum = values.reduce((total, v) => total + v, 0)
  return Math.round((sum / values.length) * 100) / 100
}

/**
 * Availability per bucket, as a percentage of samples in that bucket with
 * link_state === 'UP'. This reflects the PROPORTION of heartbeats that
 * were up within each time window, which is a meaningfully better
 * approximation of real uptime than plotting a raw 0/1 per sample —
 * though it's still not a true time-weighted integral over the whole
 * window (a bucket with 1 sample and a bucket with 50 samples are
 * weighted equally as "one data point" on the chart either way).
 */
export function availabilityPercent(bucket: MetricBucket): number | null {
  if (!bucket.samples.length) return null
  const upCount = bucket.samples.filter((m) => m.link_state === 'UP').length
  return Math.round((upCount / bucket.samples.length) * 1000) / 10
}