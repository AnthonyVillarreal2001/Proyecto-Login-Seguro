const React = require('react');

const navigateMock = jest.fn();

module.exports = {
  __esModule: true,
  useNavigate: () => navigateMock,
  BrowserRouter: ({ children }) => React.createElement('div', null, children),
  Routes: ({ children }) => React.createElement('div', null, children),
  Route: ({ element }) => element,
  Navigate: ({ to }) => React.createElement('div', null, `Navigate to ${to}`),
  MemoryRouter: ({ children, initialEntries = ['/'] }) => React.createElement('div', { 'data-router': initialEntries[0] }, children)
};
