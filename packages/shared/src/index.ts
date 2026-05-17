// @zettlink/shared 공개 API
export { config } from './config.js'
export type { Config } from './config.js'
export type { Card, Job, Event, Platform, CardStatus, JobStatus, EventLevel } from './types.js'
export { canonicalize } from './url-normalize.js'
export type { CanonicalUrl } from './url-normalize.js'
export { titleToSlug, repoToSlug } from './slug.js'
