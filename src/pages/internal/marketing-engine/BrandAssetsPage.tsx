import { useQuery, useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Lock,
  Unlock,
  Upload,
  Save,
  Loader2,
  Pipette,
  Plus,
  Trash2,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type AssetType =
  | "image"
  | "video"
  | "audio"
  | "color"
  | "text"
  | "voice_id"
  | "font"
  | "json";

interface BrandAsset {
  id: string;
  key: string;
  asset_type: AssetType;
  asset_url: string | null;
  asset_value: string | null;
  mime_type: string | null;
  metadata: Record<string, unknown> | null;
  version: number;
  locked: boolean;
  notes: string | null;
  updated_at: string;
}

const TYPE_ORDER: AssetType[] = [
  "image",
  "color",
  "font",
  "text",
  "voice_id",
  "audio",
  "video",
  "json",
];

const TYPE_LABEL: Record<AssetType, string> = {
  image: "Images",
  color: "Colors",
  font: "Fonts",
  text: "Text & IDs",
  voice_id: "Voice IDs",
  audio: "Audio",
  video: "Video",
  json: "JSON",
};

const FILE_TYPES = new Set<AssetType>(["image", "video", "audio", "font", "json"]);
const VALUE_TYPES = new Set<AssetType>(["color", "text", "voice_id"]);

export default function BrandAssetsPage() {
  const navigate = useNavigate();

  const { data: assets, refetch } = useQuery<BrandAsset[]>({
    queryKey: ["brand-assets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brand_assets")
        .select("*")
        .order("asset_type")
        .order("key");
      return (data ?? []) as BrandAsset[];
    },
  });

  const grouped: Record<AssetType, BrandAsset[]> = Object.fromEntries(
    TYPE_ORDER.map((t) => [t, [] as BrandAsset[]]),
  ) as Record<AssetType, BrandAsset[]>;
  for (const a of assets ?? []) grouped[a.asset_type]?.push(a);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/internal/marketing-engine")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Brand Assets</h1>
            <p className="text-muted-foreground mt-1">
              AutoListing brand identity. Edit values inline; upload files to the
              private brand bucket. The Producer reads these at render time, so a
              save here updates the next post automatically.
            </p>
          </div>
          <NewAssetButton onCreated={refetch} />
        </div>

        {(!assets || assets.length === 0) && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No brand assets yet. Use <b>+ New asset</b> to seed the palette,
              logo, mascot, and voice IDs.
            </CardContent>
          </Card>
        )}

        {TYPE_ORDER.map((type) => {
          const items = grouped[type] ?? [];
          if (items.length === 0) return null;
          return (
            <Card key={type}>
              <CardHeader>
                <CardTitle>{TYPE_LABEL[type]}</CardTitle>
                <CardDescription>{items.length} entries</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {items.map((a) => (
                    <AssetRow key={a.id} asset={a} onChange={refetch} />
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
  );
}

function AssetRow({
  asset,
  onChange,
}: {
  asset: BrandAsset;
  onChange: () => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState<string>(asset.asset_value ?? "");
  const [draftNotes, setDraftNotes] = useState<string>(asset.notes ?? "");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraftValue(asset.asset_value ?? "");
    setDraftNotes(asset.notes ?? "");
  }, [asset.id, asset.asset_value, asset.notes]);

  const isFile = FILE_TYPES.has(asset.asset_type);
  const isValue = VALUE_TYPES.has(asset.asset_type);

  const saveValue = useMutation({
    mutationFn: async (next: { asset_value?: string | null; asset_url?: string | null; notes?: string | null }) => {
      const updates: Record<string, unknown> = {
        ...next,
        version: asset.version + 1,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("brand_assets")
        .update(updates)
        .eq("id", asset.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      setEditing(false);
      onChange();
      queryClient.invalidateQueries({ queryKey: ["brand-assets"] });
    },
    onError: (err: Error) =>
      toast.error("Save failed", { description: err.message }),
  });

  const toggleLock = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("brand_assets")
        .update({ locked: !asset.locked, updated_at: new Date().toISOString() })
        .eq("id", asset.id);
      if (error) throw error;
    },
    onSuccess: () => {
      onChange();
      queryClient.invalidateQueries({ queryKey: ["brand-assets"] });
    },
    onError: (err: Error) =>
      toast.error("Lock toggle failed", { description: err.message }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("brand_assets").delete().eq("id", asset.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Asset deleted");
      onChange();
      queryClient.invalidateQueries({ queryKey: ["brand-assets"] });
    },
    onError: (err: Error) =>
      toast.error("Delete failed", { description: err.message }),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (asset.locked) throw new Error("Asset is locked. Unlock to upload a new file.");
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${asset.key}-v${asset.version + 1}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("marketing-engine-brand")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadErr) throw uploadErr;
      const { data: pub } = supabase.storage
        .from("marketing-engine-brand")
        .getPublicUrl(path);
      const { error: updateErr } = await supabase
        .from("brand_assets")
        .update({
          asset_url: pub.publicUrl,
          mime_type: file.type,
          version: asset.version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", asset.id);
      if (updateErr) throw updateErr;
    },
    onSuccess: () => {
      toast.success("File uploaded");
      onChange();
      queryClient.invalidateQueries({ queryKey: ["brand-assets"] });
    },
    onError: (err: Error) =>
      toast.error("Upload failed", { description: err.message }),
  });

  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <code className="text-xs font-mono w-56 shrink-0 truncate">{asset.key}</code>

        <div className="flex-1 min-w-0">
          {!editing && isValue && (
            <ValueDisplay asset={asset} />
          )}
          {!editing && isFile && (
            <FileDisplay asset={asset} />
          )}
          {editing && isValue && (
            <ValueEditor
              asset={asset}
              value={draftValue}
              onChange={setDraftValue}
            />
          )}
        </div>

        <Badge variant="outline" className="text-xs shrink-0">v{asset.version}</Badge>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => toggleLock.mutate()}
          disabled={toggleLock.isPending}
          title={asset.locked ? "Unlock" : "Lock"}
        >
          {asset.locked ? (
            <Lock className="h-4 w-4 text-amber-500" />
          ) : (
            <Unlock className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>

        {isValue && !editing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
            disabled={asset.locked}
          >
            edit
          </Button>
        )}
        {isValue && editing && (
          <div className="flex gap-1">
            <Button
              size="sm"
              onClick={() => saveValue.mutate({ asset_value: draftValue })}
              disabled={saveValue.isPending || draftValue === asset.asset_value}
            >
              {saveValue.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraftValue(asset.asset_value ?? ""); setEditing(false); }}>
              cancel
            </Button>
          </div>
        )}

        {isFile && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={mimeAcceptFor(asset.asset_type)}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate(file);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={asset.locked || upload.isPending}
            >
              {upload.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Upload className="h-3 w-3 mr-1" />
              )}
              {asset.asset_url ? "Replace" : "Upload"}
            </Button>
          </>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (confirm(`Delete "${asset.key}"?`)) remove.mutate();
          }}
          disabled={remove.isPending}
          title="Delete"
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      {asset.notes && (
        <p className="text-xs text-muted-foreground pl-1">{asset.notes}</p>
      )}
    </div>
  );
}

