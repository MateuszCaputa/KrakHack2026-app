interface AnimatedBgProps {
  variant: 'landing' | 'dashboard';
}

export function AnimatedBg({ variant }: AnimatedBgProps) {
  if (variant === 'landing') {
    return (
      <div className="fixed inset-0 overflow-hidden" style={{ zIndex: -1 }}>
        {/* Large indigo blob — top right */}
        <div
          className="mesh-blob"
          style={{
            width: 700,
            height: 700,
            top: '-10%',
            right: '-5%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, rgba(99, 102, 241, 0) 70%)',
            animation: 'mesh-drift-1 20s ease-in-out infinite alternate',
          }}
        />
        {/* Violet blob — center left */}
        <div
          className="mesh-blob"
          style={{
            width: 550,
            height: 550,
            top: '30%',
            left: '-8%',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0) 70%)',
            animation: 'mesh-drift-2 25s ease-in-out infinite alternate',
          }}
        />
        {/* Blue/pink blob — bottom right */}
        <div
          className="mesh-blob"
          style={{
            width: 500,
            height: 500,
            bottom: '-5%',
            right: '20%',
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.12) 0%, rgba(59, 130, 246, 0) 70%)',
            animation: 'mesh-drift-3 30s ease-in-out infinite alternate',
          }}
        />
      </div>
    );
  }

  // Dashboard — very subtle ambient orbs
  return (
    <div className="fixed inset-0 overflow-hidden" style={{ zIndex: -1 }}>
      <div
        className="ambient-orb"
        style={{
          width: 900,
          height: 900,
          top: '-20%',
          right: '-15%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.04) 0%, transparent 70%)',
          animation: 'orb-float-1 40s ease-in-out infinite',
        }}
      />
      <div
        className="ambient-orb"
        style={{
          width: 700,
          height: 700,
          bottom: '-15%',
          left: '-10%',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.03) 0%, transparent 70%)',
          animation: 'orb-float-2 55s ease-in-out infinite',
        }}
      />
    </div>
  );
}
