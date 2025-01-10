module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    transform: {
        '^.+\\.ts$': 'ts-jest'
    },
    testMatch: [
        '**/test/**/*.test.ts'
    ],
    moduleFileExtensions: ['ts', 'js', 'json', 'node'],
    setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
    moduleNameMapper: {
        '^babylonjs$': '<rootDir>/test/mocks/babylon.js'
    }
};
