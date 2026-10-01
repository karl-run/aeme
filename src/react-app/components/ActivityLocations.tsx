import { MapPinIcon, XIcon } from "lucide-react";
import { type FormEvent, useState } from "react";

import type { ActivityWithAvailability } from "../queries/activities.ts";
import {
  useAddActivityLocationMutation,
  useRemoveActivityLocationMutation,
} from "../queries/locations.ts";
import { Button } from "./ui/button.tsx";
import { Input } from "./ui/input.tsx";
import { Label } from "./ui/label.tsx";

type Props = {
  activity: ActivityWithAvailability;
  /** The activity's creator may add and retire places; everyone else just
   * reads the list. */
  canEdit: boolean;
};

/** The places a repeating activity happens at, so booking the weekly session
 * is picking "the usual court" rather than pasting a maps link every time.
 * Only meaningful for a persistent activity — the caller decides that. */
export const ActivityLocations = ({ activity, canEdit }: Props) => {
  const [name, setName] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");

  const addLocation = useAddActivityLocationMutation();
  const removeLocation = useRemoveActivityLocationMutation();

  const valid = name.trim() !== "" && mapsUrl.trim() !== "";

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!valid) return;

    addLocation.mutate(
      { activityId: activity.id, name: name.trim(), mapsUrl: mapsUrl.trim() },
      {
        onSuccess: () => {
          setName("");
          setMapsUrl("");
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Locations</h2>

      {activity.locations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? "No fixed locations yet. Add the places this usually happens, and booking gets a one-click pick."
            : "No fixed locations yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {activity.locations.map((location) => (
            <li
              key={location.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <a
                href={location.mapsUrl}
                target="_blank"
                rel="noreferrer"
                title={location.mapsUrl}
                className="flex min-w-0 items-center gap-2 text-sm hover:underline"
              >
                <MapPinIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{location.name}</span>
              </a>
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${location.name}`}
                  disabled={removeLocation.isPending}
                  onClick={() =>
                    removeLocation.mutate({ activityId: activity.id, locationId: location.id })
                  }
                >
                  <XIcon className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-40 flex-1 flex-col gap-1.5">
              <Label htmlFor="location-name">Name</Label>
              <Input
                id="location-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="The usual court"
              />
            </div>
            <div className="flex min-w-56 flex-[2] flex-col gap-1.5">
              <Label htmlFor="location-maps-url">Google Maps link</Label>
              <Input
                id="location-maps-url"
                type="url"
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                placeholder="https://maps.app.goo.gl/…"
              />
            </div>
            <Button type="submit" variant="outline" disabled={!valid || addLocation.isPending}>
              {addLocation.isPending ? "Adding…" : "Add"}
            </Button>
          </div>

          {addLocation.isError && (
            <p className="text-sm text-destructive" aria-live="polite">
              Failed to add location — check the link is a valid URL and the name isn't already
              taken.
            </p>
          )}
          {removeLocation.isError && (
            <p className="text-sm text-destructive" aria-live="polite">
              Failed to remove location.
            </p>
          )}
        </form>
      )}
    </div>
  );
};
