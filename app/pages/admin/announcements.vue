<script setup lang="ts">
import { Megaphone } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })

const { listAnnouncements, createAnnouncement, updateAnnouncement } = useAnnouncementsApi()

const { data, pending, error, refresh } = await useAsyncData(
  'admin-announcements',
  () => listAnnouncements({ page_size: 50 }),
)
const announcements = computed(() => data.value?.results ?? [])

// --- Create / edit form ---------------------------------------------------
// Same form handles both create and edit: editingId set -> update instead
// of create, and the fields are pre-filled from the row being edited.
const showForm = ref(false)
const editingId = ref<string | null>(null)
const title = ref('')
const message = ref('')
const isActive = ref(true)
const saving = ref(false)
const formError = ref('')

function openCreateForm() {
  editingId.value = null
  title.value = ''
  message.value = ''
  isActive.value = true
  formError.value = ''
  showForm.value = true
}

function openEditForm(row: { id: string; title: string; message: string; is_active: boolean }) {
  editingId.value = row.id
  title.value = row.title
  message.value = row.message
  isActive.value = row.is_active
  formError.value = ''
  showForm.value = true
}

async function handleSubmit() {
  formError.value = ''
  saving.value = true
  try {
    if (editingId.value) {
      await updateAnnouncement(editingId.value, {
        title: title.value, message: message.value, is_active: isActive.value,
      })
    } else {
      await createAnnouncement({
        title: title.value, message: message.value, is_active: isActive.value,
      })
    }
    showForm.value = false
    await refresh()
  } catch {
    formError.value = "Couldn't save this announcement. Check the fields and try again."
  } finally {
    saving.value = false
  }
}

// Quick toggle for is_active directly from the list, without opening the
// full edit form — the most common follow-up action on an announcement.
async function toggleActive(row: { id: string; is_active: boolean }) {
  try {
    await updateAnnouncement(row.id, { is_active: !row.is_active })
    await refresh()
  } catch {
    // Silently ignored here on purpose — this is a lightweight list-row
    // toggle; the full edit form (with a visible formError) is where a
    // failure is worth surfacing prominently.
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold text-text-primary">Announcements</h1>
      <button
        type="button"
        class="rounded-card bg-secondary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        @click="showForm ? (showForm = false) : openCreateForm()"
      >
        {{ showForm ? 'Cancel' : 'New Announcement' }}
      </button>
    </div>

    <form
      v-if="showForm"
      class="space-y-3 rounded-card border border-border bg-surface p-5"
      @submit.prevent="handleSubmit"
    >
      <div>
        <label class="mb-1 block text-sm font-medium text-text-primary">Title</label>
        <input
          v-model="title"
          required
          class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
        />
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium text-text-primary">Message</label>
        <textarea
          v-model="message"
          required
          rows="4"
          class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
        />
      </div>
      <label class="flex items-center gap-2 text-sm text-text-primary">
        <input v-model="isActive" type="checkbox" class="rounded border-border" />
        Active (visible to customers)
      </label>
      <p v-if="formError" role="alert" class="text-sm text-error">{{ formError }}</p>
      <button
        type="submit"
        :disabled="saving"
        class="rounded-card bg-secondary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {{ saving ? 'Saving…' : editingId ? 'Save Changes' : 'Publish Announcement' }}
      </button>
    </form>

    <LoadingState v-if="pending" :rows="4" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <EmptyState v-else-if="!announcements.length" :icon="Megaphone" title="No announcements yet" />
    <div v-else class="space-y-3">
      <div
        v-for="a in announcements"
        :key="a.id"
        class="rounded-card border border-border bg-surface p-4"
      >
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p class="text-sm font-semibold text-text-primary">{{ a.title }}</p>
            <p class="text-xs text-text-secondary">
              {{ a.created_by_name || 'System' }} · {{ formatDateTime(a.created_at) }}
            </p>
          </div>
          <StatusBadge :label="a.is_active ? 'Active' : 'Inactive'" :tone="a.is_active ? 'success' : 'neutral'" />
        </div>
        <p class="mt-2 text-sm text-text-primary">{{ a.message }}</p>
        <div class="mt-3 flex gap-3">
          <button type="button" class="text-sm font-medium text-accent hover:underline" @click="openEditForm(a)">
            Edit
          </button>
          <button type="button" class="text-sm font-medium text-text-secondary hover:underline" @click="toggleActive(a)">
            {{ a.is_active ? 'Deactivate' : 'Activate' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>