export default {
  plugins: [
    '@trivago/prettier-plugin-sort-imports'
  ],
  semi: false,
  trailingComma: 'all',
  printWidth: 108,
  singleQuote: true,
  tabWidth: 2,
  arrowParens: 'always',
  importOrder: [
    '<THIRD_PARTY_MODULES>',
    '^[./]',
    '^[../]'
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
}
