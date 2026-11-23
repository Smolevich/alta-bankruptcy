// A "lines" field arrives as an array, an older one-line value as a string: both become a list of non-empty lines.
export const asList = (value) =>
	(Array.isArray(value) ? value : [value ?? ''])
		.map((s) => s.trim())
		.filter(Boolean);

export const joinLines = (value, sep) => asList(value).join(sep);
