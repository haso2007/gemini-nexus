export function resolveProvider(settings = {}) {
  if (typeof settings.provider === 'string' && settings.provider) {
    return settings.provider;
  }

  if (settings.useOfficialApi === true || settings.geminiUseOfficialApi === true) {
    return 'official';
  }

  return 'web';
}

export function normalizeConnectionSettings(settings = {}) {
  const { useOfficialApi, geminiUseOfficialApi, ...rest } = settings;
  return {
    ...rest,
    provider: resolveProvider(settings),
  };
}
