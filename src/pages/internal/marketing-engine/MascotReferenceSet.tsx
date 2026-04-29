// Mascot Reference Set — gallery UI for managing the AI avatar host's
// character reference images.
//
// Today's avatar adapter (Kie Grok Imagine 4.3) takes ONE image from
// brand_assets.mascot_character_image_url. Future adapters that consume
// multi-angle reference sets read brand_assets.mascot_character_image_pool
// (a JSON array). This component is the single source of truth for both:
// the pool holds every image, exactly one is flagged is_primary, and the
// primary's URL is mirrored into mascot_character_image_url so the
// current adapter keeps working without any code change.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Star,
  StarOff,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MascotImage {
  url: string;
  filename: string;
  angle?: string;
  notes?: string;
  is_primary: boolean;
}

interface BrandAssetRow {
  id: string;
  key: string;
  asset_type: string;
  asset_url: string | null;
  asset_value: string | null;
  version: number;
  locked: boolean;
}

const POOL_KEY = "mascot_character_image_pool";
const PRIMARY_KEY = "mascot_character_image_url";
const STORAGE_PREFIX = "mascot/";

function parsePool(raw: string | null): MascotImage[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is MascotImage =>
      typeof x === "object" && x !== null && typeof (x as MascotImage).url === "string",
    );
  } catch {
    return [];
  }
}

function ensureSinglePrimary(pool: MascotImage[]): MascotImage[] {
  const hasPrimary = pool.some((p) => p.is_primary);
  if (pool.length === 0 || hasPrimary) return pool;
  // No primary yet; promote first.
  return pool.map((p, i) => ({ ...p, is_primary: i === 0 }));
}