function ValueDisplay({ asset }: { asset: BrandAsset }) {
  if (asset.asset_type === "color") {
    const hex = asset.asset_value ?? "";
    return (
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded border"
          style={{ backgroundColor: hex || "transparent" }}
        />
        <code className="text-xs font-mono">{hex || <em className="text-muted-foreground">empty</em>}</code>
      </div>
    );
  }
  return (
    <code className="text-xs font-mono break-all">
      {asset.asset_value
        ? <span>{asset.asset_value}</span>
        : <em className="text-muted-foreground">empty</em>}
    </code>
  );
}

function ValueEditor({
  asset,
  value,
  onChange,
}: {
  asset: BrandAsset;
  value: string;
  onChange: (v: string) => void;
}) {
  if (asset.asset_type === "color") {
    return (
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-9 rounded cursor-pointer border-0 p-0"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#0F172A"
          className="font-mono text-xs h-8 max-w-[140px]"
        />
        <Pipette className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }
  // text / voice_id / font: single-line input, with bigger box for long text.
  const long = value.length > 60;
  return long ? (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={2}
      className="text-xs font-mono"
    />
  ) : (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs font-mono h-8"
      placeholder={asset.notes ?? ""}
    />
  );
}

function FileDisplay({ asset }: { asset: BrandAsset }) {
  if (!asset.asset_url) {
    return <em className="text-xs text-muted-foreground">no file uploaded</em>;
  }
  if (asset.asset_type === "image") {
    return (
      <a
        href={asset.asset_url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2"
      >
        <img
          src={asset.asset_url}
          alt={asset.key}
          className="h-10 w-10 rounded object-cover border"
          onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.4")}
        />
        <span className="text-xs text-muted-foreground truncate max-w-[280px]">
          {asset.asset_url.split("/").pop()}
        </span>
      </a>
    );
  }
  if (asset.asset_type === "audio") {
    return (
      <audio controls src={asset.asset_url} className="h-8 max-w-[280px]" />
    );
  }
  return (
    <a
      href={asset.asset_url}
      target="_blank"
      rel="noreferrer"
      className="text-xs text-muted-foreground truncate max-w-[420px] inline-block"
    >
      {asset.asset_url}
    </a>
  );
}

function NewAssetButton({ onCreated }: { onCreated: () => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [type, setType] = useState<AssetType>("text");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!key.trim()) throw new Error("key required");
      const insert: Record<string, unknown> = {
        key: key.trim(),
        asset_type: type,
        notes: notes.trim() || null,
      };
      if (VALUE_TYPES.has(type)) insert.asset_value = value;
      const { error } = await supabase.from("brand_assets").insert(insert);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Asset created");
      setOpen(false);
      setKey("");
      setValue("");
      setNotes("");
      setType("text");
      onCreated();
      queryClient.invalidateQueries({ queryKey: ["brand-assets"] });
    },
    onError: (err: Error) =>
      toast.error("Create failed", { description: err.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> New asset
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New brand asset</DialogTitle>
          <DialogDescription>
            For files (image / video / audio / font / json), create the row first
            then click Upload on the row to attach a file.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Key</Label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g. mascot_character_image_url"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Snake_case. Producer reads brand_assets by key.
            </p>
          </div>
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as AssetType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_ORDER.map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABEL[t]} — <code className="ml-2 text-xs">{t}</code></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {VALUE_TYPES.has(type) && (
            <div>
              <Label className="text-xs">Value</Label>
              {type === "color" ? (
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={value || "#000000"}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-10 h-9 rounded border-0"
                  />
                  <Input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="#0F172A"
                    className="font-mono"
                  />
                </div>
              ) : (
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={
                    type === "voice_id" ? "voice id from Cartesia" : "text value"
                  }
                  className="font-mono"
                />
              )}
            </div>
          )}
          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Where this is read by the engine, what it controls"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !key.trim()}>
            {create.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function mimeAcceptFor(type: AssetType): string {
  switch (type) {
    case "image": return "image/png,image/jpeg,image/webp";
    case "video": return "video/mp4,video/webm,video/quicktime";
    case "audio": return "audio/mpeg,audio/wav,audio/mp4";
    case "font":  return ".woff,.woff2,.ttf,.otf";
    case "json":  return "application/json,.json";
    default:       return "*/*";
  }
}
