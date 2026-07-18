import React from 'react';
import { RoomType } from '../../types/capture.types';

interface Props {
  roomType: RoomType;
}

export const GuidanceOverlay: React.FC<Props> = ({ roomType }) => {
  const instructions: Record<RoomType, string> = {
    KITCHEN: 'Keep counters and pathways clearly in view.',
    BATHROOM: 'Ensure tub/shower threshold is visible.',
    STAIRS: 'Capture top and bottom landings.',
    ENTRYWAY: 'Focus on steps and door clearance.',
    LIVING_ROOM: 'Show main walking paths.'
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between">
      {/* Top Banner */}
      <div className="bg-black/60 pt-12 pb-4 px-6 backdrop-blur-sm text-center">
        <h2 className="text-white font-bold text-xl mb-1">{roomType}</h2>
        <p className="text-gray-200 text-sm">{instructions[roomType] || 'Hold camera steady.'}</p>
      </div>

      {/* Target Grid */}
      <div className="flex-1 flex items-center justify-center p-8">
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="opacity-50">
          {/* Rule of thirds grid */}
          <line x1="33" y1="0" x2="33" y2="100" stroke="white" strokeWidth="0.5" strokeDasharray="2,2" />
          <line x1="66" y1="0" x2="66" y2="100" stroke="white" strokeWidth="0.5" strokeDasharray="2,2" />
          <line x1="0" y1="33" x2="100" y2="33" stroke="white" strokeWidth="0.5" strokeDasharray="2,2" />
          <line x1="0" y1="66" x2="100" y2="66" stroke="white" strokeWidth="0.5" strokeDasharray="2,2" />
          
          {/* Alignment Box */}
          <rect x="10" y="20" width="80" height="60" fill="none" stroke="#3b82f6" strokeWidth="1" rx="4" />
          
          {/* Corner accents */}
          <path d="M 10 30 L 10 20 L 20 20" fill="none" stroke="#fff" strokeWidth="2" />
          <path d="M 80 20 L 90 20 L 90 30" fill="none" stroke="#fff" strokeWidth="2" />
          <path d="M 10 70 L 10 80 L 20 80" fill="none" stroke="#fff" strokeWidth="2" />
          <path d="M 80 80 L 90 80 L 90 70" fill="none" stroke="#fff" strokeWidth="2" />
        </svg>
      </div>
      
      {/* Spacer for bottom controls */}
      <div className="h-48" />
    </div>
  );
};
