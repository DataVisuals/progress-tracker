module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  verbose: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/tests/**',
    '!src/seed-*.js',
    '!src/populate-*.js',
    '!src/migrate-*.js',
    '!src/simulate-*.js',
    '!src/add-*.js',
    '!src/create-*.js'
  ]
};
