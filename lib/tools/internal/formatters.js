export function toSuccessContent(payload, options = {}) {
  const { pretty = true } = options;
  const text = pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);

  return {
    content: [
      {
        type: 'text',
        text
      }
    ]
  };
}

export function toErrorContent(error) {
  const message = error?.message ?? String(error);
  const details = error?.response?.data;
  const textParts = [`Error: ${message}`];

  if (details) {
    try {
      textParts.push(JSON.stringify(details, null, 2));
    } catch (stringifyError) {
      textParts.push(String(details));
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: textParts.join('\n')
      }
    ],
    isError: true
  };
}

/**
 * Parse structured data from MCP response
 * Looks for JSON resource in content array and extracts structured data
 */
export function parseStructuredData(result) {
  if (!result?.content || !Array.isArray(result.content)) {
    return null;
  }

  // Look for resource content with JSON data
  for (const item of result.content) {
    if (item.type === 'resource' && item.resource?.mimeType === 'application/json') {
      try {
        return JSON.parse(item.resource.text);
      } catch (error) {
        console.error('Failed to parse structured data:', error);
        return null;
      }
    }
  }

  return null;
}

/**
 * Enhance result with structured data annotation
 * Adds structured data to the response while preserving original text
 */
export function enhanceWithStructuredData(result) {
  const structuredData = parseStructuredData(result);

  if (structuredData) {
    // Add metadata about structured data availability
    return {
      ...result,
      _structuredData: structuredData,
      _hasStructuredData: true
    };
  }

  return result;
}
