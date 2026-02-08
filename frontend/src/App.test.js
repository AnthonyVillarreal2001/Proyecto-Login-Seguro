import { render, screen } from '@testing-library/react';
import App from './App';
import axios from 'axios';

jest.mock('./utils/auth', () => ({
  isAuthenticated: jest.fn(),
  getUserRole: jest.fn()
}));

jest.mock('./utils/sessionManager', () => ({
  initSessionManager: jest.fn()
}));

jest.mock('axios');

const { isAuthenticated, getUserRole } = require('./utils/auth');

describe('App routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.history.pushState({}, '', '/');
  });

  test('redirecciona a login cuando no está autenticado', async () => {
    isAuthenticated.mockReturnValue(false);
    axios.get.mockResolvedValue({ data: { preferences: { theme: 'light' } } });

    render(<App />);

    expect(await screen.findByText(/Verificar credenciales/i)).toBeInTheDocument();
  });

  test('muestra panel admin cuando autenticado con rol admin', async () => {
    isAuthenticated.mockReturnValue(true);
    getUserRole.mockReturnValue('admin');
    localStorage.setItem('token', 'fake-token');

    axios.get.mockImplementation((url) => {
      if (url === '/profile') {
        return Promise.resolve({ data: { preferences: { theme: 'light' } } });
      }
      if (url.startsWith('/users')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: {} });
    });
    axios.put = jest.fn().mockResolvedValue({});
    axios.delete = jest.fn().mockResolvedValue({});

    window.history.pushState({}, '', '/admin');

    render(<App />);

    expect(await screen.findByText(/Panel de Administración/i)).toBeInTheDocument();
  });
});
