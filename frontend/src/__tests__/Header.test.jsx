import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Header from '../components/Header';
import { describe, it, expect, vi } from 'vitest';

// Mock hooks
vi.mock('../hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({
    isSubscribed: false,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  }),
}));

// Mock fetch
global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ temperature: 25, code_meteo: 0 }),
  })
);

describe('Header Component', () => {
  it('renders the logo text', () => {
    render(
      <BrowserRouter>
        <Header wsConnected={true} />
      </BrowserRouter>
    );
    expect(screen.getByText('SmartPark')).toBeDefined();
  });

  it('shows connected status when wsConnected is true', () => {
    render(
      <BrowserRouter>
        <Header wsConnected={true} />
      </BrowserRouter>
    );
    expect(screen.getByText('En direct')).toBeDefined();
  });

  it('shows disconnected status when wsConnected is false', () => {
    render(
      <BrowserRouter>
        <Header wsConnected={false} />
      </BrowserRouter>
    );
    expect(screen.getByText('Déconnecté')).toBeDefined();
  });
});
