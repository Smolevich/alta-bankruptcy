// A "lines" field arrives as an array, an older one-line value as a string: both become one run of text.
export const joinLines = (value, sep) =>
	(Array.isArray(value) ? value : [value ?? ''])
		.map((s) => s.trim())
		.filter(Boolean)
		.join(sep);
