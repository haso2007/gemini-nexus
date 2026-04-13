export function bindProviderEvents(section) {
  const { providerSelect, mcpEnabled } = section.elements;

  if (providerSelect) {
    providerSelect.addEventListener('change', (event) => {
      section.updateVisibility(event.target.value);
    });
  }

  if (mcpEnabled) {
    mcpEnabled.addEventListener('change', (event) => {
      section.updateMcpVisibility(event.target.checked === true);
    });
  }
}
