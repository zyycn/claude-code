import { getSecureStorage } from './secureStorage/index.js'

export type CompatibleApiProvider = 'anthropic' | 'openai'

export type CustomApiStorageData = {
  provider?: CompatibleApiProvider
  baseURL?: string
  apiKey?: string
  model?: string
  savedModels?: string[]
  savedModelsByProvider?: Partial<Record<CompatibleApiProvider, string[]>>
}

const CUSTOM_API_STORAGE_KEY = 'customApiEndpoint'

export function readCustomApiStorage(): CustomApiStorageData {
  const storage = getSecureStorage() as {
    read?: () => Record<string, unknown> | null
    update?: (data: Record<string, unknown>) => { success: boolean }
  }
  const data = storage.read?.() ?? {}
  const raw = data[CUSTOM_API_STORAGE_KEY]
  if (!raw || typeof raw !== 'object') return {}

  const value = raw as Record<string, unknown>
  return {
    provider:
      value.provider === 'openai' || value.provider === 'anthropic'
        ? value.provider
        : undefined,
    baseURL: typeof value.baseURL === 'string' ? value.baseURL : undefined,
    apiKey: typeof value.apiKey === 'string' ? value.apiKey : undefined,
    model: typeof value.model === 'string' ? value.model : undefined,
    savedModels: Array.isArray(value.savedModels)
      ? value.savedModels.filter(
          (item): item is string => typeof item === 'string',
        )
      : [],
    savedModelsByProvider: isSavedModelsByProvider(value.savedModelsByProvider)
      ? value.savedModelsByProvider
      : {},
  }
}

export function writeCustomApiStorage(next: CustomApiStorageData): void {
  const storage = getSecureStorage() as {
    read?: () => Record<string, unknown> | null
    update?: (data: Record<string, unknown>) => { success: boolean }
  }
  const current = storage.read?.() ?? {}
  storage.update?.({
    ...current,
    [CUSTOM_API_STORAGE_KEY]: next,
  })
}

export function getSavedModelsForProvider(
  data: CustomApiStorageData,
  provider: CompatibleApiProvider,
): string[] {
  const scopedModels = data.savedModelsByProvider?.[provider]
  if (Array.isArray(scopedModels) && scopedModels.length > 0) {
    return uniqueTrimmedModels(scopedModels)
  }
  const hasScopedModels = Object.values(data.savedModelsByProvider ?? {}).some(
    models => Array.isArray(models) && models.length > 0,
  )
  if (hasScopedModels) {
    return []
  }
  return uniqueTrimmedModels(data.savedModels ?? [])
}

export function addSavedModelForProvider(
  data: CustomApiStorageData,
  provider: CompatibleApiProvider,
  model: string,
): CustomApiStorageData {
  const nextModel = model.trim()
  if (!nextModel) {
    return data
  }

  const nextSavedModels = [
    ...new Set([...getSavedModelsForProvider(data, provider), nextModel]),
  ]

  return {
    ...data,
    savedModels: nextSavedModels,
    savedModelsByProvider: {
      ...(data.savedModelsByProvider ?? {}),
      [provider]: nextSavedModels,
    },
  }
}

function uniqueTrimmedModels(models: string[]): string[] {
  return [...new Set(models.map(model => model.trim()).filter(Boolean))]
}

function isSavedModelsByProvider(
  value: unknown,
): value is Partial<Record<CompatibleApiProvider, string[]>> {
  if (!value || typeof value !== 'object') {
    return false
  }
  return ['anthropic', 'openai'].every(provider => {
    const models = (value as Record<string, unknown>)[provider]
    return (
      models === undefined ||
      (Array.isArray(models) && models.every(item => typeof item === 'string'))
    )
  })
}
