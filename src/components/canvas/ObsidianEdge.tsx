import React from 'react';
import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react';

export const ObsidianEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) => {
  // Using React Flow's getBezierPath gives us standard bezier. 
  // For true Obsidian S-curves, usually delta calculation is used, but getBezierPath is highly optimized.
  // Obsidian's visual tension is generally softer than default ReactFlow.
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.25, // Lower curvature for softer Obsidian-like S-curves
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{
         ...style, 
         strokeWidth: style.strokeWidth || 2, 
         stroke: style.stroke || '#666',
      }} />
    </>
  );
};
