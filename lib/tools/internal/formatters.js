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
