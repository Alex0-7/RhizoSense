import React from "react";

interface ChartContainerProps {
  title: string;
  description?: string;
  controls?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  description,
  controls,
  children,
  className = "",
}) => {
  return (
    <div className={`rounded-card border border-borderDefault bg-surface p-5 shadow-card ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-primaryText uppercase tracking-wider">{title}</h3>
          {description && <p className="text-xs text-secondaryText mt-0.5">{description}</p>}
        </div>
        {controls && <div className="flex items-center gap-2 flex-wrap">{controls}</div>}
      </div>

      <div className="w-full h-72 sm:h-80">{children}</div>
    </div>
  );
};
