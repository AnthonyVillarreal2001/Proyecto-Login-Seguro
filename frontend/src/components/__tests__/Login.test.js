import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../Login';
import axios from 'axios';

jest.mock('axios');
jest.mock('face-api.js');

// Mock navigator media devices to avoid errors when components access camera APIs
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn().mockRejectedValue(new Error('No camera in test'))
  },
  configurable: true
});

describe('Login component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('muestra mensaje de error si faltan credenciales', async () => {
    render(<Login />);

    const submitButton = screen.getByRole('button', { name: /Verificar credenciales/i });
    await userEvent.click(submitButton);

    expect(await screen.findByText(/Email y contraseña son obligatorios/i)).toBeInTheDocument();
  });

  test('envía credenciales y muestra modal de éxito cuando el backend pide verificación facial', async () => {
    axios.post.mockResolvedValue({ data: { requiresFaceVerification: true } });

    render(<Login />);

    await userEvent.type(screen.getByLabelText(/Correo electrónico/i), 'test@test.com');
    await userEvent.type(screen.getByLabelText(/Contraseña/i), 'password123');

    const submitButton = screen.getByRole('button', { name: /Verificar credenciales/i });
    await userEvent.click(submitButton);

    expect(axios.post).toHaveBeenCalledWith('/auth/login', { email: 'test@test.com', password: 'password123' });
    expect(await screen.findByText(/Contraseña válida\. Ahora verifique su identidad facial\./i)).toBeInTheDocument();
  });
});
