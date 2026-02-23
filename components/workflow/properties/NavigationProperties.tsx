"use client";

interface NavigationPropertiesProps {
  data: any;
  onUpdate: (data: any) => void;
}

export default function NavigationProperties({
  data,
  onUpdate,
}: NavigationPropertiesProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Label
        </label>
        <input
          type="text"
          value={data.label || "Navigation"}
          onChange={(e) => onUpdate({ ...data, label: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={data.enabled !== false}
            onChange={(e) => onUpdate({ ...data, enabled: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm text-gray-700">Enabled</span>
        </label>
      </div>
    </div>
  );
}