export default function MascotReferenceSet() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: rows } = useQuery<BrandAssetRow[]>({
    queryKey: ["mascot-reference-set"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brand_assets")
        .select("id, key, asset_type, asset_url, asset_value, version, locked")
        .in("key", [POOL_KEY, PRIMARY_KEY]);
      return (data ?? []) as BrandAssetRow[];
    },
  });

  const poolRow = rows?.find((r) => r.key === POOL_KEY);
  const primaryRow = rows?.find((r) => r.key === PRIMARY_KEY);
  const pool = ensureSinglePrimary(parsePool(poolRow?.asset_value ?? null));

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      if (!poolRow) throw new Error(`brand_assets row "${POOL_KEY}" missing — run migration 20260429150000`);
      if (poolRow.locked) throw new Error("Mascot pool is locked. Unlock the row to upload.");

      const uploaded: MascotImage[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop() ?? "png";
        const safeName = file.name.replace(/[^\w.-]+/g, "_");
        const path = `${STORAGE_PREFIX}${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("marketing-engine-brand")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage
          .from("marketing-engine-brand")
          .getPublicUrl(path);
        uploaded.push({
          url: pub.publicUrl,
          filename: file.name,
          is_primary: false,
        });
      }

      const next = ensureSinglePrimary([...pool, ...uploaded]);
      await persistPool(next, poolRow);
      // If the primary changed (was empty, now first uploaded), mirror to PRIMARY_KEY.
      const primary = next.find((p) => p.is_primary);
      if (primary && (primaryRow?.asset_url ?? "") !== primary.url) {
        await mirrorPrimary(primary.url, primaryRow ?? null);
      }
      return uploaded.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} image${count === 1 ? "" : "s"} uploaded`);
      queryClient.invalidateQueries({ queryKey: ["mascot-reference-set"] });
      queryClient.invalidateQueries({ queryKey: ["brand-assets"] });
    },
    onError: (err: Error) =>
      toast.error("Upload failed", { description: err.message }),
  });

  const setPrimary = useMutation({
    mutationFn: async (url: string) => {
      if (!poolRow) throw new Error("pool missing");
      const next = pool.map((p) => ({ ...p, is_primary: p.url === url }));
      await persistPool(next, poolRow);
      await mirrorPrimary(url, primaryRow ?? null);
    },
    onSuccess: () => {
      toast.success("Primary updated");
      queryClient.invalidateQueries({ queryKey: ["mascot-reference-set"] });
      queryClient.invalidateQueries({ queryKey: ["brand-assets"] });
    },
    onError: (err: Error) =>
      toast.error("Update failed", { description: err.message }),
  });

  const updateMeta = useMutation({
    mutationFn: async (next: { url: string; angle?: string; notes?: string }) => {
      if (!poolRow) throw new Error("pool missing");
      const updated = pool.map((p) =>
        p.url === next.url
          ? { ...p, angle: next.angle ?? p.angle, notes: next.notes ?? p.notes }
          : p,
      );
      await persistPool(updated, poolRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mascot-reference-set"] });
    },
    onError: (err: Error) =>
      toast.error("Save failed", { description: err.message }),
  });

  const remove = useMutation({
    mutationFn: async (url: string) => {
      if (!poolRow) throw new Error("pool missing");
      const target = pool.find((p) => p.url === url);
      const next = ensureSinglePrimary(pool.filter((p) => p.url !== url));
      await persistPool(next, poolRow);

      // If the removed image was primary, mirror the new primary (or empty).
      if (target?.is_primary) {
        const newPrimary = next.find((p) => p.is_primary);
        await mirrorPrimary(newPrimary?.url ?? "", primaryRow ?? null);
      }

      // Best-effort storage cleanup. Failures are non-fatal — orphaned blobs
      // can be swept later. We only delete files we uploaded under mascot/.
      try {
        const path = url.split(`/marketing-engine-brand/`)[1];
        if (path && path.startsWith(STORAGE_PREFIX)) {
          await supabase.storage.from("marketing-engine-brand").remove([path]);
        }
      } catch {
        // ignore
      }
    },
    onSuccess: () => {
      toast.success("Image removed");
      queryClient.invalidateQueries({ queryKey: ["mascot-reference-set"] });
      queryClient.invalidateQueries({ queryKey: ["brand-assets"] });
    },
    onError: (err: Error) =>
      toast.error("Delete failed", { description: err.message }),
  });

  const poolMissing = !poolRow;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-3">
              Mascot Reference Set
              {pool.length > 0 && (
                <Badge variant="secondary" className="font-normal">
                  {pool.length} image{pool.length === 1 ? "" : "s"}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-2 max-w-3xl">
              Upload reference images of the AI avatar host. The image marked
              primary feeds the current single-image adapter (Grok Imagine 4.3
              via <code>mascot_character_image_url</code>). Future multi-angle
              adapters read the full pool. Drop in front, three-quarter, and
              profile shots so a model swap doesn't need new uploads.
            </CardDescription>
            <p className="text-xs text-muted-foreground mt-2">
              <strong>Important:</strong> the primary image must have a clean
              cutout or neutral background. Green-screen pixels leak into Grok
              Imagine 4.3 output. Other pool images can stay green-screen until
              a future adapter consumes them.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length > 0) upload.mutate(files);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={upload.isPending || poolMissing}
            >
              {upload.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Upload images
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {poolMissing && (
          <p className="text-sm text-muted-foreground">
            <code>mascot_character_image_pool</code> row not found. Run
            migration <code>20260429150000_marketing_engine_18_mascot_pool.sql</code>.
          </p>
        )}
        {!poolMissing && pool.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No reference images yet. Click <b>Upload images</b> to add them. You
            can multi-select.
          </p>
        )}
        {pool.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {pool.map((img) => (
              <ImageTile
                key={img.url}
                img={img}
                onSetPrimary={() => setPrimary.mutate(img.url)}
                onSaveMeta={(meta) => updateMeta.mutate({ url: img.url, ...meta })}
                onRemove={() => {
                  if (confirm(`Remove ${img.filename} from the reference set?`)) {
                    remove.mutate(img.url);
                  }
                }}
                disabled={
                  setPrimary.isPending || remove.isPending || updateMeta.isPending
                }
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ImageTile({
  img,
  onSetPrimary,
  onSaveMeta,
  onRemove,
  disabled,
}: {
  img: MascotImage;
  onSetPrimary: () => void;
  onSaveMeta: (meta: { angle?: string; notes?: string }) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const [angle, setAngle] = useState(img.angle ?? "");
  const [notes, setNotes] = useState(img.notes ?? "");
  const dirty = angle !== (img.angle ?? "") || notes !== (img.notes ?? "");

  return (
    <div
      className={`border rounded-md overflow-hidden flex flex-col ${
        img.is_primary ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="aspect-square bg-muted relative">
        <img
          src={img.url}
          alt={img.filename}
          className="w-full h-full object-cover"
          onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.4")}
        />
        {img.is_primary && (
          <Badge className="absolute top-2 left-2 gap-1">
            <Star className="h-3 w-3" /> Primary
          </Badge>
        )}
      </div>
      <div className="p-3 space-y-2 text-xs">
        <div className="font-medium truncate" title={img.filename}>
          {img.filename}
        </div>
        <div>
          <Label className="text-xs">Angle</Label>
          <Input
            value={angle}
            onChange={(e) => setAngle(e.target.value)}
            placeholder="e.g. front, 3q-left, profile"
            className="h-7 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Notes</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="optional"
            className="h-7 text-xs"
          />
        </div>
        <div className="flex items-center gap-1 pt-1">
          {!img.is_primary ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs flex-1"
              onClick={onSetPrimary}
              disabled={disabled}
              title="Make this image the active primary reference"
            >
              <StarOff className="h-3 w-3 mr-1" /> Set primary
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground flex-1">
              In use by current adapter
            </span>
          )}
          {dirty && (
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => onSaveMeta({ angle, notes })}
              disabled={disabled}
            >
              save
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={onRemove}
            disabled={disabled}
            title="Remove from set"
          >
            <Trash2 className="h-3 w-3 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </div>
  );
}

async function persistPool(pool: MascotImage[], poolRow: BrandAssetRow) {
  const { error } = await supabase
    .from("brand_assets")
    .update({
      asset_value: JSON.stringify(pool),
      version: poolRow.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poolRow.id);
  if (error) throw error;
}

async function mirrorPrimary(url: string, primaryRow: BrandAssetRow | null) {
  if (!primaryRow) {
    // First-time setup: create the row.
    const { error } = await supabase.from("brand_assets").insert({
      key: PRIMARY_KEY,
      asset_type: "image",
      asset_url: url || null,
      notes:
        "Primary mascot reference image consumed by the single-image avatar adapter. Mirrored from mascot_character_image_pool — manage via the Mascot Reference Set gallery.",
    });
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("brand_assets")
    .update({
      asset_url: url || null,
      version: primaryRow.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", primaryRow.id);
  if (error) throw error;
}
