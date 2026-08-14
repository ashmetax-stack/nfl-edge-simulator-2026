"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";

interface ScheduleFiltersProps {
  week: string;
  teamQuery: string;
  onWeekChange: (week: string) => void;
  onTeamQueryChange: (q: string) => void;
  resultCount: number;
}

export function ScheduleFilters({
  week,
  teamQuery,
  onWeekChange,
  onTeamQueryChange,
  resultCount,
}: ScheduleFiltersProps) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid flex-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="week-filter">Week</Label>
          <Select
            value={week}
            onValueChange={(value) => {
              if (value != null) onWeekChange(String(value));
            }}
          >
            <SelectTrigger id="week-filter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All weeks (1–18)</SelectItem>
              {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                <SelectItem key={w} value={String(w)}>
                  Week {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="team-search">Search team</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="team-search"
              placeholder="e.g. Bills, KC, Philadelphia…"
              value={teamQuery}
              onChange={(e) => onTeamQueryChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground sm:pb-2">
        {resultCount} game{resultCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}
