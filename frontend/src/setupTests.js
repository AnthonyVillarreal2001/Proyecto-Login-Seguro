// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock face-api globally to avoid loading TensorFlow platform in tests
jest.mock('face-api.js', () => require('./__mocks__/face-api'));
