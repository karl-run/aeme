import { MapPinIcon, PencilIcon, TicketIcon, XIcon } from "lucide-react";
import { type FormEvent, useState } from "react";

import type { ActivityWithAvailability } from "../queries/activities.ts";
import {
  type LocationFields,
  useAddActivityLocationMutation,
  useRemoveActivityLocationMutation,
  useUpdateActivityLocationMutation,
} from "../queries/locations.ts";
import { Button } from "./ui/button.tsx";
import { Input } from "./ui/input.tsx";
import { Label } from "./ui/label.tsx";

type Location = ActivityWithAvailability["locations"][number];

type Props = {
  activity: ActivityWithAvailability;
  /** The activity's creator may add, edit and retire places; everyone else
   * just reads the list. */
  canEdit: boolean;
};

/** What the four inputs hold while being typed: all strings, since an empty
 * optional field is "" in the DOM and only becomes null on submit. */
type Draft = { name: string; mapsUrl: string; bookingUrl: string; mapsPlaceName: string };

const emptyDraft: Draft = { name: "", mapsUrl: "", bookingUrl: "", mapsPlaceName: "" };

const toDraft = (location: Location): Draft => ({
  name: location.name,
  mapsUrl: location.mapsUrl,
  bookingUrl: location.bookingUrl ?? "",
  mapsPlaceName: location.mapsPlaceName ?? "",
});

/** A blank optional field means "unset", which the API takes as null rather
 * than an empty string. */
const toFields = (draft: Draft): LocationFields => ({
  name: draft.name.trim(),
  mapsUrl: draft.mapsUrl.trim(),
  bookingUrl: draft.bookingUrl.trim() || null,
  mapsPlaceName: draft.mapsPlaceName.trim() || null,
});

const isComplete = (draft: Draft) => draft.name.trim() !== "" && draft.mapsUrl.trim() !== "";

/** The four fields of a place, shared by the add form and the edit form so
 * the two never drift apart. `idPrefix` keeps the labels pointing at their
 * own inputs when several of these are on the page at once. */
const LocationFieldset = ({
  idPrefix,
  draft,
  onChange,
}: {
  idPrefix: string;
  draft: Draft;
  onChange: (draft: Draft) => void;
}) => (
  <div className="flex flex-wrap gap-2">
    <div className="flex min-w-40 flex-1 flex-col gap-1.5">
      <Label htmlFor={`${idPrefix}-name`}>Name</Label>
      <Input
        id={`${idPrefix}-name`}
        value={draft.name}
        onChange={(e) => onChange({ ...draft, name: e.target.value })}
        placeholder="The usual court"
      />
    </div>
    <div className="flex min-w-56 flex-[2] flex-col gap-1.5">
      <Label htmlFor={`${idPrefix}-maps-url`}>Google Maps link</Label>
      <Input
        id={`${idPrefix}-maps-url`}
        type="url"
        value={draft.mapsUrl}
        onChange={(e) => onChange({ ...draft, mapsUrl: e.target.value })}
        placeholder="https://maps.app.goo.gl/…"
      />
    </div>
    <div className="flex min-w-56 flex-[2] flex-col gap-1.5">
      <Label htmlFor={`${idPrefix}-booking-url`}>Booking URL</Label>
      <Input
        id={`${idPrefix}-booking-url`}
        type="url"
        value={draft.bookingUrl}
        onChange={(e) => onChange({ ...draft, bookingUrl: e.target.value })}
        placeholder="Optional — where the place is booked"
      />
    </div>
    <div className="flex min-w-56 flex-[2] flex-col gap-1.5">
      <Label htmlFor={`${idPrefix}-maps-place-name`}>Google Maps location name</Label>
      <Input
        id={`${idPrefix}-maps-place-name`}
        value={draft.mapsPlaceName}
        onChange={(e) => onChange({ ...draft, mapsPlaceName: e.target.value })}
        placeholder="Optional — what Maps calls it"
      />
    </div>
  </div>
);

/** One place, either read-only or opened up for editing. Editing replaces the
 * row rather than opening a dialog: the fields are the same four the add form
 * below shows, so the swap reads as the row growing into a form. */
const LocationRow = ({
  activityId,
  location,
  canEdit,
}: {
  activityId: string;
  location: Location;
  canEdit: boolean;
}) => {
  const [draft, setDraft] = useState<Draft | null>(null);

  const updateLocation = useUpdateActivityLocationMutation();
  const removeLocation = useRemoveActivityLocationMutation();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!draft || !isComplete(draft)) return;

    updateLocation.mutate(
      { activityId, locationId: location.id, ...toFields(draft) },
      { onSuccess: () => setDraft(null) },
    );
  };

  if (draft) {
    return (
      <li className="rounded-md border border-border px-3 py-2.5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <LocationFieldset
            idPrefix={`location-${location.id}`}
            draft={draft}
            onChange={setDraft}
          />
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={!isComplete(draft) || updateLocation.isPending}
            >
              {updateLocation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                // Dropping the draft without clearing the mutation would
                // greet the next edit with the last one's error.
                updateLocation.reset();
                setDraft(null);
              }}
            >
              Cancel
            </Button>
          </div>
          {updateLocation.isError && (
            <p className="text-sm text-destructive" aria-live="polite">
              Failed to save — check the links are valid URLs and the name isn't already taken.
            </p>
          )}
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-md border border-border px-3 py-2">
      <div className="flex items-center justify-between gap-3">
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
        <div className="flex shrink-0 items-center gap-1">
          {location.bookingUrl && (
            <a
              href={location.bookingUrl}
              target="_blank"
              rel="noreferrer"
              title={location.bookingUrl}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              <TicketIcon className="size-4" />
              Book
            </a>
          )}
          {canEdit && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${location.name}`}
                onClick={() => setDraft(toDraft(location))}
              >
                <PencilIcon className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${location.name}`}
                disabled={removeLocation.isPending}
                onClick={() => removeLocation.mutate({ activityId, locationId: location.id })}
              >
                <XIcon className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>
      {removeLocation.isError && (
        <p className="mt-1.5 text-sm text-destructive" aria-live="polite">
          Failed to remove location.
        </p>
      )}
    </li>
  );
};

/** The places a repeating activity happens at, so booking the weekly session
 * is picking "the usual court" rather than pasting a maps link every time.
 * Only meaningful for a persistent activity — the caller decides that. */
export const ActivityLocations = ({ activity, canEdit }: Props) => {
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const addLocation = useAddActivityLocationMutation();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isComplete(draft)) return;

    addLocation.mutate(
      { activityId: activity.id, ...toFields(draft) },
      { onSuccess: () => setDraft(emptyDraft) },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {activity.locations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? "No fixed locations yet. Add the places this usually happens, and booking gets a one-click pick."
            : "No fixed locations yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {activity.locations.map((location) => (
            <LocationRow
              key={location.id}
              activityId={activity.id}
              location={location}
              canEdit={canEdit}
            />
          ))}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <LocationFieldset idPrefix="new-location" draft={draft} onChange={setDraft} />
          <div>
            <Button
              type="submit"
              variant="outline"
              disabled={!isComplete(draft) || addLocation.isPending}
            >
              {addLocation.isPending ? "Adding…" : "Add"}
            </Button>
          </div>

          {addLocation.isError && (
            <p className="text-sm text-destructive" aria-live="polite">
              Failed to add location — check the links are valid URLs and the name isn't already
              taken.
            </p>
          )}
        </form>
      )}
    </div>
  );
};
