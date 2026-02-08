import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Register from '../Register';
import axios from 'axios';

jest.mock('axios');
jest.mock('face-api.js');

// Mock navigator media devices to avoid camera usage
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn().mockRejectedValue(new Error('No camera in test'))
  },
  configurable: true
});

describe('Register component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('muestra error cuando las contraseñas no coinciden', async () => {
    render(<Register />);

    await userEvent.type(screen.getByLabelText(/Nombre completo/i), 'Test User');
    await userEvent.type(screen.getByLabelText(/Correo electrónico/i), 'new@test.com');
    await userEvent.type(screen.getByLabelText(/^Contraseña/i), 'password123');
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/i), 'different');

    await userEvent.click(screen.getByRole('button', { name: /Continuar con registro facial/i }));

    expect(await screen.findByText(/Las contraseñas no coinciden/i)).toBeInTheDocument();
  });
});
