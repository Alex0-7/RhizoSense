import React from "react";
import { FieldSummary } from "../../types";
import { FieldCard } from "./FieldCard";

interface FieldStatusGridProps {
  fields: FieldSummary[];
  className?: string;
}

export const FieldStatusGrid: React.FC<FieldStatusGridProps> = ({ fields, className = "" }) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 ${className}`}>
      {fields.map((field) => (
        <FieldCard key={field.id} field={field} />
      ))}
    </div>
  );
};
