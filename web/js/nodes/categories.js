// categories.js — node type / icon key -> design category (drives data-cat colour)

export const NODE_CATEGORY = {
  customInput: 'source',
  database: 'source',
  api: 'source',
  llm: 'model',
  text: 'shape',
  transform: 'shape',
  filter: 'shape',
  validator: 'check',
  customOutput: 'sink',
};

// Icon keys (see nodeIcons ICON_MAP) -> category
export const ICON_CATEGORY = {
  input: 'source',
  database: 'source',
  api: 'source',
  llm: 'model',
  text: 'shape',
  transform: 'shape',
  filter: 'shape',
  validator: 'check',
  output: 'sink',
};

export const categoryForNodeType = (type) => NODE_CATEGORY[type] || 'source';
export const categoryForIcon = (iconKey) => ICON_CATEGORY[iconKey] || 'source';
