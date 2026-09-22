import React, { useState, useMemo } from "react";
import { useFarm } from "../state/FarmContext";
import { FieldStatusGrid } from "../components/fields/FieldStatusGrid";
import { SearchInput } from "../components/filters/SearchInput";
import { StatusFilter } from "../components/filters/StatusFilter";
import { Status } from "../types";

export const FieldsPage: React.FC = () => {
  const { fields } = useFarm();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");

  const filteredFields = useMemo(() => {
    return fields.filter((f) => {
      const matchesSearch =
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.crop.toLowerCase().includes(search.toLowerCase()) ||
        (f.issue && f.issue.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus = statusFilter === "all" || f.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [fields, search, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="pb-4 border-b border-borderDefault flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-secondaryText uppercase tracking-wider mb-1">
            Zone Management
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primaryText tracking-tight">
            Monitored Fields
          </h1>
          <p className="text-xs text-secondaryText mt-1">
            Real-time status across {fields.length} active agricultural zones.
          </p>
        </div>

        <div className="text-xs text-secondaryText">
          Showing <strong className="text-primaryText">{filteredFields.length}</strong> of {fields.length} fields
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-3 rounded-card border border-borderDefault shadow-card">
        <StatusFilter selectedStatus={statusFilter} onChange={setStatusFilter} />
        <SearchInput value={search} onChange={setSearch} className="w-full sm:w-72" />
      </div>

      {/* Field Cards */}
      {filteredFields.length > 0 ? (
        <FieldStatusGrid fields={filteredFields} />
      ) : (
        <div className="p-12 text-center bg-surface border border-borderDefault rounded-card shadow-card">
          <h3 className="text-sm font-semibold text-primaryText">No fields found</h3>
          <p className="text-xs text-secondaryText mt-1">
            No fields match your search "{search}" and status "{statusFilter}".
          </p>
          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
            }}
            className="mt-3 px-3 py-1.5 rounded-btn bg-surface border border-borderDefault text-xs text-primaryText hover:border-borderStrong transition-colors shadow-sm"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
};
