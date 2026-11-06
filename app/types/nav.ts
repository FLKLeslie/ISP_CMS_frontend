import type { Component } from 'vue'
export interface NavItem {
  label: string
  to: string
  icon: Component
  // Optional count badge (e.g. unread notifications, pending review
  // items). Omit or set to 0 to render no badge at all.
  badge?: number
  /** Routes that should keep this sidebar destination active (e.g. tabs under one section). */
  activePaths?: string[]
}