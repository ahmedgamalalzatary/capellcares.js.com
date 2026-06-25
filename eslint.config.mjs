import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [{
    ignores: ['**/.next/**', '**/dist/**', '**/node_modules/**']
}, {
    files: ['apps/**/*.ts', 'apps/**/*.tsx'],
    languageOptions: { parser: tsParser },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
        '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
        'no-unused-vars': 'off'
    }
}];