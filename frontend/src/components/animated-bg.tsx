interface AnimatedBgProps {
  variant: 'landing' | 'dashboard';
}

export function AnimatedBg({ variant }: AnimatedBgProps) {
  if (variant === 'landing') {
    return (
      <div className="fixed inset-0 overflow-hidden" style={{ zIndex: -1 }}>
        {/* Primary indigo sweep — large, dramatic */}
        <div
          className="mesh-blob"
          style={{
            width: 900,
            height: 900,
            top: '-20%',
            right: '-15%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, rgba(99, 102, 241, 0) 60%)',
            animation: 'mesh-drift-1 15s ease-in-out infinite alternate',
          }}
        />
        {/* Violet accent — mid-left */}
        <div
          className="mesh-blob"
          style={{
            width: 700,
            height: 700,
            top: '20%',
            left: '-15%',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.25) 0%, rgba(139, 92, 246, 0) 60%)',
            animation: 'mesh-drift-2 18s ease-in-out infinite alternate',
          }}
        />
        {/* Pink/fuchsia — bottom right, adds warmth like Stripe */}
        <div
          className="mesh-blob"
          style={{
            width: 600,
            height: 600,
            bottom: '-10%',
            right: '10%',
            background: 'radial-gradient(circle, rgba(217, 70, 239, 0.2) 0%, rgba(217, 70, 239, 0) 60%)',
            animation: 'mesh-drift-3 22s ease-in-out infinite alternate',
          }}
        />
        {/* Teal accent — top left corner for contrast */}
        <div
          className="mesh-blob"
          style={{
            width: 500,
            height: 500,
            top: '-10%',
            left: '20%',
            background: 'radial-gradient(circle, rgba(34, 211, 238, 0.12) 0%, transparent 60%)',
            animation: 'mesh-drift-1 25s ease-in-out infinite alternate-reverse',
          }}
        />
        {/* Warm amber streak — like Stripe's orange/peach */}
        <div
          className="mesh-blob"
          style={{
            width: 400,
            height: 800,
            bottom: '5%',
            left: '30%',
            borderRadius: '40%',
            background: 'radial-gradient(ellipse, rgba(251, 146, 60, 0.1) 0%, transparent 60%)',
            animation: 'mesh-drift-2 20s ease-in-out infinite alternate-reverse',
          }}
        />
      </div>
    );
  }

  // Dashboard — visible flowing gradients
  return (
    <div className="fixed inset-0 overflow-hidden" style={{ zIndex: -1 }}>
      {/* Top-right indigo glow */}
      <div
        className="ambient-orb"
        style={{
          width: 1200,
          height: 1200,
          top: '-30%',
          right: '-20%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 60%)',
          animation: 'orb-float-1 25s ease-in-out infinite',
        }}
      />
      {/* Bottom-left violet */}
      <div
        className="ambient-orb"
        style={{
          width: 1000,
          height: 1000,
          bottom: '-25%',
          left: '-15%',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 60%)',
          animation: 'orb-float-2 30s ease-in-out infinite',
        }}
      />
      {/* Center faint fuchsia — adds depth */}
      <div
        className="ambient-orb"
        style={{
          width: 800,
          height: 800,
          top: '40%',
          left: '30%',
          background: 'radial-gradient(circle, rgba(217, 70, 239, 0.05) 0%, transparent 60%)',
          animation: 'orb-float-1 35s ease-in-out infinite reverse',
        }}
      />
    </div>
  );
}
