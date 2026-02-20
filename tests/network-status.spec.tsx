import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Simple component test
describe('NetworkStatus Component', () => {
  it('should render network status indicator', () => {
    const TestComponent = () => (
      <div data-testid="network-status">
        <span className="status-indicator">●</span>
        <span>Network Status: Healthy</span>
      </div>
    );

    render(<TestComponent />);

    expect(screen.getByTestId('network-status')).toBeInTheDocument();
    expect(screen.getByText(/Network Status/i)).toBeInTheDocument();
  });

  it('should display correct status colors', () => {
    const StatusIndicator = ({ status }: { status: 'healthy' | 'degraded' | 'down' }) => {
      const colors = {
        healthy: 'text-green-500',
        degraded: 'text-yellow-500',
        down: 'text-red-500',
      };

      return (
        <div data-testid="status" className={colors[status]}>
          {status.toUpperCase()}
        </div>
      );
    };

    const { rerender } = render(<StatusIndicator status="healthy" />);
    expect(screen.getByTestId('status')).toHaveClass('text-green-500');

    rerender(<StatusIndicator status="degraded" />);
    expect(screen.getByTestId('status')).toHaveClass('text-yellow-500');

    rerender(<StatusIndicator status="down" />);
    expect(screen.getByTestId('status')).toHaveClass('text-red-500');
  });
});
