// Enter is swallowed only in one-line inputs: textareas keep their line breaks, buttons stay clickable.
export const blocksEnter = (e) => e.key === 'Enter' && e.target?.tagName === 'INPUT';
